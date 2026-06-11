import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PipelineSection } from '../components/sections/PipelineSection';
import { listJobApplications } from '../services/pipeline';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
  }),
}));

vi.mock('../services/analytics', () => ({
  analytics: {
    trackPipelineStatusUpdated: vi.fn(),
  },
}));

vi.mock('../services/pipeline', () => ({
  listJobApplications: vi.fn(),
  updateJobApplication: vi.fn(),
  deleteJobApplication: vi.fn(),
}));

describe('PipelineSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listJobApplications.mockResolvedValue({
      data: [{
        id: 'job-123',
        user_id: 'user-123',
        company_name: 'Watheq AI',
        job_title: 'Data Analyst',
        job_description: 'Role description',
        job_url: null,
        location: null,
        employment_type: null,
        seniority: null,
        sector: null,
        match_score: 84,
        status: 'applied',
        resume_export_file_path: null,
        resume_export_file_name: null,
        notes: null,
        metadata: {},
        applied_at: '2026-05-01T00:00:00.000Z',
        outcome_at: null,
        outcome_source: 'user_confirmed',
        created_at: '2026-05-01T00:00:00.000Z',
        updated_at: '2026-05-01T00:00:00.000Z',
      }],
      error: null,
    });
  });

  it('does not show interview as a pipeline status or quick update', async () => {
    render(<PipelineSection />);

    const statusSelect = await screen.findByDisplayValue('applied');
    const statusOptions = within(statusSelect).getAllByRole('option').map((option) => option.textContent);

    expect(statusOptions).toEqual(['saved', 'applied', 'offer', 'rejected', 'withdrawn']);
    expect(screen.queryByRole('button', { name: 'Interview' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdrawn' })).toBeInTheDocument();
  });
});
