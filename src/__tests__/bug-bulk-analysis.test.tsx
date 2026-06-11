import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';

// Mock supabase
vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => ({
      on: vi.fn(() => ({ subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) })),
    })),
  },
  AppError: class AppError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    loading: false,
    signInWithGoogle: vi.fn(),
  }),
}));

// Mock useUserCredits hook
vi.mock('../hooks/useUserCredits', () => ({
  useUserCredits: () => ({
    credits: { remaining: 100, total: 100, feedbackCreditsEarned: 0, referralCreditsEarned: 0, resetDate: new Date().toISOString() },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    showUpgrade: false,
    setShowUpgrade: vi.fn(),
    upgradeDismissedKey: null,
  }),
}));

// Mock react-i18next - handle interpolation objects
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
      if (typeof fallbackOrOptions === 'string') return fallbackOrOptions;
      return key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

// Mock ConfirmActionModal to avoid portal + interpolation issues
vi.mock('../components/Credits/ConfirmActionModal', () => ({
  ConfirmActionModal: ({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: () => Promise<void> }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="confirm-modal">
        <button onClick={() => onConfirm()}>Confirm</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    );
  },
}));

// Mock UpgradeModal
vi.mock('../components/Credits/UpgradeModal', () => ({
  UpgradeModal: () => null,
}));
vi.mock('../components/Credits/PricingWaitlistModal', () => ({
  PricingWaitlistModal: () => null,
}));

// Mock parseResume
const mockParseResume = vi.fn();
vi.mock('../services/api', () => ({
  parseResume: (...args: unknown[]) => mockParseResume(...args),
}));

// Mock authHeaders
vi.mock('../lib/auth/authHeaders', () => ({
  getAuthHeaders: () => Promise.resolve({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-token',
  }),
}));

import { BulkAnalysisSection } from '../components/sections/BulkAnalysisSection';

describe('BulkAnalysisSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    // Reset fetch mock
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('Bug: 0 keywords displayed', () => {
    it('should display keyword count from strongMatches when topHits/matchedKeywords are absent', async () => {
      // The ai-match endpoint returns strongMatches + matched_keywords, NOT topHits or matchedKeywords
      const aiMatchResponse = {
        score: 19,
        coverage: 0.19,
        similarity: 0.19,
        missingKeywords: ['Docker', 'Kubernetes'],
        strongMatches: ['Python', 'SQL', 'Data Analysis'],
        matched_keywords: ['Python', 'SQL', 'Data Analysis'],
        recommendations: ['Docker', 'Kubernetes'],
        overallAssessment: 'Needs improvement',
        categoryScores: null,
        gapAnalysis: [],
        keywordStrategy: null,
        creditsRemaining: 98,
      };

      mockParseResume.mockResolvedValue({ plainText: 'Python SQL Data Analysis experience' });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(aiMatchResponse),
      });

      const { container } = render(
        <BulkAnalysisSection jobDescription="Looking for Python SQL Docker engineer" />
      );

      // Simulate file upload
      const file = new File(['resume content'], 'test-resume.pdf', { type: 'application/pdf' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      // The confirm modal should appear - click confirm
      await waitFor(() => {
        const confirmButton = screen.queryByText(/confirm/i) || screen.queryByRole('button', { name: /confirm/i });
        if (confirmButton) fireEvent.click(confirmButton);
      });

      // Wait for processing to complete
      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument();
      }, { timeout: 5000 });

      // BUG: The keyword count should be 3 (from strongMatches), not 0
      // The response has strongMatches but UI only checks topHits and matchedKeywords
      const keywordsLabel = screen.getByText('Keywords');
      const keywordsValue = keywordsLabel.parentElement?.querySelector('.text-lg');
      expect(keywordsValue?.textContent).toBe('3');
    });
  });

  describe('Bug: pending stuck on multi-file upload', () => {
    it('should process all files when multiple are uploaded, not just the last one', async () => {
      mockParseResume.mockResolvedValue({ plainText: 'Test resume content' });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          score: 50,
          coverage: 0.5,
          strongMatches: ['Python'],
          missingKeywords: [],
          creditsRemaining: 96,
        }),
      });

      const { container } = render(
        <BulkAnalysisSection jobDescription="Looking for Python engineer" />
      );

      const file1 = new File(['resume 1'], 'resume1.pdf', { type: 'application/pdf' });
      const file2 = new File(['resume 2'], 'resume2.pdf', { type: 'application/pdf' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file1, file2] } });
      });

      // The confirm modal should appear - we need to confirm for BOTH files
      // BUG: Only one pendingResumeId is stored, so only the last file gets processed
      await waitFor(() => {
        const confirmButton = screen.queryByText(/confirm/i) || screen.queryByRole('button', { name: /confirm/i });
        if (confirmButton) fireEvent.click(confirmButton);
      });

      // Wait for first file to complete
      await waitFor(() => {
        expect(screen.getAllByText('Ready').length).toBeGreaterThanOrEqual(1);
      }, { timeout: 5000 });

      // Check if a second confirm modal appears for the second file
      await waitFor(() => {
        const confirmButton = screen.queryByText(/confirm/i) || screen.queryByRole('button', { name: /confirm/i });
        if (confirmButton) fireEvent.click(confirmButton);
      });

      // BUG: The second file should NOT be stuck at "pending"
      // Both files should eventually reach 'completed' or at least not be 'pending'
      await waitFor(() => {
        const pendingElements = screen.queryAllByText('pending');
        expect(pendingElements.length).toBe(0);
      }, { timeout: 5000 });
    });
  });

  describe('Bug: concurrent requests cause rate limit errors', () => {
    it('should process resumes sequentially to avoid overwhelming the API', async () => {
      // Track concurrent calls - if resumes are processed in parallel,
      // multiple parseResume calls will be active simultaneously
      let activeCalls = 0;
      let maxConcurrentCalls = 0;

      mockParseResume.mockImplementation(async () => {
        activeCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, activeCalls);
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 50));
        activeCalls--;
        return { plainText: 'Test resume content' };
      });

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        activeCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, activeCalls);
        await new Promise(resolve => setTimeout(resolve, 50));
        activeCalls--;
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            score: 75,
            coverage: 0.75,
            strongMatches: ['Python', 'SQL'],
            missingKeywords: ['Docker'],
            creditsRemaining: 90,
          }),
        };
      });

      const { container } = render(
        <BulkAnalysisSection jobDescription="Looking for Python SQL Docker engineer" />
      );

      // Upload 3 files at once
      const files = [
        new File(['resume 1'], 'resume1.pdf', { type: 'application/pdf' }),
        new File(['resume 2'], 'resume2.pdf', { type: 'application/pdf' }),
        new File(['resume 3'], 'resume3.pdf', { type: 'application/pdf' }),
      ];
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files } });
      });

      // Confirm the batch
      await waitFor(() => {
        const confirmButton = screen.queryByText(/confirm/i);
        if (confirmButton) fireEvent.click(confirmButton);
      });

      // Wait for all to complete
      await waitFor(() => {
        expect(screen.getAllByText('Ready').length).toBe(3);
      }, { timeout: 10000 });

      // Sequential processing should never have more than 1 active call at a time
      // (parseResume + fetch are interleaved for one resume before the next starts)
      expect(maxConcurrentCalls).toBeLessThanOrEqual(1);
    });
  });
});
