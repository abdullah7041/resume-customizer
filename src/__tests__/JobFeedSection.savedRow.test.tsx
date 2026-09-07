import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

/**
 * Saving a job to the pipeline used to delete it from the feed.
 *
 * The feed was built as `postings.filter((p) => !feedState.has(p.id))`, which drops a
 * posting for ANY feed state — and a save writes `saved`. So "Save to pipeline" hid
 * the row exactly the way "Not interested" did, taking the apply link with it.
 *
 * Also covered here: the difference between a failed READ and a posting that
 * genuinely has no description. getPostingDescription used to return "" for both,
 * so refusing on "" made every Workday posting (ats/workday.ts publishes no body at
 * all) permanently unsaveable behind a "try again in a moment" that could never
 * succeed. It returns null for a read failure now, and only that is refused.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Interpolates like i18next does, so assertions can read the real sentence
    // instead of a bare key — the whole point of this round was the copy.
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
      if (typeof fallbackOrOptions === 'string') return fallbackOrOptions;
      const options = fallbackOrOptions ?? {};
      const template = typeof options.defaultValue === 'string' ? options.defaultValue : key;
      return template.replace(/\{\{(\w+)\}\}/g, (_m: string, name: string) =>
        options[name] === undefined ? `{{${name}}}` : String(options[name]),
      );
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('../components/ui/GlassCard', () => ({
  GlassCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/ui/GlassButton', () => ({
  // Mirrors the real GlassButton's contract: isLoading ORs into disabled and is
  // consumed rather than spread onto the DOM node. Without this a test asserting
  // a pending button is disabled would be asserting against the mock, not the app.
  GlassButton: ({ children, isLoading, disabled, ...props }: { children: ReactNode; isLoading?: boolean; disabled?: boolean }) => (
    <button {...props} disabled={disabled || isLoading}>{children}</button>
  ),
}));

const SENIOR_INTENT = {
  targetRoles: ['Senior AI Engineer'],
  seniority: 'senior' as const,
  meta: { confidence: 'high' as const, completeness: 100, updatedAt: '2026-08-29T00:00:00.000Z' },
};

vi.mock('@/lib/stores/resumeStore', () => ({
  useSearchIntent: () => SENIOR_INTENT,
  useActiveResume: () => null,
  useResumeStore: {
    getState: () => ({ setSearchIntent: vi.fn(), searchIntent: SENIOR_INTENT }),
  },
}));

const mockCreateJobApplication = vi.fn();
vi.mock('@/services/pipeline', () => ({
  createJobApplication: (input: unknown) => mockCreateJobApplication(input),
}));

const mockGetPostingDescription = vi.fn();
const mockListOpenPostings = vi.fn();
const mockSetFeedState = vi.fn();
const mockListFeedState = vi.fn();

vi.mock('@/services/jobFeed', () => ({
  listTrackedCompanies: () => Promise.resolve({ companies: [company], error: null }),
  listOpenPostings: () => mockListOpenPostings(),
  listFeedState: () => mockListFeedState(),
  readLastFeedSeenAt: () => Promise.resolve(null),
  fetchServerSearchIntent: () => Promise.resolve(null),
  touchLastFeedSeenAt: () => Promise.resolve(),
  getPostingDescription: (id: string) => mockGetPostingDescription(id),
  resolveCompany: vi.fn(),
  trackCompany: vi.fn(),
  untrackCompany: vi.fn(),
  recrawlTrackedCompanies: () => Promise.resolve({ data: { dispatched: 0, skipped: 0, crawlDispatched: false }, error: null }),
  saveSearchIntent: () => Promise.resolve({ error: null }),
  setFeedState: (id: string, state: string) => mockSetFeedState(id, state),
}));

import { JobFeedSection } from '../components/sections/JobFeedSection';

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

function posting(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    companyId: 'c1',
    companyName: 'Salla',
    title: 'Senior AI Engineer',
    location: 'Riyadh, Saudi Arabia',
    applyUrl: 'https://apply.workable.com/salla/j/ABC/',
    postedAt: daysAgo(2),
    firstSeenAt: daysAgo(2),
    ...overrides,
  };
}

const company = {
  companyId: 'c1',
  displayName: 'Salla',
  source: 'workable',
  token: 'salla',
  trackedSince: daysAgo(30),
  lastFetchedAt: daysAgo(1),
  lastStatus: 'ok' as const,
  lastJobCount: 28,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockListFeedState.mockResolvedValue(new Map());
  mockListOpenPostings.mockResolvedValue({ postings: [posting()], error: null });
  mockGetPostingDescription.mockResolvedValue('We are hiring a senior AI engineer in Riyadh.');
  mockCreateJobApplication.mockResolvedValue({ data: { id: 'job-1' }, error: null });
});

describe('saving a feed row to the pipeline', () => {
  it('keeps the row in the feed and marks it saved', async () => {
    render(<JobFeedSection />);

    const save = await screen.findByRole('button', { name: 'Save to pipeline' });
    fireEvent.click(save);

    await waitFor(() => expect(mockSetFeedState).toHaveBeenCalledWith('p1', 'saved'));

    // The job is still readable in the feed, with its apply link intact.
    expect(screen.getByText('Senior AI Engineer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view posting/i })).toHaveAttribute(
      'href',
      'https://apply.workable.com/salla/j/ABC/',
    );

    // ...and it now says what happened, instead of re-offering the same action.
    expect(await screen.findByText('Saved to pipeline')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save to pipeline' })).toBeNull();
  });

  it('sends the full posting — description, apply URL and location', async () => {
    render(<JobFeedSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Save to pipeline' }));

    await waitFor(() => expect(mockCreateJobApplication).toHaveBeenCalledTimes(1));
    expect(mockCreateJobApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        company_name: 'Salla',
        job_title: 'Senior AI Engineer',
        job_description: 'We are hiring a senior AI engineer in Riyadh.',
        job_url: 'https://apply.workable.com/salla/j/ABC/',
        location: 'Riyadh, Saudi Arabia',
        status: 'saved',
      }),
    );
  });

  it('refuses to save when the description READ fails', async () => {
    mockGetPostingDescription.mockResolvedValue(null);
    render(<JobFeedSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Save to pipeline' }));

    await waitFor(() =>
      expect(
        screen.getByText(/Could not read that job description/i),
      ).toBeInTheDocument(),
    );
    expect(mockCreateJobApplication).not.toHaveBeenCalled();
    expect(mockSetFeedState).not.toHaveBeenCalled();
  });

  it('saves a posting whose board publishes no description at all', async () => {
    // Workday sets description: '' for EVERY posting and Workable falls back to it.
    // Treating that as a failure made those jobs impossible to track, forever.
    mockGetPostingDescription.mockResolvedValue('');
    render(<JobFeedSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Save to pipeline' }));

    await waitFor(() => expect(mockCreateJobApplication).toHaveBeenCalledTimes(1));
    expect(mockCreateJobApplication).toHaveBeenCalledWith(
      expect.objectContaining({ job_title: 'Senior AI Engineer', job_description: '' }),
    );
    await waitFor(() => expect(mockSetFeedState).toHaveBeenCalledWith('p1', 'saved'));
    expect(screen.queryByText(/Could not read that job description/i)).toBeNull();
  });

  it('still hides a row that was dismissed', async () => {
    mockListFeedState.mockResolvedValue(new Map([['p1', 'dismissed']]));
    render(<JobFeedSection />);

    await waitFor(() => expect(screen.queryByText('Senior AI Engineer')).toBeNull());
  });

  it('shows a previously saved row on reload, already marked', async () => {
    mockListFeedState.mockResolvedValue(new Map([['p1', 'saved']]));
    render(<JobFeedSection />);

    expect(await screen.findByText('Senior AI Engineer')).toBeInTheDocument();
    expect(screen.getByText('Saved to pipeline')).toBeInTheDocument();
  });
});

describe('the row explains its own match, in words', () => {
  it('states what matched without a control to decode', async () => {
    // This replaced a 40px "1/3" circle whose meaning lived in a tooltip and an
    // aria-label — neither reachable by a sighted touch user, and the bare fraction
    // sat exactly where a match score would go.
    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    expect(
      screen.getByText(/Title uses 2 of 2 words from your target role "Senior AI Engineer": ai, engineer/),
    ).toBeInTheDocument();

    // Nothing left to tap, and no naked fraction anywhere on the row.
    expect(screen.queryByText('2/2')).toBeNull();
    expect(screen.queryByRole('button', { name: /words from your target role/i })).toBeNull();
  });

  it('separates a full role match from a partial one, in the numbers', async () => {
    // "Senior AI Engineer" derives the terms ai + engineer — senior is a level word,
    // not a function. A title carrying only one of them must say 1 of 2, and must
    // list only the term it actually matched.
    mockListOpenPostings.mockResolvedValue({
      postings: [posting({ title: 'Senior Engineer' })],
      error: null,
    });

    render(<JobFeedSection />);
    await screen.findByText('Senior Engineer');

    expect(
      screen.getByText(/Title uses 1 of 2 words from your target role "Senior AI Engineer": engineer/),
    ).toBeInTheDocument();
  });
});

describe('the row buttons say when they are working', () => {
  /**
   * Both handlers await a description fetch and then a second round trip. Without a
   * pending state the button sat inert for seconds and the press read as ignored —
   * the reported "it lags then saves".
   */
  const deferred = () => {
    let release: (value: string) => void = () => {};
    const promise = new Promise<string>((resolve) => { release = resolve; });
    return { promise, release };
  };

  it('shows Save as pending for the whole round trip, then settles', async () => {
    const gate = deferred();
    mockGetPostingDescription.mockReturnValue(gate.promise);
    render(<JobFeedSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Save to pipeline' }));

    const pending = await screen.findByRole('button', { name: 'Saving…' });
    expect(pending).toBeDisabled();

    gate.release('We are hiring a senior AI engineer in Riyadh.');

    await waitFor(() => expect(screen.getByText('Saved to pipeline')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Saving…' })).toBeNull();
  });

  it('clears the Save pending state when the read fails', async () => {
    // try/finally, not the bare set-then-clear used elsewhere in this file: a failure
    // must not strand the button in a spinner forever.
    mockGetPostingDescription.mockResolvedValue(null);
    render(<JobFeedSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Save to pipeline' }));

    await waitFor(() =>
      expect(screen.getByText(/Could not read that job description/i)).toBeInTheDocument(),
    );
    expect(await screen.findByRole('button', { name: 'Save to pipeline' })).toBeEnabled();
  });

  it('shows Check the match as pending while it fetches', async () => {
    const gate = deferred();
    mockGetPostingDescription.mockReturnValue(gate.promise);
    const onMatchPosting = vi.fn();
    render(<JobFeedSection onMatchPosting={onMatchPosting} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Check the match' }));

    expect(await screen.findByRole('button', { name: 'Opening…' })).toBeDisabled();

    gate.release('We are hiring a senior AI engineer in Riyadh.');

    await waitFor(() => expect(onMatchPosting).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: 'Check the match' })).toBeEnabled();
  });

  it('reports a failed READ on the match path, not "no description"', async () => {
    // handleMatch used to do `description ?? ''`, so a Supabase error was reported as
    // "that posting has no description" and sent the user off to paste text that does
    // in fact exist.
    mockGetPostingDescription.mockResolvedValue(null);
    const onMatchPosting = vi.fn();
    render(<JobFeedSection onMatchPosting={onMatchPosting} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Check the match' }));

    await waitFor(() =>
      expect(screen.getByText(/Could not read that job description/i)).toBeInTheDocument(),
    );
    expect(onMatchPosting).not.toHaveBeenCalled();
  });

  it('hands an empty description through, letting the parent decide', async () => {
    // '' is a board that publishes no body (Workday always). That is the parent's
    // call to explain, not a read failure.
    mockGetPostingDescription.mockResolvedValue('');
    const onMatchPosting = vi.fn();
    render(<JobFeedSection onMatchPosting={onMatchPosting} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Check the match' }));

    await waitFor(() => expect(onMatchPosting).toHaveBeenCalledTimes(1));
    expect(onMatchPosting).toHaveBeenCalledWith(
      expect.objectContaining({ jobDescription: '', jobTitle: 'Senior AI Engineer' }),
    );
    expect(screen.queryByText(/Could not read that job description/i)).toBeNull();
  });
});
