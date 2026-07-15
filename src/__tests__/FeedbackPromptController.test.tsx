import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FEEDBACK_PROMPTED_SESSION_KEY,
  FeedbackPromptController,
  requestValueMomentFeedbackPrompt,
} from '../components/Feedback/FeedbackPromptController';

const authState = vi.hoisted(() => ({
  user: null as null | { id: string },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../components/Feedback/FeedbackModal', () => ({
  FeedbackModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="feedback-modal" data-open={isOpen}>
      {isOpen && <button onClick={onClose}>Feedback modal</button>}
    </div>
  ),
}));

describe('FeedbackPromptController', () => {
  beforeEach(() => {
    authState.user = null;
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not load the feedback modal module during controller import', async () => {
    vi.resetModules();
    const feedbackModalModuleLoad = vi.fn();

    vi.doMock('../hooks/useAuth', () => ({
      useAuth: () => ({ user: { id: 'user-123' } }),
    }));
    vi.doMock('../components/Feedback/FeedbackModal', () => {
      feedbackModalModuleLoad();
      return {
        FeedbackModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
          <div data-testid="feedback-modal" data-open={isOpen}>
            {isOpen && <button onClick={onClose}>Feedback modal</button>}
          </div>
        ),
      };
    });

    await import('../components/Feedback/FeedbackPromptController');

    expect(feedbackModalModuleLoad).not.toHaveBeenCalled();
  });

  it('opens the existing feedback modal for authenticated value moments', async () => {
    authState.user = { id: 'user-123' };
    render(<FeedbackPromptController />);

    act(() => requestValueMomentFeedbackPrompt('match_success'));

    expect(await screen.findByRole('button', { name: 'Feedback modal' })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(FEEDBACK_PROMPTED_SESSION_KEY)).toBe('true');
  });

  it('keeps the modal mounted long enough to play its exit animation', async () => {
    authState.user = { id: 'user-123' };
    render(<FeedbackPromptController />);

    act(() => requestValueMomentFeedbackPrompt('match_success'));
    const closeButton = await screen.findByRole('button', { name: 'Feedback modal' });
    vi.useFakeTimers();
    fireEvent.click(closeButton);

    expect(screen.getByTestId('feedback-modal')).toHaveAttribute('data-open', 'false');

    act(() => vi.advanceTimersByTime(200));

    expect(screen.queryByTestId('feedback-modal')).not.toBeInTheDocument();
  });

  it('does not prompt guests', () => {
    render(<FeedbackPromptController />);

    act(() => requestValueMomentFeedbackPrompt('optimize_success'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(FEEDBACK_PROMPTED_SESSION_KEY)).toBeNull();
  });

  it('prompts at most once per session', () => {
    authState.user = { id: 'user-123' };
    window.sessionStorage.setItem(FEEDBACK_PROMPTED_SESSION_KEY, 'true');
    render(<FeedbackPromptController />);

    act(() => requestValueMomentFeedbackPrompt('export_success'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
