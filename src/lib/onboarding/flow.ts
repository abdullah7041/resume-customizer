// src/lib/onboarding/flow.ts
// Pure, testable onboarding state machine. No network, no React, no store. Decides
// the next slot from OnboardingState and branches Path A (has_cv) vs Path B (no_cv).
import type { OnboardingPath, OnboardingSlot, OnboardingState } from '@/types/onboarding';

/**
 * Canonical slot order. Both paths walk the same four slots; the path difference is
 * what `cv_basics` means in the UI (confirm vs input) and the terminal action.
 */
export const SLOT_SEQUENCE: readonly OnboardingSlot[] = ['cv_basics', 'role', 'comp', 'location'];

/** Fresh machine for a path, starting at the first slot with nothing answered. */
export function initialState(path: OnboardingPath): OnboardingState {
  return { path, current: SLOT_SEQUENCE[0], answered: {} };
}

/**
 * The next slot to ask: the earliest slot in canonical order not yet answered, or
 * 'done' when all four are handled. Order-independent so the machine stays correct
 * even if slots are answered out of sequence.
 */
export function nextSlot(state: OnboardingState): OnboardingSlot | 'done' {
  for (const slot of SLOT_SEQUENCE) {
    if (!state.answered[slot]) return slot;
  }
  return 'done';
}

/**
 * Mark a slot handled and recompute `current`. "Handled" covers both a filled answer
 * and a Skip — the machine advances identically; only the component decides whether a
 * value was patched into searchIntent. Returns a new state (never mutates the input).
 */
export function advance(state: OnboardingState, slot: OnboardingSlot): OnboardingState {
  const answered = { ...state.answered, [slot]: true as const };
  const next = nextSlot({ ...state, answered });
  return { ...state, answered, current: next };
}

/** True once every slot is handled and the machine is at 'done'. */
export function isComplete(state: OnboardingState): boolean {
  return nextSlot(state) === 'done';
}

/** Answered vs total slot counts, for progress dots. */
export function progress(state: OnboardingState): { answered: number; total: number } {
  const answered = SLOT_SEQUENCE.filter((slot) => state.answered[slot]).length;
  return { answered, total: SLOT_SEQUENCE.length };
}

/**
 * Path branch: a no_cv user needs a starter CV generated from their answers at the
 * end; a has_cv user already has one from parse-resume.
 */
export function terminalAction(path: OnboardingPath): 'generateStarterCV' | 'none' {
  return path === 'no_cv' ? 'generateStarterCV' : 'none';
}
