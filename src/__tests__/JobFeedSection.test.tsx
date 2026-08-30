import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@/lib/stores/resumeStore', () => ({
  useSearchIntent: () => mockSearchIntent(),
  useActiveResume: () => mockActiveResume(),
}));

vi.mock('@/services/pipeline', () => ({ createJobApplication: vi.fn() }));

const mockListTracked = vi.fn();
const mockListPostings = vi.fn();
const mockTrackCompany = vi.fn();
const mockUntrackCompany = vi.fn();
const mockResolveCompany = vi.fn();

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
  setFeedState: vi.fn(),
}));

import { JobFeedSection } from '../components/sections/JobFeedSection';

const SENIOR_INTENT = {
  targetRoles: ['Senior AI Engineer'],
  seniority: 'senior' as const,
  meta: { confidence: 'high' as const, completeness: 100, updatedAt: '2026-08-29T00:00:00.000Z' },
};

function posting(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    companyId: 'c1',
    companyName: 'Salla',
    title: 'Senior AI Engineer',
    location: 'Riyadh, Saudi Arabia',
    applyUrl: 'https://apply.workable.com/salla/j/ABC/',
    postedAt: '2026-08-20',
    firstSeenAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

const company = {
  companyId: 'c1',
  displayName: 'Salla',
  source: 'workable',
  token: 'salla',
  trackedSince: '2026-08-01T00:00:00.000Z',
  lastFetchedAt: '2026-08-28T00:00:00.000Z',
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

  it('shows the score, the company, and a deterministic reason', async () => {
    mockListPostings.mockResolvedValue({ postings: [posting()], error: null });

    render(<JobFeedSection />);

    expect(await screen.findByText('Senior AI Engineer')).toBeInTheDocument();
    // ai + engineer both matched: 40 + 15 + 15.
    // The badge reads as a share of what the intent can reach, not a raw score:
    // this posting matches both derived terms (ai, engineer), so it is a 100.
    expect(screen.getByText('100')).toBeInTheDocument();
    // Salla appears both in the followed-companies list and on the posting row.
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
    fireEvent.click(screen.getByRole('button', { name: /Find their job board/ }));

    expect(await screen.findByRole('button', { name: /Follow this board/ })).toBeInTheDocument();
    // Matched locally, so nothing fanned out across the providers.
    expect(mockResolveCompany).not.toHaveBeenCalled();
  });

  it('follows the company that Arabic search matched', async () => {
    render(<JobFeedSection />);
    await screen.findByRole('button', { name: 'Tabby' });

    fireEvent.change(screen.getByLabelText('Add a company'), { target: { value: 'تامارا' } });
    fireEvent.click(screen.getByRole('button', { name: /Find their job board/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /Find their job board/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /Find their job board/ }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Stop following' }));

    expect(await screen.findByText('nope')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop following' })).toBeInTheDocument();
  });
});

describe('score colour bands', () => {
  // The intent is "Senior AI Engineer", so the terms are ai and engineer and the
  // ceiling is 70. A posting matching both has everything the user asked for and
  // is green; one matching half is not.
  it.each([
    ['Senior AI Engineer', 'emerald'],
    ['Senior Engineer', 'amber'],
  ])('tones %s by how much of the intent it covers', async (title, tone) => {
    mockListTracked.mockResolvedValue({ companies: [company], error: null });
    mockListPostings.mockResolvedValue({ postings: [posting({ title })], error: null });

    const { container } = render(<JobFeedSection />);
    await screen.findByText(title);

    // A 40 rendered in the same green as a 100 told the user they were equal.
    expect(container.innerHTML).toContain(tone);
  });
});
