import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaveJobToPipelineCard } from '../components/sections/SaveJobToPipelineCard';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../services/analytics', () => ({
  analytics: {
    trackPipelineSaveClicked: vi.fn(),
    trackPipelineSaveFailed: vi.fn(),
    trackPipelineJobSaved: vi.fn(),
  },
}));

vi.mock('../services/pipeline', () => ({
  createJobApplication: vi.fn(),
}));

vi.mock('../components/Feedback/FeedbackPromptController', () => ({
  requestValueMomentFeedbackPrompt: vi.fn(),
}));

describe('SaveJobToPipelineCard', () => {
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

  it('keeps manual save mode when nothing was auto-saved', () => {
    render(
      <SaveJobToPipelineCard jobDescription="Data analyst job description" extractedMetadata={null} />,
    );

    expect(screen.getByText('Save this job to pipeline')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Update saved job/ })).not.toBeInTheDocument();
  });
});
