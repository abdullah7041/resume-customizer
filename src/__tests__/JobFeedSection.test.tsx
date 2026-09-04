import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';

// A fresh `t` per render, which is what react-i18next does in production when the
// i18n instance emits load events. Anything that puts `t` in an effect dependency
// list loops forever against this mock — which is exactly what shipped once.
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

const mockSearchIntent = vi.fn();
const mockActiveResume = vi.fn();
const mockSetSearchIntent = vi.fn();

vi.mock('@/lib/stores/resumeStore', () => ({
  useSearchIntent: () => mockSearchIntent(),
  useActiveResume: () => mockActiveResume(),
  // getState() is read back after a write, so it answers from the same source the
  // hook does — an inert setter would let a test pass while the feed never moved.
  useResumeStore: {
    getState: () => ({ setSearchIntent: mockSetSearchIntent, searchIntent: mockSearchIntent() }),
  },
}));

vi.mock('@/services/pipeline', () => ({ createJobApplication: vi.fn() }));

const mockListTracked = vi.fn();
const mockListPostings = vi.fn();
const mockTrackCompany = vi.fn();
const mockUntrackCompany = vi.fn();
const mockResolveCompany = vi.fn();
const mockSaveSearchIntent = vi.fn();

vi.mock('@/services/jobFeed', () => ({
  listTrackedCompanies: () => mockListTracked(),
  listOpenPostings: () => mockListPostings(),
  listFeedState: () => Promise.resolve(new Map()),
  readLastFeedSeenAt: () => Promise.resolve(null),
  fetchServerSearchIntent: () => Promise.resolve(null),
  touchLastFeedSeenAt: () => Promise.resolve(),
  getPostingDescription: () => Promise.resolve(''),
  resolveCompany: (query: string) => mockResolveCompany(query),
  trackCompany: (input: unknown) => mockTrackCompany(input),
  untrackCompany: (id: string) => mockUntrackCompany(id),
  saveSearchIntent: (intent: unknown) => mockSaveSearchIntent(intent),
  setFeedState: vi.fn(),
}));

import { JobFeedSection } from '../components/sections/JobFeedSection';

const SENIOR_INTENT = {
  targetRoles: ['Senior AI Engineer'],
  seniority: 'senior' as const,
  meta: { confidence: 'high' as const, completeness: 100, updatedAt: '2026-08-29T00:00:00.000Z' },
};

// Dates are relative on purpose: the feed now defaults to a seven-day window, so
// a fixture pinned to a calendar date ages out of its own test suite.
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
  mockSearchIntent.mockReturnValue(SENIOR_INTENT);
  mockActiveResume.mockReturnValue(null);
  mockListTracked.mockResolvedValue({ companies: [], error: null });
  mockListPostings.mockResolvedValue({ postings: [], error: null });
  mockTrackCompany.mockResolvedValue({ data: null, error: null });
  mockResolveCompany.mockResolvedValue({ data: null, error: null });
  mockUntrackCompany.mockResolvedValue({ data: null, error: null });
  mockSaveSearchIntent.mockResolvedValue({ error: null });
});

