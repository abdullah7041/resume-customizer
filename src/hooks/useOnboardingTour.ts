import { useCallback } from 'react';

const STORAGE_KEY = 'watheq:onboardingTourCompleted';

/**
 * Onboarding tour hook — react-joyride removed (see App.tsx).
 *
 * The Joyride-driven overlay was removed because it auto-started and, on mobile,
 * could mount a full-screen overlay (`overlayColor`, `zIndex: 10000`) over a
 * missing target, dimming the page and blocking all clicks.
 *
 * This hook is kept as a stable shape so existing consumers (e.g.
 * `HRSuperSaudOverlay isOnboardingActive={run}`) keep compiling. `run` is
 * permanently `false` — nothing auto-mounts. `startTour`/`resetTour` remain as
 * explicit, no-op-safe entry points for a future non-Joyride implementation but
 * never auto-fire.
 */
export function useOnboardingTour() {
  const startTour = useCallback(() => {
    // No-op: Joyride-driven tour removed. Kept as an explicit entry point for a
    // future replacement implementation.
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    run: false,
    steps: [] as never[],
    stepIndex: 0,
    handleEvent: () => {},
    startTour,
    resetTour,
  };
}
