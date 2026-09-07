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
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) =>
      typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../components/ui/GlassCard', () => ({
  GlassCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/ui/GlassButton', () => ({
  GlassButton: ({ children, ...props }: { children: ReactNode }) => <button {...props}>{children}</button>,
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
const mockSetFeedState = vi.fn();
const mockListFeedState = vi.fn();

vi.mock('@/services/jobFeed', () => ({
  listTrackedCompanies: () => Promise.resolve({ companies: [company], error: null }),
  listOpenPostings: () => Promise.resolve({ postings: [posting()], error: null }),
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

describe('the role-coverage badge explains itself on touch', () => {
  it('reveals the explanation when the badge is tapped', async () => {
    render(<JobFeedSection />);

    // The `t` mock returns the key when given interpolation options, so the badge's
    // accessible name and its explanation are matched by key here.
    const badge = await screen.findByRole('button', { name: 'jobFeed.why.coverage' });
    expect(badge).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('jobFeed.why.coverageHint')).toBeNull();

    fireEvent.click(badge);

    expect(badge).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('jobFeed.why.coverageHint')).toBeInTheDocument();

    // Tapping again closes it, so one row's explanation cannot get stuck open.
    fireEvent.click(badge);
    expect(screen.queryByText('jobFeed.why.coverageHint')).toBeNull();
  });
});
