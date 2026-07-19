import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SaveJobToPipelineCard } from '@/components/sections/SaveJobToPipelineCard';
import { createJobApplication, updateJobApplication } from '@/services/pipeline';
import type { JobApplication } from '@/types/pipeline';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-123' } }),
}));

vi.mock('@/services/analytics', () => ({
  analytics: {
    trackPipelineSaveClicked: vi.fn(),
    trackPipelineSaveFailed: vi.fn(),
    trackPipelineJobSaved: vi.fn(),
  },
}));

vi.mock('@/services/pipeline', () => ({
  createJobApplication: vi.fn(),
  updateJobApplication: vi.fn(),
}));

vi.mock('@/components/Feedback/FeedbackPromptController', () => ({
  requestValueMomentFeedbackPrompt: vi.fn(),
}));

describe('SaveJobToPipelineCard', () => {
  const savedApplication: JobApplication = {
    id: 'app-123',
    user_id: 'user-123',
    company_name: 'Existing Company',
    job_title: 'Existing Role',
    job_description: 'Existing description',
    job_url: 'https://example.com/job',
    location: 'Jeddah',
    employment_type: 'Full-time',
    seniority: 'Senior',
    sector: 'Technology',
    match_score: 82,
    status: 'applied',
    resume_export_file_path: null,
    resume_export_file_name: null,
    notes: 'Follow up on Monday',
    metadata: {},
    applied_at: '2026-07-18T12:00:00.000Z',
    outcome_at: null,
    outcome_source: 'manual',
    created_at: '2026-07-17T12:00:00.000Z',
    updated_at: '2026-07-18T12:00:00.000Z',
  };

  it('sanitizes null metadata and leaves unknown company as placeholder text', () => {
    render(
      <SaveJobToPipelineCard
        jobDescription="Data analyst job description"
        extractedMetadata={{
          companyName: 'Unknown company',
          jobTitle: 'Data Analyst',
          location: null,
          employmentType: null,
          seniority: null,
          sector: null,
          confidence: {
            companyName: 0.4,
            jobTitle: 0.9,
            location: 0,
          },
          needsUserConfirmation: true,
        }}
      />,
    );

    expect(screen.getByLabelText('Company')).toHaveValue('');
    expect(screen.getByLabelText('Company')).toHaveAttribute('placeholder', 'Unknown company');
    expect(screen.getByLabelText('Employment type')).toHaveValue('');
    expect(screen.getByLabelText('Seniority')).toHaveValue('');
    expect(screen.getByLabelText('Sector')).toHaveValue('');
    expect(document.body).not.toHaveTextContent('null');
  });

  it('switches to update mode when the job was already auto-saved', () => {
    render(
      <SaveJobToPipelineCard
        jobDescription="Data analyst job description"
        savedApplicationId="app-123"
        extractedMetadata={null}
      />,
    );

    expect(screen.getByText('Saved to your pipeline')).toBeInTheDocument();
    expect(screen.getByText('Details were saved automatically — edit and save to update.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update saved job/ })).toBeInTheDocument();
  });

  it('updates the auto-saved record by id instead of creating another job', async () => {
    const user = userEvent.setup();
    vi.mocked(createJobApplication).mockResolvedValue({
      data: { id: 'duplicate-row' } as never,
      error: null,
    });
    vi.mocked(updateJobApplication).mockResolvedValue({
      data: { id: 'app-123' } as never,
      error: null,
    });

    render(
      <SaveJobToPipelineCard
        jobDescription="Data analyst job description"
        savedApplicationId="app-123"
        extractedMetadata={null}
      />,
    );

    await user.type(screen.getByLabelText('Company'), 'Watheq AI');
    await user.type(screen.getByLabelText('Job Title'), 'Data Analyst');
    await user.click(screen.getByRole('button', { name: /Update saved job/ }));

    expect(updateJobApplication).toHaveBeenCalledWith('app-123', expect.objectContaining({
      company_name: 'Watheq AI',
      job_title: 'Data Analyst',
      status: 'saved',
    }));
    expect(createJobApplication).not.toHaveBeenCalled();
  });

  it('hydrates update mode from the saved row before writing user-managed fields', async () => {
    const user = userEvent.setup();
    vi.mocked(updateJobApplication).mockResolvedValue({ data: savedApplication, error: null });

    render(
      <SaveJobToPipelineCard
        jobDescription="Fresh analysis"
        savedApplicationId="app-123"
        savedApplication={savedApplication}
        extractedMetadata={null}
      />,
    );

    expect(screen.getByLabelText('Company')).toHaveValue('Existing Company');
    expect(screen.getByLabelText('Status')).toHaveValue('applied');
    expect(screen.getByLabelText('Notes')).toHaveValue('Follow up on Monday');

    await user.click(screen.getByRole('button', { name: /Update saved job/ }));

    expect(updateJobApplication).toHaveBeenCalledWith('app-123', expect.objectContaining({
      company_name: 'Existing Company',
      status: 'applied',
      notes: 'Follow up on Monday',
    }));
  });

  it('keeps manual save mode when nothing was auto-saved', () => {
    render(
      <SaveJobToPipelineCard jobDescription="Data analyst job description" extractedMetadata={null} />,
    );

    expect(screen.getByText('Save this job to pipeline')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Update saved job/ })).not.toBeInTheDocument();
  });
});