describe('Saudi starter companies', () => {
  it('offers verified Saudi employers before the user has followed anything', async () => {
    render(<JobFeedSection />);

    expect(await screen.findByRole('button', { name: 'Salla' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tabby' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lean Technologies' })).toBeInTheDocument();
  });

  it('tracks a starter directly instead of probing every provider for its name', async () => {
    render(<JobFeedSection />);

    const salla = await screen.findByRole('button', { name: 'Salla' });
    fireEvent.click(salla);

    await waitFor(() =>
      expect(mockTrackCompany).toHaveBeenCalledWith({
        source: 'workable',
        token: 'salla',
        displayName: 'Salla',
      }),
    );
    // The handle is already known, so nothing should fan out across the boards.
    expect(mockResolveCompany).not.toHaveBeenCalled();
  });

  it('stops offering a company once it is followed, and keeps offering the rest', async () => {
    // Discovery must survive the first follow — the chips live in the add-company
    // card, not the empty state, so they do not vanish the moment a user starts.
    mockListTracked.mockResolvedValue({
      companies: [{ ...company, token: 'salla' }],
      error: null,
    });

    render(<JobFeedSection />);

    expect(await screen.findByRole('button', { name: 'Tabby' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salla' })).not.toBeInTheDocument();
  });
});

describe('starter chips that lead nowhere today', () => {
  it('does not offer an empty board under the same promise as a hiring one', async () => {
    // Seven of the thirteen starters are readable accounts with nothing posted.
    // Offered identically, tapping one means a wait and then an empty feed, which
    // a user cannot tell apart from a broken feature.
    render(<JobFeedSection />);

    expect(await screen.findByText('Saudi employers we can read')).toBeInTheDocument();
    expect(screen.getByText('Readable boards with nothing posted')).toBeInTheDocument();
  });

  it('still lets an empty board be followed, so its first role arrives', async () => {
    render(<JobFeedSection />);

    const jahez = await screen.findByRole('button', { name: 'Jahez' });
    fireEvent.click(jahez);

    await waitFor(() =>
      expect(mockTrackCompany).toHaveBeenCalledWith({
        source: 'workable',
        token: 'jahez',
        displayName: 'Jahez',
      }),
    );
  });
});

describe('JobFeedSection empty states', () => {
  it('asks for a company when none are followed', async () => {
    render(<JobFeedSection />);
    expect(await screen.findByText('Follow a company to start seeing roles.')).toBeInTheDocument();
  });

  it('offers past employers from the CV as one-tap starting points', async () => {
    mockActiveResume.mockReturnValue({
      work: [{ name: 'Salla' }, { name: 'Tabby' }, { name: 'Salla' }],
    });

    render(<JobFeedSection />);

    expect(await screen.findByRole('button', { name: 'Salla' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tabby' })).toBeInTheDocument();
    // Deduplicated, so the repeated employer is offered once.
    expect(screen.getAllByRole('button', { name: 'Salla' })).toHaveLength(1);
  });

  it('routes to setting a target role rather than showing a blank list', async () => {
    mockSearchIntent.mockReturnValue(null);
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);

    expect(await screen.findByText('Set your target role first.')).toBeInTheDocument();
  });

  it('says which rule emptied the feed when everything is filtered out', async () => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({
      postings: [posting({ id: 'dubai', location: 'Dubai, UAE' })],
      error: null,
    });

    render(<JobFeedSection />);

    expect(await screen.findByText('Nothing matched today.')).toBeInTheDocument();
  });
});

describe('JobFeedSection feed rows', () => {
  beforeEach(() => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
  });

  it('shows the company and a deterministic reason', async () => {
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);

    expect(await screen.findByText('Senior AI Engineer')).toBeInTheDocument();
    // Salla appears both on its filter chip and on the posting row.
    expect(screen.getAllByText(/Salla/).length).toBeGreaterThan(0);
    expect(screen.getByText('jobFeed.why.matched')).toBeInTheDocument();
  });

  it('links straight to the employer posting', async () => {
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);

    const link = await screen.findByRole('link', { name: /View posting/ });
    expect(link).toHaveAttribute('href', 'https://apply.workable.com/salla/j/ABC/');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('offers no action that rewrites the CV on its own', async () => {
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    const labels = screen.getAllByRole('button').map((button) => button.textContent ?? '');
    expect(labels.some((label) => /tailor/i.test(label))).toBe(false);
    expect(screen.getByRole('button', { name: 'Save to pipeline' })).toBeInTheDocument();
  });

  it('drops a role whose title says it is elsewhere', async () => {
    mockListPostings.mockResolvedValue({
      postings: [
        posting(),
        posting({
          id: 'agoda',
          title: 'Senior AI Engineer (Bangkok based, relocation provided)',
          location: 'Riyadh',
        }),
      ],
      error: null,
    });

    render(<JobFeedSection />);

    await waitFor(() => expect(screen.getAllByText(/Senior AI Engineer/)).toHaveLength(1));
    expect(screen.queryByText(/Bangkok/)).not.toBeInTheDocument();
  });
});

describe('render stability', () => {
  /**
   * React error #185 in production: `load` closed over `t`, so it sat in the load
   * effect's dependency list. Each load fired six setState calls, the re-render
   * produced a new `t`, and the effect ran again — forever. Dev never showed it
   * because `t` happened to stay stable there.
   */
  it('loads once even though every render produces a new t', async () => {
    render(<JobFeedSection />);

    await screen.findByText('Follow a company to start seeing roles.');
    // Give any runaway effect several frames to prove itself.
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(mockListTracked).toHaveBeenCalledTimes(1);
    expect(mockListPostings).toHaveBeenCalledTimes(1);
  });

  it('still reports a failed load to the user', async () => {
    mockListTracked.mockResolvedValue({ companies: [], error: 'boom' });

    render(<JobFeedSection />);

    expect(await screen.findByText('Could not load your feed. Try again.')).toBeInTheDocument();
    expect(mockListTracked).toHaveBeenCalledTimes(1);
  });
});

describe('searching by company name', () => {
  it('finds a known company typed in Arabic', async () => {
    /*
     * toHandle strips everything outside [a-z0-9-], so an Arabic name collapsed to
     * an empty string and no board was ever probed: "تامارا" could not resolve
     * while "Tamara" could. Known companies match on either name, before any
     * network call.
     */
    render(<JobFeedSection />);
    await screen.findByRole('button', { name: 'Tabby' });

    fireEvent.change(screen.getByLabelText('Add a company'), { target: { value: 'تامارا' } });
    fireEvent.click(screen.getByRole('button', { name: /Add company/ }));

    expect(await screen.findByRole('button', { name: /Follow this board/ })).toBeInTheDocument();
    // Matched locally, so nothing fanned out across the providers.
    expect(mockResolveCompany).not.toHaveBeenCalled();
  });

  it('follows the company that Arabic search matched', async () => {
    render(<JobFeedSection />);
    await screen.findByRole('button', { name: 'Tabby' });

    fireEvent.change(screen.getByLabelText('Add a company'), { target: { value: 'تامارا' } });
    fireEvent.click(screen.getByRole('button', { name: /Add company/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Follow this board/ }));

    await waitFor(() =>
      expect(mockTrackCompany).toHaveBeenCalledWith({
        source: 'greenhouse',
        token: 'tamara',
        displayName: 'Tamara',
      }),
    );
  });

  it('clears the search once the company is followed', async () => {
    // The follow succeeded but the panel stayed put, so the click read as a
    // no-op even though the company had been tracked.
    render(<JobFeedSection />);
    await screen.findByRole('button', { name: 'Tabby' });

    fireEvent.change(screen.getByLabelText('Add a company'), { target: { value: 'تامارا' } });
    fireEvent.click(screen.getByRole('button', { name: /Add company/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Follow this board/ }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Follow this board/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Add a company')).toHaveValue('');
  });

  it('hides the starter chips while a result is on screen', async () => {
    render(<JobFeedSection />);
    await screen.findByRole('button', { name: 'Tabby' });

    fireEvent.change(screen.getByLabelText('Add a company'), { target: { value: 'تامارا' } });
    fireEvent.click(screen.getByRole('button', { name: /Add company/ }));

    await screen.findByRole('button', { name: /Follow this board/ });
    // A followable row of chips under a search result read as a contradiction.
    expect(screen.queryByRole('button', { name: 'Tabby' })).not.toBeInTheDocument();
  });
});

describe('removing a company', () => {
  it('drops the row immediately rather than waiting on the network', async () => {
    let resolveUntrack: (value: { data: null; error: null }) => void = () => {};
    mockUntrackCompany.mockReturnValue(new Promise((resolve) => { resolveUntrack = resolve; }));
    mockListTracked.mockResolvedValue({ companies: [company], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Salla');
    fireEvent.click(screen.getByRole('button', { name: 'Manage companies' }));

    fireEvent.click(screen.getByRole('button', { name: 'Stop following' }));

    // Gone before the request settles. Asserted on the row's own control, because
    // the name reappears as a starter chip the moment it stops being followed.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Stop following' })).not.toBeInTheDocument(),
    );
    resolveUntrack({ data: null, error: null });
    // And no full refetch to remove one row.
    expect(mockListTracked).toHaveBeenCalledTimes(1);
  });

  it('puts the row back when the server refuses', async () => {
    mockUntrackCompany.mockResolvedValue({ data: null, error: 'nope' });
    mockListTracked.mockResolvedValue({ companies: [company], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Salla');
    fireEvent.click(screen.getByRole('button', { name: 'Manage companies' }));

    fireEvent.click(screen.getByRole('button', { name: 'Stop following' }));

    expect(await screen.findByText('nope')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop following' })).toBeInTheDocument();
  });
});

describe('company filter chips', () => {
  const tabby = {
    ...company,
    companyId: 'c2',
    displayName: 'Tabby',
    token: 'tabby',
    source: 'pinpoint',
  };

  it('offers no filter until there is more than one company to filter by', async () => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    // A control with a single option is decoration, not a filter.
    expect(screen.queryByLabelText('jobFeed.filters.companyAllLabel')).not.toBeInTheDocument();
  });

  it('narrows the feed to the company whose chip is pressed', async () => {
    mockListTracked.mockResolvedValue({ companies: [company, tabby], error: null });
    mockListPostings.mockResolvedValue({
      postings: [
        posting({ id: 'salla-role', title: 'Senior AI Engineer' }),
        posting({ id: 'tabby-role', companyId: 'c2', companyName: 'Tabby', title: 'Senior AI Scientist' }),
      ],
      error: null,
    });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    const chip = screen
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-label') === 'jobFeed.filters.companySelect'
        && (button.textContent ?? '').includes('Tabby'));
    fireEvent.click(chip as HTMLElement);

    await waitFor(() => expect(screen.queryByText('Senior AI Engineer')).not.toBeInTheDocument());
    expect(screen.getByText('Senior AI Scientist')).toBeInTheDocument();
  });

  it('says the filter emptied the feed rather than claiming nothing was checked', async () => {
    // Nothing was rejected here — the user narrowed the question. "0 roles were
    // checked and none cleared your filters" would be false on both counts.
    mockListTracked.mockResolvedValue({ companies: [company, tabby], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting({ id: 'salla-role' })], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    const chip = screen
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-label') === 'jobFeed.filters.companySelect'
        && (button.textContent ?? '').includes('Tabby'));
    fireEvent.click(chip as HTMLElement);

    expect(await screen.findByText('No open roles from the companies you picked.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show all companies' }));
    expect(await screen.findByText('Senior AI Engineer')).toBeInTheDocument();
  });
});

describe('recency', () => {
  beforeEach(() => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
  });

  it('widens the window once rather than opening on an empty feed, and says it did', async () => {
    /*
     * Measured on the live starter boards 2026-08-31: Careem had 20 open roles and
     * none posted inside seven days; HALA 4 of 16, Tamara 3 of 36, Salla 3 of 27.
     * A hard week shows a first-time follower of one company nothing at all, which
     * reads as broken rather than narrow.
     */
    mockListPostings.mockResolvedValue({
      postings: [posting({ postedAt: daysAgo(20), firstSeenAt: daysAgo(20) })],
      error: null,
    });

    render(<JobFeedSection />);

    expect(await screen.findByText('Senior AI Engineer')).toBeInTheDocument();
    // Widening silently would be its own small lie about how current the feed is.
    expect(
      screen.getByText('Nothing was posted in the last week, so this is the last 30 days.'),
    ).toBeInTheDocument();
  });

  it('never widens behind a window the user chose', async () => {
    mockListPostings.mockResolvedValue({
      postings: [posting({ postedAt: daysAgo(20), firstSeenAt: daysAgo(20) })],
      error: null,
    });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    fireEvent.click(screen.getByRole('button', { name: '24 hours' }));

    expect(await screen.findByText('Nothing posted in that window.')).toBeInTheDocument();
    expect(screen.queryByText('Senior AI Engineer')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Nothing was posted in the last week, so this is the last 30 days.'),
    ).not.toBeInTheDocument();
  });

  it('names the window as the rule when even the widened one is empty, and offers a way past it', async () => {
    mockListPostings.mockResolvedValue({
      postings: [posting({ postedAt: daysAgo(200), firstSeenAt: daysAgo(200) })],
      error: null,
    });

    render(<JobFeedSection />);

    // The rule that emptied the feed is named, never a blank screen.
    expect(await screen.findByText('Nothing posted in that window.')).toBeInTheDocument();
    expect(screen.queryByText('Senior AI Engineer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show older roles' }));

    expect(await screen.findByText('Senior AI Engineer')).toBeInTheDocument();
  });

  it('keeps a role from a board that publishes no posting date, and says which date it is showing', async () => {
    // Pinpoint and Workday emit no date. Filtering them on first-seen would delete
    // Tabby — the largest verified board — from the feed entirely.
    mockListPostings.mockResolvedValue({
      postings: [posting({ postedAt: null, firstSeenAt: daysAgo(90) })],
      error: null,
    });

    render(<JobFeedSection />);

    expect(await screen.findByText('Senior AI Engineer')).toBeInTheDocument();
    expect(screen.getByText('jobFeed.date.seen')).toBeInTheDocument();
    expect(screen.queryByText('jobFeed.date.posted')).not.toBeInTheDocument();
  });

  it('shows no date at all when neither timestamp can be read', async () => {
    // "First seen today" derived from a value we just failed to parse is the same
    // class of invention the two-word labelling exists to prevent.
    mockListPostings.mockResolvedValue({
      postings: [posting({ postedAt: null, firstSeenAt: 'not-a-date' })],
      error: null,
    });

    render(<JobFeedSection />);

    expect(await screen.findByText('Senior AI Engineer')).toBeInTheDocument();
    expect(screen.queryByText('jobFeed.date.seen')).not.toBeInTheDocument();
    expect(screen.queryByText('jobFeed.date.posted')).not.toBeInTheDocument();
  });

  it('labels a dated posting as posted', async () => {
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);

    expect(await screen.findByText('Senior AI Engineer')).toBeInTheDocument();
    expect(screen.getByText('jobFeed.date.posted')).toBeInTheDocument();
  });
});

describe('refreshing', () => {
  it('re-reads the feed without blanking it', async () => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    // The row survives the reload. Reusing `loading` here swapped the whole
    // section for a spinner, so pressing Refresh made the feed vanish and return.
    expect(screen.getByText('Senior AI Engineer')).toBeInTheDocument();
    await waitFor(() => expect(mockListTracked).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Senior AI Engineer')).toBeInTheDocument();
  });
});

describe('the badge separates a full role match from a partial one', () => {
  // The intent is "Senior AI Engineer", so the terms are ai and engineer — senior
  // is a level, not a function. A title carrying both covers the role; one
  // carrying half does not, and the badge has to be able to say which.
  it.each([
    ['Senior AI Engineer', '2/2'],
    ['Senior Engineer', '1/2'],
  ])('reads %s as %s of the target role', async (title, badge) => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting({ title })], error: null });

    render(<JobFeedSection />);
    await screen.findByText(title);

    expect(screen.getByText(badge)).toBeInTheDocument();
  });

  it('grades coverage without the red-amber-green a hiring verdict would use', async () => {
    // Those bands belong to the Match tab, which reads the JD and the CV. Wearing
    // them here made a count of title keywords look like the same judgement.
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting({ title: 'Senior Engineer' })], error: null });

    const { container } = render(<JobFeedSection />);
    await screen.findByText('Senior Engineer');

    expect(container.innerHTML).not.toMatch(/emerald|amber|rose/);
  });
});

