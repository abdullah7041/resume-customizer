import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, beforeAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createAssessmentContext } from '../lib/match/assessmentContext';

beforeAll(() => { Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto }); });

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
const mockLanguage = vi.hoisted(() => ({ value: 'en' }));
const arabicReportLabels: Record<string, string> = {
  'sections.bulk.reportTitle': 'تقرير مقارنة السير الذاتية',
  'sections.bulk.comparisonTitle': 'نتائج المقارنة',
  'sections.bulk.reportGenerated': 'أُنشئ في',
  'sections.bulk.reportHistorical': 'تقييم سابق',
  'sections.bulk.reportJobSummary': 'ملخص الوصف الوظيفي:',
  'sections.bulk.reportRank': 'الترتيب',
  'sections.bulk.reportResumeName': 'اسم السيرة الذاتية',
  'sections.bulk.estimatedAlignment': 'تقدير التوافق مع هذا الوصف الوظيفي',
  'sections.bulk.reportKeywords': 'الكلمات المفتاحية',
  'sections.bulk.reportRelativeRank': 'الترتيب النسبي',
  'sections.bulk.highestScore': 'أعلى درجة في هذه المقارنة',
  'sections.bulk.lowerScore': 'درجة أقل في هذه المقارنة',
  'sections.bulk.hiringDisclaimer': 'هذا التقييم لا يتنبأ بقرار التوظيف.',
  'sections.bulk.reportMissingKeywords': 'متطلبات تحتاج إلى دليل:',
  'sections.bulk.reportRealityCheck': 'ملخص الأدلة والمخاطر:',
};
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
      if (typeof fallbackOrOptions === 'string') return fallbackOrOptions;
      return key;
    },
    i18n: { get language() { return mockLanguage.value; }, changeLanguage: vi.fn(),
      getFixedT: (language: string) => (key: string, fallback?: string) => language === 'ar'
        ? arabicReportLabels[key] ?? fallback ?? key : fallback ?? key },
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
const mockPdfText = vi.hoisted(() => vi.fn());
const mockPdfSave = vi.hoisted(() => vi.fn());
vi.mock('jspdf', () => ({ jsPDF: class {
  internal = { pageSize: { getWidth: () => 210 } };
  lastAutoTable = { finalY: 90 };
  setFontSize = vi.fn(); setTextColor = vi.fn(); addPage = vi.fn();
  splitTextToSize = (value: string) => [value];
  text = mockPdfText; save = mockPdfSave;
} }));
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }));
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
import { useResumeStore } from '../lib/stores/resumeStore';

