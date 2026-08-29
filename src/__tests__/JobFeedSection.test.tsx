import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) =>
      typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key,
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

vi.mock('@/services/jobFeed', () => ({
  listTrackedCompanies: () => mockListTracked(),
  listOpenPostings: () => mockListPostings(),
  listFeedState: () => Promise.resolve(new Map()),
  readLastFeedSeenAt: () => Promise.resolve(null),
  touchLastFeedSeenAt: () => Promise.resolve(),
  getPostingDescription: () => Promise.resolve(''),
  resolveCompany: vi.fn(),
  trackCompany: vi.fn(),
  untrackCompany: vi.fn(),
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
    expect(screen.getByText('55')).toBeInTheDocument();
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
