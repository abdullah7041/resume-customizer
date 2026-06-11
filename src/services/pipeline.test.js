import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateJobApplication } from './pipeline';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

function buildBuilder({ data = null } = {}) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    update: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data, error: null })),
  };
  return builder;
}

describe('pipeline service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
  });

  it('persists status updates without using the removed interview timestamp', async () => {
    const currentBuilder = buildBuilder({
      data: { applied_at: null, outcome_at: null },
    });
    const updatedApplication = {
      id: 'job-123',
      user_id: 'user-123',
      status: 'applied',
      applied_at: '2026-06-08T12:00:00.000Z',
      outcome_at: null,
    };
    const updateBuilder = buildBuilder({ data: updatedApplication });

    supabase.from
      .mockReturnValueOnce(currentBuilder)
      .mockReturnValueOnce(updateBuilder);

    const result = await updateJobApplication('job-123', { status: 'applied' });

    expect(result.data).toEqual(updatedApplication);
    expect(currentBuilder.select).toHaveBeenCalledWith('applied_at, outcome_at');
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'applied',
      applied_at: expect.any(String),
    }));
    expect(JSON.stringify(updateBuilder.update.mock.calls[0][0])).not.toContain('interview_at');
  });

  it('persists notes updates', async () => {
    const updatedApplication = {
      id: 'job-123',
      user_id: 'user-123',
      status: 'saved',
      notes: 'Follow up next Sunday',
    };
    const updateBuilder = buildBuilder({ data: updatedApplication });

    supabase.from.mockReturnValueOnce(updateBuilder);

    const result = await updateJobApplication('job-123', { notes: 'Follow up next Sunday' });

    expect(result.data).toEqual(updatedApplication);
    expect(updateBuilder.update).toHaveBeenCalledWith({ notes: 'Follow up next Sunday' });
  });
});
