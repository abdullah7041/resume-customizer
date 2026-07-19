import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createJobApplication, updateJobApplication } from './pipeline';
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
    ilike: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    update: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data, error: null })),
    then: vi.fn((resolve) => Promise.resolve({ data, error: null }).then(resolve)),
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

  it('updates recent duplicate saves with editable fields, notes, and merged metadata', async () => {
    const duplicate = {
      id: 'job-123',
      user_id: 'user-123',
      company_name: 'Watheq AI',
      job_title: 'Data Analyst',
      status: 'saved',
      metadata: { source: 'previous-save' },
      applied_at: null,
      outcome_at: null,
    };
    const duplicateBuilder = buildBuilder({ data: [duplicate] });
    const updatedApplication = {
      ...duplicate,
      location: 'Riyadh',
      employment_type: 'Full-time',
      seniority: 'Senior',
      sector: 'Technology',
      status: 'applied',
      notes: 'Applied with tailored resume',
      metadata: {
        source: 'previous-save',
        extractionConfidence: { companyName: 0.9, jobTitle: 0.8, location: 0.7 },
      },
      applied_at: '2026-06-08T12:00:00.000Z',
    };
    const updateBuilder = buildBuilder({ data: updatedApplication });

    supabase.from
      .mockReturnValueOnce(duplicateBuilder)
      .mockReturnValueOnce(updateBuilder);

    const result = await createJobApplication({
      company_name: 'Watheq AI',
      job_title: 'Data Analyst',
      job_description: 'Role description',
      location: 'Riyadh',
      employment_type: 'Full-time',
      seniority: 'Senior',
      sector: 'Technology',
      status: 'applied',
      notes: 'Applied with tailored resume',
      metadata: {
        extractionConfidence: { companyName: 0.9, jobTitle: 0.8, location: 0.7 },
      },
    });

    expect(result).toEqual({ data: updatedApplication, error: null, isDuplicate: true });
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      company_name: 'Watheq AI',
      job_title: 'Data Analyst',
      job_description: 'Role description',
      location: 'Riyadh',
      employment_type: 'Full-time',
      seniority: 'Senior',
      sector: 'Technology',
      status: 'applied',
      notes: 'Applied with tailored resume',
      metadata: {
        source: 'previous-save',
        extractionConfidence: { companyName: 0.9, jobTitle: 0.8, location: 0.7 },
      },
      applied_at: expect.any(String),
    }));
    expect(JSON.stringify(updateBuilder.update.mock.calls[0][0])).not.toContain('interview_at');
  });

  it('preserves user-managed fields when auto-save refreshes a recent duplicate', async () => {
    const duplicate = {
      id: 'job-123',
      user_id: 'user-123',
      company_name: 'Watheq AI',
      job_title: 'Data Analyst',
      job_description: 'Older role description',
      location: 'Jeddah',
      employment_type: 'Contract',
      seniority: 'Lead',
      sector: 'Finance',
      status: 'applied',
      notes: 'Interview scheduled',
      metadata: { source: 'manual-save' },
      applied_at: '2026-07-18T12:00:00.000Z',
      outcome_at: null,
    };
    const duplicateBuilder = buildBuilder({ data: [duplicate] });
    const refreshedApplication = {
      ...duplicate,
      job_description: 'Fresh role description',
      match_score: 77,
      metadata: {
        source: 'manual-save',
        autoSaved: true,
      },
    };
    const updateBuilder = buildBuilder({ data: refreshedApplication });

    supabase.from
      .mockReturnValueOnce(duplicateBuilder)
      .mockReturnValueOnce(updateBuilder);

    const result = await createJobApplication({
      company_name: 'Watheq AI',
      job_title: 'Data Analyst',
      job_description: 'Fresh role description',
      location: 'Riyadh',
      employment_type: null,
      seniority: null,
      sector: null,
      match_score: 77,
      status: 'saved',
      metadata: { autoSaved: true },
    }, { duplicateStrategy: 'preserve_user_fields' });

    expect(result).toEqual({ data: refreshedApplication, error: null, isDuplicate: true });
    expect(updateBuilder.update).toHaveBeenCalledWith({
      job_description: 'Fresh role description',
      match_score: 77,
      metadata: {
        source: 'manual-save',
        autoSaved: true,
      },
    });
  });
});
