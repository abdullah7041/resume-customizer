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

// Every analytics method resolves to a stable spy. The hand-listed mock broke as soon
// as these tests rendered in guest mode and the component reached the guest-run
// telemetry — a missing stub should never fail a behaviour test.
vi.mock('../services/analytics', () => {
  const spies = new Map();
  return {
    analytics: new Proxy({}, {
      get: (_target, prop) => {
        if (typeof prop !== 'string') return undefined;
        if (!spies.has(prop)) spies.set(prop, vi.fn());
        return spies.get(prop);
      },
    }),
  };
});

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
    renderWithProviders(<MatchSection isGuestMode onAnalyzeMatchAI={onAnalyzeMatchAI} matchAnalysis={null} hasResume onClear={vi.fn()} />);
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
    renderWithProviders(<MatchSection isGuestMode onAnalyzeMatchAI={onAnalyzeMatchAI} matchAnalysis={null} hasResume onClear={vi.fn()} />);
    typeJob();

    fireEvent.click(screen.getByRole('button', { name: analyzeButtonName }));
    await waitFor(() => expect(window.localStorage.getItem(FREE_MATCH_KEY)).toBe('2'));
    fireEvent.click(screen.getByRole('button', { name: analyzeButtonName }));
    await waitFor(() => expect(window.localStorage.getItem(FREE_MATCH_KEY)).toBe('3'));

    fireEvent.click(screen.getByRole('button', { name: analyzeButtonName }));
    expect(onAnalyzeMatchAI).toHaveBeenCalledTimes(2);
  });
});

describe('MatchSection signed-in users never take the guest free-run path', () => {
  it('replaces the job editor text when the active resume context changes', () => {
    const common = { onAnalyzeMatchAI: vi.fn(), matchAnalysis: null, hasResume: true, onClear: vi.fn() };
    const view = renderWithProviders(<MatchSection {...common} resumeContextKey="a:one" jobDescription="A job description" />);
    expect(document.getElementById('jobDescription')).toHaveValue('A job description');
    view.rerender(<DirectionProvider><MatchSection {...common} resumeContextKey="b:two" jobDescription="" /></DirectionProvider>);
    expect(document.getElementById('jobDescription')).toHaveValue('');
    view.rerender(<DirectionProvider><MatchSection {...common} resumeContextKey="a:one" jobDescription="A job description" /></DirectionProvider>);
    expect(document.getElementById('jobDescription')).toHaveValue('A job description');
  });

  /**
   * Regression cover for Sentry JAVASCRIPT-REACT-1H.
   *
   * The free-run counter is per-browser localStorage and knows nothing about auth, so
   * a signed-in user with an empty counter was sent down the guest path with
   * `freePreview: true`. The server's guest limiter then answered a paying customer
   * with 429 `guest/free-preview-used` — "You've used your free preview for this
   * feature. Please sign in to continue." — and because no analysis ran, no credit was
   * consumed. Both reported symptoms, one missing check.
   */
  it('shows the credit price and asks for confirmation even with zero free runs used', async () => {
    const onAnalyzeMatchAI = vi.fn().mockResolvedValue({ score: 70 });
    renderWithProviders(<MatchSection onAnalyzeMatchAI={onAnalyzeMatchAI} matchAnalysis={null} hasResume onClear={vi.fn()} />);
    typeJob();

    // The counter is empty — under the old gate this alone bought a free run.
    expect(window.localStorage.getItem(FREE_MATCH_KEY)).toBeNull();
    expect(screen.getByText(/2 credits/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: analyzeButtonName }));

    await waitFor(() => expect(screen.getByRole('button', { name: analyzeButtonName })).toBeInTheDocument());
    expect(onAnalyzeMatchAI).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ freePreview: true }),
    );
    expect(window.localStorage.getItem(FREE_MATCH_KEY)).toBeNull();
  });
});
