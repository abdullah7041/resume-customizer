import { beforeEach, describe, expect, it, vi } from 'vitest';

const { maybeSingleMock, importJobFromUrlMock } = vi.hoisted(() => ({
  maybeSingleMock: vi.fn(),
  importJobFromUrlMock: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) }),
  },
}));
vi.mock('@/services/api', () => ({ importJobFromUrl: importJobFromUrlMock }));

const { getPostingDescription } = await import('@/services/jobFeed');

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingleMock.mockResolvedValue({ data: { description: '', apply_url: 'https://example.com/job' }, error: null });
});

describe('getPostingDescription', () => {
  it('preserves a temporary import failure as a retryable read failure', async () => {
    importJobFromUrlMock.mockResolvedValue({ status: 'failed', failureReason: 'timeout' });
    await expect(getPostingDescription('posting-id')).resolves.toBeNull();
  });

  it('keeps a confirmed no-description posting as valid empty data', async () => {
    importJobFromUrlMock.mockResolvedValue({ status: 'failed', failureReason: 'jd_not_found' });
    await expect(getPostingDescription('posting-id')).resolves.toBe('');
  });
});
