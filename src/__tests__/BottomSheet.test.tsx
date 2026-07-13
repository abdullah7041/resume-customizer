import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BottomSheet } from '@/components/ui/BottomSheet';

describe('BottomSheet drag dismissal', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not dismiss a short drag after the release velocity has gone stale', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet isOpen onClose={onClose} title="Actions">
        Content
      </BottomSheet>,
    );

    const grabber = screen.getByRole('dialog').querySelector('.touch-none');
    expect(grabber).not.toBeNull();
    Object.defineProperty(grabber, 'setPointerCapture', { value: vi.fn() });

    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    fireEvent.pointerDown(grabber!, { clientY: 0, pointerId: 1 });
    now = 100;
    fireEvent.pointerMove(grabber!, { clientY: 60, pointerId: 1 });
    now = 110;
    fireEvent.pointerMove(grabber!, { clientY: 65, pointerId: 1 });
    now = 1_000;
    fireEvent.pointerUp(grabber!, { clientY: 65, pointerId: 1 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('starts a reopened sheet at zero offset after a distance dismissal', () => {
    const onClose = vi.fn();
    const renderSheet = (isOpen: boolean) => (
      <BottomSheet isOpen={isOpen} onClose={onClose} title="Actions">
        Content
      </BottomSheet>
    );
    const { rerender } = render(renderSheet(true));

    const grabber = screen.getByRole('dialog').querySelector('.touch-none');
    expect(grabber).not.toBeNull();
    Object.defineProperty(grabber, 'setPointerCapture', { value: vi.fn() });

    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    fireEvent.pointerDown(grabber!, { clientY: 0, pointerId: 1 });
    now = 100;
    fireEvent.pointerMove(grabber!, { clientY: 120, pointerId: 1 });
    now = 110;
    fireEvent.pointerUp(grabber!, { clientY: 120, pointerId: 1 });
    expect(onClose).toHaveBeenCalledOnce();

    rerender(renderSheet(false));
    rerender(renderSheet(true));

    const reopenedGrabber = screen.getByRole('dialog').querySelector('.touch-none');
    expect(reopenedGrabber).not.toBeNull();
    now = 200;
    fireEvent.pointerDown(reopenedGrabber!, { clientY: 0, pointerId: 1 });

    expect(reopenedGrabber?.parentElement).toHaveStyle({ transform: 'translateY(0px)' });
  });
});
