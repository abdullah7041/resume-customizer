import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExitPresence } from '@/hooks/useExitPresence';

describe('useExitPresence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps content mounted during the exit animation', () => {
    const { result, rerender } = renderHook(
      ({ open }) => useExitPresence(open),
      { initialProps: { open: true } },
    );

    rerender({ open: false });

    expect(result.current).toEqual({ shouldRender: true, isExiting: true });

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current.shouldRender).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toEqual({ shouldRender: false, isExiting: false });
  });

  it('cancels a pending unmount when reopened', () => {
    const { result, rerender } = renderHook(
      ({ open }) => useExitPresence(open),
      { initialProps: { open: true } },
    );

    rerender({ open: false });
    rerender({ open: true });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toEqual({ shouldRender: true, isExiting: false });
  });
});
