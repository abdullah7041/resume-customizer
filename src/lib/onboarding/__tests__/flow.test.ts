import { describe, it, expect } from 'vitest';
import {
  SLOT_SEQUENCE,
  initialState,
  nextSlot,
  advance,
  isComplete,
  progress,
  terminalAction,
} from '../flow';
import type { OnboardingState } from '@/types/onboarding';

describe('onboarding flow state machine', () => {
  describe('initialState', () => {
    it('starts has_cv at cv_basics with nothing answered', () => {
      const s = initialState('has_cv');
      expect(s.path).toBe('has_cv');
      expect(s.current).toBe('cv_basics');
      expect(s.answered).toEqual({});
    });

    it('starts no_cv at cv_basics with nothing answered', () => {
      const s = initialState('no_cv');
      expect(s.path).toBe('no_cv');
      expect(s.current).toBe('cv_basics');
    });
  });

  describe('nextSlot', () => {
    it('returns the first unanswered slot in canonical order', () => {
      const s: OnboardingState = { path: 'has_cv', current: 'cv_basics', answered: { cv_basics: true } };
      expect(nextSlot(s)).toBe('role');
    });

    it('returns done when every slot is answered', () => {
      const s: OnboardingState = {
        path: 'has_cv',
        current: 'location',
        answered: { cv_basics: true, role: true, comp: true, location: true },
      };
      expect(nextSlot(s)).toBe('done');
    });

    it('ignores answer order and returns the earliest gap', () => {
      const s: OnboardingState = { path: 'no_cv', current: 'cv_basics', answered: { comp: true } };
      expect(nextSlot(s)).toBe('cv_basics');
    });
  });

  describe('advance', () => {
    it('marks the slot answered and moves current to the next gap', () => {
      const s = advance(initialState('has_cv'), 'cv_basics');
      expect(s.answered.cv_basics).toBe(true);
      expect(s.current).toBe('role');
    });

    it('does not mutate the input state', () => {
      const s0 = initialState('has_cv');
      const s1 = advance(s0, 'cv_basics');
      expect(s0.answered).toEqual({});
      expect(s1).not.toBe(s0);
    });

    it('reaches done after the full sequence', () => {
      let s = initialState('no_cv');
      for (const slot of SLOT_SEQUENCE) {
        s = advance(s, slot);
      }
      expect(s.current).toBe('done');
      expect(isComplete(s)).toBe(true);
    });

    it('treats a skipped slot (advanced without a value) as handled', () => {
      // The machine advances identically whether the component patched a value or
      // the user hit Skip — both just mark the slot answered.
      let s = initialState('has_cv');
      s = advance(s, 'cv_basics'); // answered with a value
      s = advance(s, 'role'); // skipped
      expect(s.current).toBe('comp');
    });
  });

  describe('progress', () => {
    it('counts answered vs total slots', () => {
      const s = advance(initialState('has_cv'), 'cv_basics');
      expect(progress(s)).toEqual({ answered: 1, total: 4 });
    });
  });

  describe('terminalAction (Path A vs Path B branch)', () => {
    it('generates a starter CV when the user had no CV', () => {
      expect(terminalAction('no_cv')).toBe('generateStarterCV');
    });

    it('does nothing extra when the user already had a CV', () => {
      expect(terminalAction('has_cv')).toBe('none');
    });
  });
});
