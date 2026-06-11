import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveJobToPipelineCard } from '../components/sections/SaveJobToPipelineCard';
import { createJobApplication } from '../services/pipeline';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback,
  }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
  }),
}));

vi.mock('../services/analytics', () => ({
  analytics: {
    trackPipelineSaveClicked: vi.fn(),
    trackPipelineJobSaved: vi.fn(),
    trackPipelineSaveFailed: vi.fn(),
  },
}));

vi.mock('../services/pipeline', () => ({
  createJobApplication: vi.fn(),
}));

describe('SaveJobToPipelineCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createJobApplication.mockResolvedValue({
      data: { id: 'job-123' },
      error: null,
      isDuplicate: false,
    });
  });

  it('sends all editable pipeline fields in the create payload', async () => {
    render(
      <SaveJobToPipelineCard
        jobDescription="Senior data analyst role in Riyadh."
        matchScore={84}
        extractedMetadata={{
          companyName: 'Watheq Co',
          jobTitle: 'Data Analyst',
          location: 'Riyadh',
          employmentType: 'Full-time',
          seniority: 'Senior',
          sector: 'Technology',
          confidence: { companyName: 0.9, jobTitle: 0.9, location: 0.8 },
          needsUserConfirmation: true,
        }}
      />
    );

    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Watheq AI' } });
    fireEvent.change(screen.getByLabelText('Job Title'), { target: { value: 'Senior Data Analyst' } });
    fireEvent.change(screen.getByLabelText('Job URL'), { target: { value: 'https://example.com/jobs/1' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Jeddah' } });
    fireEvent.change(screen.getByLabelText('Employment type'), { target: { value: 'Contract' } });
    fireEvent.change(screen.getByLabelText('Seniority'), { target: { value: 'Lead' } });
    fireEvent.change(screen.getByLabelText('Sector'), { target: { value: 'Finance' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'applied' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Applied with tailored resume' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(createJobApplication).toHaveBeenCalledTimes(1));

    expect(createJobApplication).toHaveBeenCalledWith({
      company_name: 'Watheq AI',
      job_title: 'Senior Data Analyst',
      job_description: 'Senior data analyst role in Riyadh.',
      job_url: 'https://example.com/jobs/1',
      location: 'Jeddah',
      employment_type: 'Contract',
      seniority: 'Lead',
      sector: 'Finance',
      match_score: 84,
      status: 'applied',
      notes: 'Applied with tailored resume',
      metadata: {
        extractionConfidence: { companyName: 0.9, jobTitle: 0.9, location: 0.8 },
        needsUserConfirmation: true,
      },
    });
  });
});