describe('BulkAnalysisSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLanguage.value = 'en';
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
      const confirmButton = await screen.findByRole('button', { name: 'Confirm' });
      fireEvent.click(confirmButton);

      // Wait for all to complete
      await waitFor(() => {
        expect(screen.getAllByText('Ready').length).toBe(3);
      }, { timeout: 10000 });

      // Sequential processing should never have more than 1 active call at a time
      // (parseResume + fetch are interleaved for one resume before the next starts)
      expect(maxConcurrentCalls).toBeLessThanOrEqual(1);
    });
  });

  describe('Use my uploaded resume', () => {
    afterEach(() => {
      useResumeStore.setState({ parsedResumeText: null, originalResume: null });
      useResumeStore.getState().clearAnalysisCache();
    });

    it('is hidden when no resume has been parsed yet', () => {
      render(<BulkAnalysisSection jobDescription="Looking for Python engineer" />);
      expect(screen.queryByText('Use my uploaded resume')).not.toBeInTheDocument();
    });

    it('seeds the list from the already-parsed resume without re-parsing, and skips straight to analysis', async () => {
      useResumeStore.setState({
        parsedResumeText: 'Sara Al-Otaibi — Product Manager with 5 years experience',
        originalResume: { basics: { name: 'Sara Al-Otaibi' } } as never,
      });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          score: 60,
          coverage: 0.6,
          strongMatches: ['Product'],
          missingKeywords: [],
          creditsRemaining: 94,
        }),
      });

      render(<BulkAnalysisSection jobDescription="Looking for a Product Manager" />);

      await act(async () => {
        fireEvent.click(screen.getByText('Use my uploaded resume'));
      });

      await waitFor(() => {
        const confirmButton = screen.queryByText(/confirm/i) || screen.queryByRole('button', { name: /confirm/i });
        if (confirmButton) fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument();
      }, { timeout: 5000 });

      // parseResume must never be called for the seeded entry — its text was
      // already known, so parsing (which is free anyway) is skipped entirely.
      expect(mockParseResume).not.toHaveBeenCalled();
      expect(screen.getAllByText(/Sara Al-Otaibi/).length).toBeGreaterThan(0);
    });

    it('uses the cached Match-tab score for free and never calls ai-match on a cache hit', async () => {
      const resumeText = 'Sara Al-Otaibi — Product Manager with 5 years experience';
      const jobDescription = 'Looking for a Product Manager';
      useResumeStore.setState({
        parsedResumeText: resumeText,
        originalResume: { basics: { name: 'Sara Al-Otaibi' } } as never,
      });
      const context = await createAssessmentContext({ resumeText, jobDescription,
        language: 'en', kind: 'match', isOptimized: false, rubricVersion: 'match-v1' });
      useResumeStore.getState().setCachedAssessment(context, {
        score: 82,
        coverage: 0.82,
        matchedKeywords: ['Product'],
        missingKeywords: [],
        strategicRealityCheck: {
          riskTier: 'medium', recommendation: 'review_role_fit', confidence: 'medium',
          riskTypes: ['evidence_quality'], summary: 'Confirm product leadership evidence.',
          strengths: [], confirmedRisks: [], unclearRisks: [],
          limits: { cannotDetermine: ['Hiring decision'], assumptions: [] },
        },
      });

      render(<BulkAnalysisSection jobDescription={jobDescription} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Use my uploaded resume'));
      });

      await waitFor(() => {
        const confirmButton = screen.queryByText(/confirm/i) || screen.queryByRole('button', { name: /confirm/i });
        if (confirmButton) fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getAllByText('82%').length).toBeGreaterThan(0);
      expect(screen.getByText('Confirm product leadership evidence.')).toBeInTheDocument();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('does not start a paid request from a file parse that finishes after the job changes', async () => {
      let resolveParse!: (value: { plainText: string }) => void;
      mockParseResume.mockReturnValueOnce(new Promise(resolve => { resolveParse = resolve; }));
      const { container, rerender } = render(<BulkAnalysisSection jobDescription="Role A" />);
      const file = new File(['resume'], 'candidate.pdf', { type: 'application/pdf' });
      await act(async () => fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } }));
      rerender(<BulkAnalysisSection jobDescription="Role B" />);
      await act(async () => resolveParse({ plainText: 'Candidate resume for Role A' }));
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(screen.queryByText('Ready')).not.toBeInTheDocument();
    });

    it('does not treat same-prefix resume text or a different language as a free cache hit', async () => {
      const resumeText = 'r'.repeat(120) + 'B';
      const cachedContext = await createAssessmentContext({ resumeText: 'r'.repeat(120) + 'A',
        jobDescription: 'API role', language: 'en', kind: 'match', isOptimized: false, rubricVersion: 'match-v1' });
      useResumeStore.getState().setCachedAssessment(cachedContext, { score: 90, missingKeywords: [] });
      useResumeStore.setState({ parsedResumeText: resumeText,
        originalResume: { basics: { name: 'Candidate' } } as never });
      mockLanguage.value = 'ar';
      render(<BulkAnalysisSection jobDescription="API role" />);
      fireEvent.click(screen.getByText('Use my uploaded resume'));
      expect(await screen.findByTestId('confirm-modal')).toBeInTheDocument();
      expect(screen.queryByText('90%')).not.toBeInTheDocument();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('rejects the first A parse after switching A to B and back to A', async () => {
      let resolveOld!: (value: { plainText: string }) => void;
      mockParseResume.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
        .mockResolvedValueOnce({ plainText: 'Current A resume' });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200,
        json: () => Promise.resolve({ score: 61, strongMatches: [], missingKeywords: [] }) });
      const { container, rerender } = render(<BulkAnalysisSection jobDescription="Role A" />);
      const input = container.querySelector('input[type="file"]')!;
      fireEvent.change(input, { target: { files: [new File(['old'], 'old.pdf')] } });
      rerender(<BulkAnalysisSection jobDescription="Role B" />);
      rerender(<BulkAnalysisSection jobDescription="Role A" />);
      fireEvent.change(input, { target: { files: [new File(['new'], 'new.pdf')] } });
      await screen.findByTestId('confirm-modal');
      await act(async () => resolveOld({ plainText: 'Stale A resume' }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
      expect(JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body).resumeText)
        .toBe('Current A resume');
    });

    it('hides itself once the uploaded resume is already in the list', async () => {
      useResumeStore.setState({
        parsedResumeText: 'Sara Al-Otaibi — Product Manager with 5 years experience',
        originalResume: { basics: { name: 'Sara Al-Otaibi' } } as never,
      });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ score: 60, coverage: 0.6, strongMatches: [], missingKeywords: [], creditsRemaining: 94 }),
      });

      render(<BulkAnalysisSection jobDescription="Looking for a Product Manager" />);

      await act(async () => {
        fireEvent.click(screen.getByText('Use my uploaded resume'));
      });

      await waitFor(() => {
        expect(screen.queryByText('Use my uploaded resume')).not.toBeInTheDocument();
      });
    });
  });

  it('labels a low highest score as relative and does not show duplicate coverage', async () => {
    mockParseResume.mockResolvedValue({ plainText: 'Limited relevant experience' });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200,
      json: () => Promise.resolve({ score: 20, coverage: 0.2, similarity: 0.2,
        strongMatches: [], missingKeywords: ['Required skill'] }) });
    const { container } = render(<BulkAnalysisSection jobDescription="Senior API engineer" />);
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['resume'], 'candidate.pdf')] },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.getByText('Highest score in this comparison')).toBeInTheDocument());
    expect(screen.queryByText('Best Match')).not.toBeInTheDocument();
    expect(screen.queryByText('Coverage')).not.toBeInTheDocument();
    expect(screen.getAllByText('This assessment does not predict a hiring decision.').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Export Report' }));
    await waitFor(() => expect(mockPdfSave).toHaveBeenCalledTimes(1));
    const { default: autoTable } = await import('jspdf-autotable');
    expect(vi.mocked(autoTable).mock.calls[0][1].body[0][4]).toBe('Highest score in this comparison');
    expect(mockPdfText.mock.calls.map(call => String(call[0])).join(' '))
      .toContain('This assessment does not predict a hiring decision.');
  });

  it('requires a historical context selection and prints its saved JD rather than the live JD', async () => {
    const resumeText = 'Candidate with API work';
    const makeRow = async (id: string, jobSnapshot: string, score: number) => {
      const context = await createAssessmentContext({ resumeText, jobDescription: jobSnapshot,
        language: 'en', kind: 'match', isOptimized: false, rubricVersion: 'match-v1' });
      const analysis = { score, topHits: ['API'], missingKeywords: [] };
      return { id, name: `${id}.pdf`, status: 'completed', plainText: resumeText, analysis,
        assessment: { context, jobSnapshot, requestId: id, createdAt: '2026-09-26T00:00:00Z', result: analysis } };
    };
    window.localStorage.setItem('watheq:bulkAnalysis', JSON.stringify([
      await makeRow('old', 'Historical API role', 80),
      await makeRow('new', 'Current data role', 50),
      { id: 'legacy', name: 'legacy.pdf', status: 'completed', plainText: resumeText,
        analysis: { score: 95 }, file: null },
    ]));
    render(<BulkAnalysisSection jobDescription="Current data role" />);
    const selector = await screen.findByRole('combobox', { name: 'Report assessment' });
    expect(screen.getByRole('button', { name: 'Export Report' })).toBeDisabled();
    expect(screen.getByText('Previous assessment')).toBeInTheDocument();
    expect(screen.getByText('Legacy assessment')).toBeInTheDocument();
    fireEvent.change(selector, { target: { value: (selector as HTMLSelectElement).options[1].value } });
    fireEvent.click(screen.getByRole('button', { name: 'Export Report' }));
    await waitFor(() => expect(mockPdfSave).toHaveBeenCalledTimes(1));
    const pdfText = mockPdfText.mock.calls.map(call => String(call[0])).join(' ');
    expect(pdfText).toContain('Historical assessment');
    expect(pdfText).toContain('Historical API role');
    expect(pdfText).not.toContain('Current data role');
  });

  it('exports Arabic report labels from the saved assessment while the live language is English', async () => {
    const resumeText = 'عملت على التقارير الداخلية';
    const jobSnapshot = 'محلل بيانات';
    const context = await createAssessmentContext({ resumeText, jobDescription: jobSnapshot,
      language: 'ar', kind: 'match', isOptimized: false, rubricVersion: 'match-v1' });
    const analysis = { score: 20, topHits: [], missingKeywords: [],
      strategicRealityCheck: { summary: 'تحتاج الخبرة إلى دليل إضافي.' } };
    window.localStorage.setItem('watheq:bulkAnalysis', JSON.stringify([{
      id: 'arabic', name: 'سيرة.pdf', status: 'completed', plainText: resumeText, analysis,
      assessment: { context, jobSnapshot, requestId: 'saved-ar',
        createdAt: '2026-09-26T00:00:00Z', result: analysis },
    }]));
    render(<BulkAnalysisSection jobDescription="Live English role" />);
    expect(await screen.findByText('Previous assessment')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Export Report' }));
    await waitFor(() => expect(mockPdfSave).toHaveBeenCalledTimes(1));
    const { default: autoTable } = await import('jspdf-autotable');
    const table = vi.mocked(autoTable).mock.calls[0][1];
    expect(table.head[0]).toEqual(['الترتيب', 'اسم السيرة الذاتية', 'تقدير التوافق مع هذا الوصف الوظيفي',
      'الكلمات المفتاحية', 'الترتيب النسبي']);
    expect(table.body[0][4]).toBe('أعلى درجة في هذه المقارنة');
    const pdfText = mockPdfText.mock.calls.map(call => String(call[0])).join(' ');
    expect(pdfText).toContain('تقرير مقارنة السير الذاتية');
    expect(pdfText).toContain('أُنشئ في');
    expect(pdfText).toContain('تقييم سابق');
    expect(pdfText).toContain('ملخص الوصف الوظيفي:');
    expect(pdfText).toContain('هذا التقييم لا يتنبأ بقرار التوظيف.');
    expect(pdfText).toContain('تحتاج الخبرة إلى دليل إضافي.');
    expect(pdfText).toContain('ملخص الأدلة والمخاطر:');
    expect(pdfText).not.toContain('This assessment does not predict a hiring decision.');
  });

  it('ignores a late network response after the job changes', async () => {
    let resolveResponse!: (value: { ok: boolean; status: number; json: () => Promise<unknown> }) => void;
    mockParseResume.mockResolvedValue({ plainText: 'Candidate for an API role' });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(resolve => { resolveResponse = resolve; }));
    const { container, rerender } = render(<BulkAnalysisSection jobDescription="API role" />);
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['resume'], 'candidate.pdf')] },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    rerender(<BulkAnalysisSection jobDescription="Data role" />);
    await act(async () => resolveResponse({ ok: true, status: 200,
      json: () => Promise.resolve({ score: 91, strongMatches: [], missingKeywords: [] }) }));
    expect(screen.queryByText('91%')).not.toBeInTheDocument();
    expect(screen.queryByText('Detailed Comparison')).not.toBeInTheDocument();
  });

  it('invalidates an in-flight request when all rows are cleared', async () => {
    let resolveResponse!: (value: { ok: boolean; status: number; json: () => Promise<unknown> }) => void;
    mockParseResume.mockResolvedValue({ plainText: 'Candidate for an API role' });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(resolve => { resolveResponse = resolve; }));
    const { container } = render(<BulkAnalysisSection jobDescription="API role" />);
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['resume'], 'candidate.pdf')] },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
    await act(async () => resolveResponse({ ok: true, status: 200,
      json: () => Promise.resolve({ score: 91, strongMatches: [], missingKeywords: [] }) }));
    const context = await createAssessmentContext({ resumeText: 'Candidate for an API role',
      jobDescription: 'API role', language: 'en', kind: 'match', isOptimized: false, rubricVersion: 'match-v1' });
    expect(useResumeStore.getState().getCachedAssessment(context)).toBeNull();
    expect(screen.queryByText('91%')).not.toBeInTheDocument();
  });

  it('keeps a restored row legacy when its visible score differs from the saved assessment result', async () => {
    const resumeText = 'Candidate for an API role';
    const jobDescription = 'API role';
    const context = await createAssessmentContext({ resumeText, jobDescription,
      language: 'en', kind: 'match', isOptimized: false, rubricVersion: 'match-v1' });
    window.localStorage.setItem('watheq:bulkAnalysis', JSON.stringify([{
      id: 'mismatch', name: 'mismatch.pdf', status: 'completed', plainText: resumeText,
      analysis: { score: 99, missingKeywords: [] }, assessment: { context, jobSnapshot: jobDescription,
        requestId: 'saved-request', createdAt: '2026-09-26T00:00:00Z',
        result: { score: 32, missingKeywords: [] } },
    }]));
    render(<BulkAnalysisSection jobDescription={jobDescription} />);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(screen.getByText('Legacy assessment')).toBeInTheDocument();
    expect(screen.queryByText('Detailed Comparison')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Report' })).toBeDisabled();
  });
});