describe('the company chip carries the count, the status and the unfollow', () => {
  const tabby = {
    ...company,
    companyId: 'c2',
    displayName: 'Tabby',
    token: 'tabby',
    source: 'pinpoint',
  };

  const chipFor = (name: string) =>
    screen
      .getAllByRole('button')
      .find(
        (button) =>
          button.getAttribute('aria-label') === 'jobFeed.filters.companySelect' &&
          (button.textContent ?? '').includes(name),
      ) as HTMLElement;

  /** The count beside a chip's filter button — exact, not a substring of the name. */
  const countFor = (name: string) =>
    within(screen.getByRole('group', { name })).getByLabelText('jobFeed.companies.matchingOf');

  it('counts the roles the feed is showing, not the whole board', async () => {
    // Salla's board had 28 roles on the last crawl and two of them clear the
    // user's filters. A chip reading 28 above a list of two is the feed telling
    // the user it is hiding something.
    mockListTracked.mockResolvedValue({ companies: [company, tabby], error: null });
    mockListPostings.mockResolvedValue({
      postings: [
        posting({ id: 's1' }),
        posting({ id: 's2', title: 'Senior AI Platform Engineer' }),
        posting({ id: 's3', location: 'Dubai, UAE' }),
        posting({ id: 't1', companyId: 'c2', companyName: 'Tabby' }),
      ],
      error: null,
    });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Platform Engineer');

    expect(countFor('Salla')).toHaveTextContent(/^2$/);
    expect(screen.queryByText('28')).not.toBeInTheDocument();
  });

  it('keeps counting the whole feed when one company is selected', async () => {
    // Selecting Salla must not tell the user Tabby has nothing — it hides Tabby's
    // rows, it does not re-answer the question the other chips are asking.
    mockListTracked.mockResolvedValue({ companies: [company, tabby], error: null });
    mockListPostings.mockResolvedValue({
      postings: [
        posting({ id: 's1' }),
        posting({ id: 't1', companyId: 'c2', companyName: 'Tabby', title: 'Senior AI Scientist' }),
      ],
      error: null,
    });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Scientist');

    fireEvent.click(chipFor('Salla'));

    await waitFor(() => expect(screen.queryByText('Senior AI Scientist')).not.toBeInTheDocument());
    expect(countFor('Tabby')).toHaveTextContent(/^1$/);
  });

  it('shows the company even when it is the only one followed', async () => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    expect(chipFor('Salla')).toBeInTheDocument();
  });

  it('no longer states a board total the feed is not showing', async () => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    expect(screen.queryByText('jobFeed.companies.openRoles')).not.toBeInTheDocument();
  });

  it('keeps unfollow out of the way until the user asks to manage', async () => {
    // Unfollowing costs a re-crawl to undo, so it does not sit one mis-tap away
    // from the filter it shares a chip with.
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    expect(screen.queryByRole('button', { name: 'Stop following' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Manage companies' }));

    expect(screen.getByRole('button', { name: 'Stop following' })).toBeInTheDocument();
  });

  it('never nests the unfollow control inside the filter control', async () => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');
    fireEvent.click(screen.getByRole('button', { name: 'Manage companies' }));

    const unfollow = screen.getByRole('button', { name: 'Stop following' });
    expect(chipFor('Salla').contains(unfollow)).toBe(false);
  });
});

