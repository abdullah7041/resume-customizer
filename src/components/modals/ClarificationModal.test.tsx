import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClarificationModal } from '@/components/modals/ClarificationModal';

const question = {
  id: 'excelExperience',
  theme: 'Excel',
  rationale: 'The role requires Excel evidence.',
  question: 'Which Excel work can you verify?',
  type: 'multi' as const,
  options: [
    { value: 'dashboards', label: 'Built Excel dashboards' },
    { value: 'no_excel', label: "I don't have Excel experience", isHardStop: true },
  ],
  allowOther: true,
};

describe('ClarificationModal', () => {
  it('renders selectable options, Other, and a final hard-stop option', () => {
    render(
      <ClarificationModal
        questions={[question]}
        isOpen
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    const options = screen.getAllByRole('button', { name: /Built Excel dashboards|Other|I don't have Excel experience/i });
    expect(options.map(option => option.textContent)).toEqual([
      'Built Excel dashboards',
      'Other',
      "I don't have Excel experience",
    ]);
  });

  it('makes the hard-stop exclusive and submits structured selections', () => {
    const onSubmit = vi.fn();
    render(
      <ClarificationModal
        questions={[question]}
        isOpen
        onSubmit={onSubmit}
        onSkip={vi.fn()}
      />,
    );

    const evidence = screen.getByRole('button', { name: 'Built Excel dashboards' });
    const hardStop = screen.getByRole('button', { name: "I don't have Excel experience" });
    fireEvent.click(evidence);
    expect(evidence).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(hardStop);
    expect(evidence).toHaveAttribute('aria-pressed', 'false');
    expect(hardStop).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /submit answers/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      excelExperience: { selectedValues: ['no_excel'], otherText: '' },
    });
  });

  it('reveals and validates Other free text only after Other is selected', () => {
    render(
      <ClarificationModal
        questions={[question]}
        isOpen
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Other' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'too short' } });
    fireEvent.blur(input);

    expect(screen.getByRole('button', { name: /submit answers/i })).toBeDisabled();
    expect(screen.getByText(/meaningful answer/i)).toBeInTheDocument();
  });
});
