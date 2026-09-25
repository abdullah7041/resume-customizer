import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectionProvider } from '../components/providers/DirectionProvider';
import { MatchSection } from '../components/sections/MatchSection';

const FREE_MATCH_KEY = 'watheq:freeMatchRuns';
const FREE_MATCH_LEGACY_KEY = 'watheq:freeMatchUsed';
const language = vi.hoisted(() => ({ current: 'en' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => typeof options === 'string' ? options || key : options?.defaultValue || key,
    i18n: { language: language.current, changeLanguage: vi.fn() },
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

beforeEach(() => {
  window.localStorage.clear();
  language.current = 'en';
});
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
  it('counts only a fresh preview, not a cached result for the same job', async () => {
    const onAnalyzeMatchAI = vi.fn()
      .mockResolvedValueOnce({ score: 70, origin: 'guest_preview' })
      .mockResolvedValueOnce({ score: 70, origin: 'guest_preview', reusedFromCache: true });
    renderWithProviders(<MatchSection isGuestMode onAnalyzeMatchAI={onAnalyzeMatchAI}
      matchAnalysis={null} hasResume onClear={vi.fn()} />);
    typeJob();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: analyzeButtonName }));
    });
    expect(window.localStorage.getItem(FREE_MATCH_KEY)).toBe('1');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: analyzeButtonName }));
    });
    expect(onAnalyzeMatchAI).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem(FREE_MATCH_KEY)).toBe('1');
  });

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

  it('reports draft edits immediately so the parent can invalidate an in-flight assessment', () => {
    const onJobDescriptionChange = vi.fn();
    renderWithProviders(<MatchSection onAnalyzeMatchAI={vi.fn()} matchAnalysis={null} hasResume
      onJobDescriptionChange={onJobDescriptionChange} onClear={vi.fn()} />);
    typeJob();
    expect(onJobDescriptionChange).toHaveBeenLastCalledWith('We need a backend engineer with Node.js experience.');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onJobDescriptionChange).toHaveBeenLastCalledWith('');
  });

  it('reuses a saved paid result without showing another credit confirmation', async () => {
    const job = 'We need a backend engineer with Node.js experience.';
    window.localStorage.setItem('watheq:lastJobDescription', job);
    const onAnalyzeMatchAI = vi.fn().mockResolvedValue({ score: 72, origin: 'paid' });
    renderWithProviders(<MatchSection onAnalyzeMatchAI={onAnalyzeMatchAI} matchAnalysis={{ score: 72, origin: 'paid' }}
      jobDescription={job} hasResume onClear={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'View/edit' }));
    expect(screen.queryByText(/2 credits/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View saved analysis' }));
    await waitFor(() => expect(onAnalyzeMatchAI).toHaveBeenCalledTimes(1));
    expect(onAnalyzeMatchAI).toHaveBeenCalledWith(job, expect.objectContaining({ importedCriteria: null }));
  });

  it('keeps a legacy result inspectable without presenting it as the active match', () => {
    renderWithProviders(<MatchSection onAnalyzeMatchAI={vi.fn()} matchAnalysis={null}
      historicalMatch={{ status: 'legacy', result: { score: 29, reasoning: 'Old explanation' } }}
      hasResume onClear={vi.fn()} />);
    expect(screen.getByText('Previous analysis — its inputs were not recorded')).toBeInTheDocument();
    fireEvent.click(screen.getByText('View previous result'));
    expect(screen.getByText('Old explanation')).toBeInTheDocument();
    expect(document.getElementById('jobDescription')).toBeInTheDocument();
  });

  it('discloses that requirements beyond the Match prompt limit are not evaluated', () => {
    const longJob = `${'a'.repeat(5000)}later requirement`;
    window.localStorage.setItem('watheq:lastJobDescription', longJob);
    renderWithProviders(<MatchSection onAnalyzeMatchAI={vi.fn()} matchAnalysis={null}
      jobDescription={longJob} hasResume onClear={vi.fn()} />);
    expect(screen.getByRole('note')).toHaveTextContent('Later requirements were not evaluated');
  });

  it('discloses omitted resume content in English and Arabic', () => {
    const longResume = 'a'.repeat(15001);
    const props = { onAnalyzeMatchAI: vi.fn(), matchAnalysis: null, resumeText: longResume,
      hasResume: true, onClear: vi.fn() };
    const { rerender } = renderWithProviders(<MatchSection {...props} />);
    expect(screen.getByRole('note')).toHaveTextContent('Later resume content was not evaluated');
    language.current = 'ar';
    rerender(<DirectionProvider><MatchSection {...props} /></DirectionProvider>);
    expect(screen.getByRole('note')).toHaveTextContent('المحتوى الذي يلي ذلك لم يدخل في التقييم');
  });

  it('adopts a new parent job while preserving local typing across unchanged parent renders', () => {
    const onJobDescriptionChange = vi.fn();
    const props = { onAnalyzeMatchAI: vi.fn(), matchAnalysis: null, hasResume: true,
      onJobDescriptionChange, onClear: vi.fn() };
    const { rerender } = renderWithProviders(<MatchSection {...props} jobDescription="Role A" />);
    expect(document.getElementById('jobDescription')).toHaveValue('Role A');
    fireEvent.change(document.getElementById('jobDescription'), { target: { value: 'Draft typed by candidate' } });
    rerender(<DirectionProvider><MatchSection {...props} jobDescription="Role A" /></DirectionProvider>);
    expect(document.getElementById('jobDescription')).toHaveValue('Draft typed by candidate');
    rerender(<DirectionProvider><MatchSection {...props} jobDescription="Role B from parent" /></DirectionProvider>);
    expect(document.getElementById('jobDescription')).toHaveValue('Role B from parent');
    expect(onJobDescriptionChange).toHaveBeenCalledWith('Draft typed by candidate');
    expect(onJobDescriptionChange).not.toHaveBeenCalledWith('Role B from parent');
  });
});