describe('the row badge does not pose as a match score', () => {
  beforeEach(() => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
  });

  it('shows how much of a target role the title covers, not a percentage', async () => {
    // A 0-100 number beside a job is read as the match score, and it is not one:
    // this is title keyword overlap, computed without ever reading the JD or CV.
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.queryByText('100')).not.toBeInTheDocument();
  });

  it('measures the best target role rather than the union of them all', async () => {
    mockSearchIntent.mockReturnValue({ ...SENIOR_INTENT, targetRoles: ['AI Engineer', 'Data Scientist'] });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.queryByText('70')).not.toBeInTheDocument();
  });
});

describe('refresh says what it refreshed', () => {
  it('does not call a database re-read a board check', async () => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    // The button re-reads what the last crawl stored. It does not go to the
    // boards, and cannot: the crawl is a secret-gated background function.
    expect(screen.getByRole('button', { name: /Reload/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
  });

  it('says when the boards were last checked, not only when the page re-read them', async () => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    expect(screen.getByText('jobFeed.lastUpdated.boards')).toBeInTheDocument();
  });
});

describe('an empty feed names the rule for the companies the user is looking at', () => {
  const tabby = {
    ...company,
    companyId: 'c2',
    displayName: 'Tabby',
    token: 'tabby',
    source: 'pinpoint',
  };

  it('does not blame the age window for a company whose roles were never the right ones', async () => {
    // Salla's matching role is six weeks old; Tabby's only role is a different job
    // entirely. Filtered to Tabby, "nothing posted in that window" would be
    // pointing at Salla's backlog to explain a feed the user narrowed themselves.
    mockListTracked.mockResolvedValue({ companies: [company, tabby], error: null });
    mockListPostings.mockResolvedValue({
      postings: [
        posting({ id: 's1', postedAt: daysAgo(60), firstSeenAt: daysAgo(60) }),
        posting({ id: 't1', companyId: 'c2', companyName: 'Tabby', title: 'Warehouse Supervisor' }),
      ],
      error: null,
    });

    render(<JobFeedSection />);
    await screen.findByText('Nothing posted in that window.');

    const chip = screen
      .getAllByRole('button')
      .find(
        (button) =>
          button.getAttribute('aria-label') === 'jobFeed.filters.companySelect' &&
          (button.textContent ?? '').includes('Tabby'),
      ) as HTMLElement;
    fireEvent.click(chip);

    expect(await screen.findByText('Nothing matched today.')).toBeInTheDocument();
  });
});

describe('the chip says its state out loud, not only in a tooltip', () => {
  it('names the count and the board status for a screen reader', async () => {
    // `title` on a span reaches neither a touch user nor reliably a screen reader,
    // and these two states used to be rendered as visible text in the list.
    mockListTracked.mockResolvedValue({
      companies: [company, { ...company, companyId: 'c2', displayName: 'Nana', token: 'nana', lastFetchedAt: null }],
      error: null,
    });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    expect(screen.getByLabelText('jobFeed.companies.matchingOf')).toBeInTheDocument();
    expect(screen.getByLabelText('Not checked yet')).toBeInTheDocument();
  });
});

describe('the freshness line counts boards that were actually read', () => {
  it('does not treat a failed crawl as a board check', async () => {
    // crawl-jobs-background stamps last_fetched_at alongside last_status:'failed'
    // on purpose, so a broken token is not retried every run. Reading that stamp
    // as freshness says "boards last checked an hour ago" over a feed built
    // entirely from yesterday — the exact overstatement this line exists to end.
    mockListTracked.mockResolvedValue({
      companies: [{ ...company, lastStatus: 'failed' as const, lastFetchedAt: new Date().toISOString() }],
      error: null,
    });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    expect(screen.queryByText('jobFeed.lastUpdated.boards')).not.toBeInTheDocument();
  });

  it('reports the boards that were read when only some of them failed', async () => {
    mockListTracked.mockResolvedValue({
      companies: [
        { ...company, lastStatus: 'failed' as const, lastFetchedAt: new Date().toISOString() },
        { ...company, companyId: 'c2', displayName: 'Tabby', token: 'tabby' },
      ],
      error: null,
    });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    expect(screen.getByText('jobFeed.lastUpdated.boards')).toBeInTheDocument();
  });
});

describe('the chip status is announced, not just drawn', () => {
  it('keeps the count and the board status out of the filter button', async () => {
    // An element's accessible name computation stops at aria-label and never
    // reaches its descendants, so anything inside the labelled filter button is
    // silent. The status is not interactive — it belongs beside the button, in
    // the group, where its own name is read.
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    const filter = screen
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-label') === 'jobFeed.filters.companySelect') as HTMLElement;
    const status = screen.getByLabelText('jobFeed.companies.matchingOf');

    expect(status).toHaveTextContent('1');
    expect(filter.contains(status)).toBe(false);
  });
});

describe('unfollowing does not strand the keyboard', () => {
  it('moves focus to the manage control when the focused chip is removed', async () => {
    // The chip row is the only place a company can be unfollowed, so the button
    // that vanishes under the user is the one they were standing on. Focus falls
    // to <body> and the tab order restarts at the top of the page.
    mockListTracked.mockResolvedValue({
      companies: [company, { ...company, companyId: 'c2', displayName: 'Tabby', token: 'tabby' }],
      error: null,
    });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');
    fireEvent.click(screen.getByRole('button', { name: 'Manage companies' }));

    fireEvent.click(within(screen.getByRole('group', { name: 'Tabby' })).getByRole('button', { name: 'Stop following' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' })),
    );
  });
});

describe('the age window is not widened by a filter the user applied', () => {
  it('leaves the window alone when it is a company filter that emptied the view', async () => {
    // Salla's only matching role is two months old; Tabby posted this week. Under
    // the seven-day default the feed is not empty — it is showing Tabby. Narrowing
    // to Salla must not widen the window for every company and announce "nothing
    // was posted in the last week", which is false of the feed the user just left.
    mockListTracked.mockResolvedValue({
      companies: [company, { ...company, companyId: 'c2', displayName: 'Tabby', token: 'tabby' }],
      error: null,
    });
    mockListPostings.mockResolvedValue({
      postings: [
        posting({ id: 's1', postedAt: daysAgo(60), firstSeenAt: daysAgo(60) }),
        posting({
          id: 't1',
          companyId: 'c2',
          companyName: 'Tabby',
          title: 'Senior AI Scientist',
          postedAt: daysAgo(2),
          firstSeenAt: daysAgo(2),
        }),
      ],
      error: null,
    });

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Scientist');

    const chip = screen
      .getAllByRole('button')
      .find(
        (button) =>
          button.getAttribute('aria-label') === 'jobFeed.filters.companySelect' &&
          (button.textContent ?? '').includes('Salla'),
      ) as HTMLElement;
    fireEvent.click(chip);

    expect(await screen.findByText('Nothing posted in that window.')).toBeInTheDocument();
    expect(
      screen.queryByText('Nothing was posted in the last week, so this is the last 30 days.'),
    ).not.toBeInTheDocument();
    // And the window the user is on is still the one they were given.
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true');
  });
});


const CV = {
  basics: { name: 'Abdullah', label: 'Senior AI Engineer' },
  work: [{ name: 'Salla', position: 'Data Analyst' }],
};

describe('target roles the CV already implies', () => {
  beforeEach(() => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });
    mockActiveResume.mockReturnValue(CV);

    // A stateful stand-in for the store: a write is visible to the next read, and
    // the store stamps meta on the way in, exactly as the real one does.
    let current: unknown = null;
    mockSearchIntent.mockImplementation(() => current);
    mockSetSearchIntent.mockImplementation((next: { meta?: Record<string, unknown> }) => {
      current = { ...next, meta: { ...next.meta, completeness: 75, updatedAt: 'stamped' } };
    });
  });

  it('shows the feed as soon as a role is picked', async () => {
    render(<JobFeedSection />);
    await screen.findByText('Set your target role first.');

    fireEvent.click(screen.getByRole('button', { name: 'Senior AI Engineer' }));

    // The row, not the chip: the chip is gone once the role is being filtered on.
    expect(await screen.findByRole('heading', { name: 'Senior AI Engineer' })).toBeInTheDocument();
    expect(screen.queryByText('Set your target role first.')).not.toBeInTheDocument();
  });

  it('sends the server what the store stamped, not the draft it was handed', async () => {
    // completeness and updatedAt are computed inside the store. Posting the draft
    // would put a placeholder on the profile row that outlives this session.
    render(<JobFeedSection />);
    await screen.findByText('Set your target role first.');

    fireEvent.click(screen.getByRole('button', { name: 'Data Analyst' }));

    await waitFor(() =>
      expect(mockSaveSearchIntent).toHaveBeenCalledWith(
        expect.objectContaining({ meta: expect.objectContaining({ completeness: 75 }) }),
      ),
    );
  });

  it('offers the roles from the CV instead of a dead end', async () => {
    // "Set your target role first" with no way to set one is a wall. The CV
    // already says what this person does, in their own words.
    mockSearchIntent.mockReturnValue(null);

    render(<JobFeedSection />);
    await screen.findByText('Set your target role first.');

    expect(screen.getByRole('button', { name: 'Senior AI Engineer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Data Analyst' })).toBeInTheDocument();
  });

  it('starts the feed on the role the user picked', async () => {
    mockSearchIntent.mockReturnValue(null);

    render(<JobFeedSection />);
    await screen.findByText('Set your target role first.');

    fireEvent.click(screen.getByRole('button', { name: 'Senior AI Engineer' }));

    expect(mockSetSearchIntent).toHaveBeenCalledWith(
      expect.objectContaining({ targetRoles: ['Senior AI Engineer'] }),
    );
  });

  it('remembers the pick for the next device, not just this browser', async () => {
    mockSearchIntent.mockReturnValue(null);

    render(<JobFeedSection />);
    await screen.findByText('Set your target role first.');
    fireEvent.click(screen.getByRole('button', { name: 'Data Analyst' }));

    await waitFor(() =>
      expect(mockSaveSearchIntent).toHaveBeenCalledWith(
        expect.objectContaining({ targetRoles: ['Data Analyst'] }),
      ),
    );
  });

  it('offers only what is not already targeted, and adds to what is', async () => {
    mockSearchIntent.mockReturnValue(SENIOR_INTENT);

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    // The headline derives the same terms as the intent already set, so offering
    // it again would be offering a chip that changes nothing.
    expect(screen.queryByRole('button', { name: 'Senior AI Engineer' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Data Analyst' }));

    expect(mockSetSearchIntent).toHaveBeenCalledWith(
      expect.objectContaining({ targetRoles: ['Senior AI Engineer', 'Data Analyst'] }),
    );
  });
});

describe('changing the CV the feed matches against', () => {
  it('sends the user to the upload tab rather than duplicating it here', async () => {
    // The feed cannot be reached without a CV, so this is a swap, not an upload.
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });
    mockActiveResume.mockReturnValue(CV);
    const navigated: string[] = [];
    const listener = (event: Event) => navigated.push((event as CustomEvent<{ tab?: string }>).detail?.tab ?? '');
    window.addEventListener('watheq:navigate-tab', listener);

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    fireEvent.click(screen.getByRole('button', { name: 'Use a different CV' }));
    window.removeEventListener('watheq:navigate-tab', listener);

    expect(navigated).toEqual(['resume']);
  });
});

describe('the feed opened before any CV exists', () => {
  beforeEach(() => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });
    mockActiveResume.mockReturnValue(null);
  });

  it('asks for an upload rather than offering to swap a CV that is not there', async () => {
    // The feed is reachable with no resume, so the same button is an upload here
    // and a swap once one exists. "Use a different CV" is a lie in the first case.
    mockSearchIntent.mockReturnValue(SENIOR_INTENT);

    render(<JobFeedSection />);
    await screen.findByText('Senior AI Engineer');

    expect(screen.getByRole('button', { name: 'Upload your CV' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use a different CV' })).not.toBeInTheDocument();
  });

  it('still ranks the feed from a target role with no CV at all', async () => {
    // The CV feeds two suggestion lists and nothing else. Nothing about ranking
    // depends on it, and a user who onboarded on another device has an intent
    // stored server-side with no resume in this browser.
    mockSearchIntent.mockReturnValue(SENIOR_INTENT);

    render(<JobFeedSection />);

    expect(await screen.findByRole('heading', { name: 'Senior AI Engineer' })).toBeInTheDocument();
  });

  it('points at the one thing that works when there is neither a CV nor a role', async () => {
    // No CV means no role chips to offer, so the empty state cannot just repeat
    // "set a target role" — following a company works with no intent at all.
    mockSearchIntent.mockReturnValue(null);

    render(<JobFeedSection />);
    await screen.findByText('Set your target role first.');

    expect(screen.getByText('Or follow a company above — new roles appear here as they are posted.')).toBeInTheDocument();
  });
});
