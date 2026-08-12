import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectionProvider } from '../components/providers/DirectionProvider';
import { MatchSection } from '../components/sections/MatchSection';

const FREE_MATCH_KEY = 'watheq:freeMatchRuns';
const FREE_MATCH_LEGACY_KEY = 'watheq:freeMatchUsed';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => typeof options === 'string' ? options || key : options?.defaultValue || key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../services/analytics', () => ({
  analytics: {
    track: vi.fn(),
    trackJobDescriptionSubmitted: vi.fn(),
    trackMatchAnalysisStarted: vi.fn(),
    trackMatchAnalysisSuccess: vi.fn(),
    trackMatchAnalysisFailed: vi.fn(),
    trackStrategicRealityCheck: vi.fn(),
  },
}));

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

const renderWithProviders = (ui) => render(<DirectionProvider>{ui}</DirectionProvider>);
const analyzeButtonName = /analyze match with ai/i;

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

const typeJob = () => {
  fireEvent.change(document.getElementById('jobDescription'), {
    target: { value: 'We need a backend engineer with Node.js experience.' },
  });
};

describe('MatchSection guest free-run counter', () => {
  it('allows three free successful runs, then shows the paid confirmation path', async () => {
    const onAnalyzeMatchAI = vi.fn().mockResolvedValue({ score: 70 });
    renderWithProviders(<MatchSection onAnalyzeMatchAI={onAnalyzeMatchAI} matchAnalysis={null} hasResume onClear={vi.fn()} />);
    typeJob();

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      fireEvent.click(screen.getByRole('button', { name: analyzeButtonName }));
      await waitFor(() => expect(onAnalyzeMatchAI).toHaveBeenCalledTimes(attempt));
      expect(onAnalyzeMatchAI).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ freePreview: true }));
      await waitFor(() => expect(window.localStorage.getItem(FREE_MATCH_KEY)).toBe(String(attempt)));
    }

    fireEvent.click(screen.getByRole('button', { name: analyzeButtonName }));
    expect(onAnalyzeMatchAI).toHaveBeenCalledTimes(3);
    expect(screen.getByText(/2 credits/i)).toBeInTheDocument();
  });

  it('counts the legacy boolean as one completed free run', async () => {
    window.localStorage.setItem(FREE_MATCH_LEGACY_KEY, 'true');
    const onAnalyzeMatchAI = vi.fn().mockResolvedValue({ score: 70 });
    renderWithProviders(<MatchSection onAnalyzeMatchAI={onAnalyzeMatchAI} matchAnalysis={null} hasResume onClear={vi.fn()} />);
    typeJob();

    fireEvent.click(screen.getByRole('button', { name: analyzeButtonName }));
    await waitFor(() => expect(window.localStorage.getItem(FREE_MATCH_KEY)).toBe('2'));
    fireEvent.click(screen.getByRole('button', { name: analyzeButtonName }));
    await waitFor(() => expect(window.localStorage.getItem(FREE_MATCH_KEY)).toBe('3'));

    fireEvent.click(screen.getByRole('button', { name: analyzeButtonName }));
    expect(onAnalyzeMatchAI).toHaveBeenCalledTimes(2);
  });
});
