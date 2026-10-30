import { fireEvent, render, screen } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ClarificationModal } from '@/components/modals/ClarificationModal';

const translate = vi.hoisted(() => (
  key: string,
  fallback?: string,
) => (key === 'clarificationModal.regenerate' ? 'Generate different questions' : (fallback ?? key)));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

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
  it('keeps a selection made as the next question round becomes visible', () => {
    const onSubmit = vi.fn();
    const rounds = [[question], [{ ...question, id: 'sqlExperience', theme: 'SQL',
      options: [{ value: 'dashboards', label: 'Built SQL dashboards' }] }]];
    function RoundBoundary({ next }: { next: boolean }) {
      // Click at the first committed DOM, before passive initialization can run.
      useLayoutEffect(() => {
        if (next) screen.getByRole('button', { name: 'Built SQL dashboards' }).click();
      }, [next]);
      return <ClarificationModal questions={rounds[next ? 1 : 0]} isOpen onSubmit={onSubmit} onSkip={vi.fn()} />;
    }
    const view = render(<RoundBoundary next={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Built Excel dashboards' }));
    view.rerender(<RoundBoundary next />);
    expect(screen.getByRole('button', { name: 'Built SQL dashboards' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /submit answers/i }));
    expect(onSubmit).toHaveBeenCalledWith({ sqlExperience: { selectedValues: ['dashboards'], otherText: '' } });
  });
  it('never preselects model-guessed experience and allows Optimize now with multiple selected facts', () => {
    const onOptimizeNow = vi.fn();
    render(<ClarificationModal questions={[{ ...question, defaultValue: 'dashboards', options: [
      ...question.options, { value: 'reporting', label: 'Built reporting workflows' },
    ] }]} isOpen onSubmit={vi.fn()} onSkip={vi.fn()} onOptimizeNow={onOptimizeNow} />);
    expect(screen.getByRole('button', { name: 'Built Excel dashboards' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Built Excel dashboards' }));
    fireEvent.click(screen.getByRole('button', { name: 'Built reporting workflows' }));
    fireEvent.click(screen.getByRole('button', { name: 'Optimize now' }));
    expect(onOptimizeNow).toHaveBeenCalledWith({ excelExperience: { selectedValues: ['dashboards', 'reporting'], otherText: '' } });
  });
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
    fireEvent.change(input, { target: { value: '...' } });
    fireEvent.blur(input);

    expect(screen.getByRole('button', { name: /submit answers/i })).toBeDisabled();
    expect(screen.getByText(/meaningful answer/i)).toBeInTheDocument();
  });

  it('always labels the primary action Submit Answers, including round three', () => {
    render(
      <ClarificationModal
        questions={[question]}
        isOpen
        round={3}
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /submit answers/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue questions/i })).not.toBeInTheDocument();
  });

  it('asks before closing and can optimize once with the answers already entered', () => {
    const onSkip = vi.fn();
    const onOptimizeNow = vi.fn();
    render(
      <ClarificationModal
        questions={[question]}
        isOpen
        onSubmit={vi.fn()}
        onSkip={onSkip}
        onOptimizeNow={onOptimizeNow}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Built Excel dashboards' }));
    fireEvent.click(screen.getByRole('button', { name: /skip and proceed without answers/i }));

    expect(onSkip).not.toHaveBeenCalled();
    expect(screen.getByText(/valid answers will be kept/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /optimize now/i }));
    expect(onOptimizeNow).toHaveBeenCalledOnce();
    expect(onOptimizeNow).toHaveBeenCalledWith({
      excelExperience: { selectedValues: ['dashboards'], otherText: '' },
    });
  });

  it('replaces the questions with an in-dialog exit choice and restores focus and scroll when continuing', () => {
    render(
      <ClarificationModal
        questions={[question]}
        isOpen
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    const answer = screen.getByRole('button', { name: 'Built Excel dashboards' });
    fireEvent.click(answer);
    answer.focus();
    const dialog = screen.getByRole('dialog');
    Object.defineProperty(dialog, 'scrollTop', { configurable: true, writable: true, value: 180 });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByText(question.question)).not.toBeVisible();
    expect(screen.getByRole('button', { name: 'Keep answering' })).toHaveFocus();

    dialog.scrollTop = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Keep answering' }));

    expect(screen.getByText(question.question)).toBeInTheDocument();
    expect(answer).toHaveAttribute('aria-pressed', 'true');
    expect(answer).toHaveFocus();
    expect(dialog.scrollTop).toBe(180);
  });

  it('uses the X button to show the same in-dialog exit choice and optimizes at most once', () => {
    const onOptimizeNow = vi.fn();
    render(
      <ClarificationModal
        questions={[question]}
        isOpen
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onOptimizeNow={onOptimizeNow}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Built Excel dashboards' }));
    fireEvent.click(screen.getByRole('button', { name: /skip and proceed without answers/i }));

    expect(screen.getByText(question.question)).not.toBeVisible();
    const optimize = screen.getByRole('button', { name: 'Optimize now' });
    fireEvent.click(optimize);
    fireEvent.click(optimize);

    expect(onOptimizeNow).toHaveBeenCalledOnce();
    expect(onOptimizeNow).toHaveBeenCalledWith({
      excelExperience: { selectedValues: ['dashboards'], otherText: '' },
    });
  });

  it('uses a backdrop click to switch to the compact exit choice', () => {
    render(
      <ClarificationModal
        questions={[question]}
        isOpen
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(screen.getByText(question.question)).not.toBeVisible();
    expect(screen.getByRole('button', { name: 'Keep answering' })).toBeInTheDocument();
  });

  it('disables confirmation actions and answers while regeneration is in progress', () => {
    const questions = [question];
    const view = render(
      <ClarificationModal
        questions={questions}
        isOpen
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /skip and proceed without answers/i }));
    view.rerender(
      <ClarificationModal
        questions={questions}
        isOpen
        isRegenerating
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Keep answering' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Optimize now' })).toBeDisabled();
    expect(screen.getByText('Built Excel dashboards').closest('button')).toBeDisabled();
  });

  it('keeps a follow-up error visible in both the question and exit-choice views', () => {
    render(
      <ClarificationModal
        questions={[question]}
        isOpen
        error="Follow-up questions could not be loaded."
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Follow-up questions could not be loaded.');
    fireEvent.click(screen.getByRole('button', { name: /skip and proceed without answers/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Follow-up questions could not be loaded.');
  });

  it('gives selected evidence and hard-stop choices a stronger visible state', () => {
    render(
      <ClarificationModal
        questions={[question]}
        isOpen
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    const evidence = screen.getByRole('button', { name: 'Built Excel dashboards' });
    fireEvent.click(evidence);
    expect(evidence).toHaveClass('border-emerald-600', 'ring-1');
    expect(evidence.querySelector('svg')).toBeInTheDocument();

    const hardStop = screen.getByRole('button', { name: "I don't have Excel experience" });
    fireEvent.click(hardStop);
    expect(hardStop).toHaveClass('border-amber-600', 'bg-amber-400/25', 'ring-1');
    expect(hardStop).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the round and question numbers as clear badges', () => {
    render(
      <ClarificationModal
        questions={[question]}
        isOpen
        round={3}
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    expect(screen.getByText('Round 3 / 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Question 1')).toBeInTheDocument();
  });

  it('renders a localized regenerate control and invokes it on click', () => {
    const onRegenerate = vi.fn();
    render(
      <ClarificationModal
        questions={[question]}
        isOpen
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onRegenerate={onRegenerate}
      />,
    );

    const regenerate = screen.getByRole('button', { name: 'Generate different questions' });
    expect(regenerate).toHaveAttribute('title', 'Generate different questions');

    fireEvent.click(regenerate);
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  it('disables regeneration while a fresh question set is loading', () => {
    render(
      <ClarificationModal
        questions={[question]}
        isOpen
        isRegenerating
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Generate different questions' })).toBeDisabled();
  });
});
