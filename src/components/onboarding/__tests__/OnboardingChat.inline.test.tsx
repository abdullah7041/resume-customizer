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

  it('advances role -> location with Skip without any AI call', () => {
    render(<OnboardingChat path="has_cv" mode="inline" />);

    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }));
    expect(screen.getByText('Where do you want to work?')).toBeInTheDocument();
  });

  it('calls onComplete after the final slot (location) is resolved', () => {
    const onComplete = vi.fn();
    render(<OnboardingChat path="has_cv" mode="inline" onComplete={onComplete} />);

    // role -> location -> done
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
