import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OnboardingChat from '../OnboardingChat';
import { useResumeStore } from '@/lib/stores/resumeStore';

vi.mock('@/services/api', () => ({
  onboardExtract: vi.fn(),
}));

describe('OnboardingChat — inline (Path A) mode', () => {
  beforeEach(() => {
    useResumeStore.setState({ originalResume: null, searchIntent: null });
  });

  it('starts at the role slot, skipping cv_basics', () => {
    render(<OnboardingChat path="has_cv" mode="inline" />);

    expect(screen.getByText('What role are you targeting?')).toBeInTheDocument();
    // cv_basics confirm step must NOT appear inline — name/title came from parse.
    expect(screen.queryByText('Is this you?')).toBeNull();
  });

  it('renders a "Not now" dismiss that calls onDismiss', () => {
    const onDismiss = vi.fn();
    render(<OnboardingChat path="has_cv" mode="inline" onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('never asks a location question', () => {
    render(<OnboardingChat path="has_cv" mode="inline" />);

    expect(screen.queryByText('Where do you want to work?')).toBeNull();
    expect(screen.queryByRole('button', { name: /remote|hybrid|onsite/i })).toBeNull();
  });

  it('calls onComplete after the final slot (role) is resolved', () => {
    const onComplete = vi.fn();
    render(<OnboardingChat path="has_cv" mode="inline" onComplete={onComplete} />);

    // role -> done (role is the terminal slot; no location question follows)
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Where do you want to work?')).toBeNull();
  });

  it('completes the fullscreen no_cv path after cv_basics and role only', () => {
    render(<OnboardingChat path="no_cv" mode="fullscreen" />);

    expect(screen.getByText("Let's start with you")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i })); // cv_basics
    expect(screen.getByText('What role are you targeting?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i })); // role -> done

    expect(screen.getByText(/you(&apos;|')re set/i)).toBeInTheDocument();
    expect(screen.queryByText('Where do you want to work?')).toBeNull();
  });
});
