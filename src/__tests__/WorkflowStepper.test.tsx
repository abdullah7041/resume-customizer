import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowStepper, type WorkflowStep } from '../components/ui/WorkflowStepper';

const buildSteps = (): WorkflowStep[] => [
  { id: 'resume', label: 'Resume', hint: 'Upload or paste', status: 'completed', targetTab: 'resume' },
  { id: 'jobAd', label: 'Job Ad', hint: 'Add description', status: 'active', targetTab: 'match' },
  { id: 'match', label: 'Match', hint: 'Analyze fit', status: 'upcoming', targetTab: 'match' },
  { id: 'optimize', label: 'Optimize', hint: 'Improve resume', status: 'locked', targetTab: 'optimize', lockedReason: 'Upload a resume first' },
  { id: 'export', label: 'Export / Pipeline', hint: 'Save and track', status: 'locked', targetTab: 'templates', lockedReason: 'Upload a resume first' },
];

describe('WorkflowStepper', () => {
  it('renders all five workflow steps including Export / Pipeline', () => {
    render(<WorkflowStepper steps={buildSteps()} onStepClick={vi.fn()} />);

    expect(screen.getByText('Resume')).toBeInTheDocument();
    expect(screen.getByText('Job Ad')).toBeInTheDocument();
    expect(screen.getByText('Match')).toBeInTheDocument();
    expect(screen.getByText('Optimize')).toBeInTheDocument();
    expect(screen.getByText('Export / Pipeline')).toBeInTheDocument();
  });

  it('marks the active step with aria-current and locks gated steps', () => {
    render(<WorkflowStepper steps={buildSteps()} onStepClick={vi.fn()} />);

    const activeStep = screen.getByRole('button', { current: 'step' });
    expect(activeStep).toHaveTextContent('Job Ad');

    // Locked steps render as disabled buttons.
    const buttons = screen.getAllByRole('button');
    const disabled = buttons.filter((btn) => (btn as HTMLButtonElement).disabled);
    expect(disabled.length).toBe(2);
  });

  it('navigates to the step target tab on click, but not when locked', () => {
    const onStepClick = vi.fn();
    render(<WorkflowStepper steps={buildSteps()} onStepClick={onStepClick} />);

    fireEvent.click(screen.getByText('Resume'));
    expect(onStepClick).toHaveBeenCalledWith('resume');

    // Locked Optimize step should not trigger navigation.
    fireEvent.click(screen.getByText('Optimize'));
    expect(onStepClick).not.toHaveBeenCalledWith('optimize');
  });
});
