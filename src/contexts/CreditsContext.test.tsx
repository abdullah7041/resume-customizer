import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreditsProvider, useCredits } from './CreditsContext';

const { authState, fromMock, singleMock } = vi.hoisted(() => ({
  authState: {
    user: { id: 'user-1', email: 'user@example.com' },
  },
  fromMock: vi.fn(),
  singleMock: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: authState.user }),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    from: fromMock,
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({
        unsubscribe: vi.fn(),
      }),
    })),
  },
}));

function makeDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });

  return { promise, resolve };
}

function CreditsProbe() {
  const { credits, isLoading } = useCredits();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="remaining">{credits?.remaining ?? 'none'}</span>
    </div>
  );
}

describe('CreditsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: 'user-1', email: 'user@example.com' };
    singleMock.mockReset();
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: singleMock,
        }),
      }),
    });
  });

  it('reuses one in-flight user_credits request across StrictMode remounts', async () => {
    const deferred = makeDeferred<{
      data: {
        credits_remaining: number;
        credits_total: number;
        feedback_credits_earned: number;
        referral_credits_earned: number;
        last_reset_date: string;
      };
      error: null;
    }>();
    singleMock.mockReturnValue(deferred.promise);

    render(
      <StrictMode>
        <CreditsProvider>
          <CreditsProbe />
        </CreditsProvider>
      </StrictMode>
    );

    expect(fromMock).toHaveBeenCalledTimes(1);

    deferred.resolve({
      data: {
        credits_remaining: 7,
        credits_total: 10,
        feedback_credits_earned: 2,
        referral_credits_earned: 1,
        last_reset_date: '2026-06-04T00:00:00.000Z',
      },
      error: null,
    });

    await waitFor(() => expect(screen.getByTestId('remaining')).toHaveTextContent('7'));
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it('does not refetch when auth re-emits a new user object for the same email', async () => {
    authState.user = { id: 'user-1', email: 'same-email@example.com' };
    singleMock.mockResolvedValue({
      data: {
        credits_remaining: 8,
        credits_total: 10,
        feedback_credits_earned: 2,
        referral_credits_earned: 1,
        last_reset_date: '2026-06-04T00:00:00.000Z',
      },
      error: null,
    });

    const { rerender } = render(
      <CreditsProvider>
        <CreditsProbe />
      </CreditsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('remaining')).toHaveTextContent('8'));
    expect(fromMock).toHaveBeenCalledTimes(1);

    authState.user = { id: 'user-1', email: 'same-email@example.com' };
    rerender(
      <CreditsProvider>
        <CreditsProbe />
      </CreditsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('remaining')).toHaveTextContent('8'));
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
