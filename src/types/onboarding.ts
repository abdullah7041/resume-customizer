// src/types/onboarding.ts
// Conversational onboarding types. `SearchIntent` is the one new canonical-profile
// slice — the target role is job-search intent and does not live in a resume.
// Everything else onboarding produces populates the existing resumeStore.
//
// Scope note: salary/comp was dropped entirely (didn't feed anything downstream —
// no display, no tailoring signal, just a sensitive question with no payoff), and the
// location/work-mode question was later removed for the same reason. Role is
// collected but is NOT injected into the optimize prompt: the endpoint always
// requires a job description, which already dominates tailoring, so there is no
// "no-JD" case that would justify biasing the AI call with stated intent. Role
// still drives the no-CV starter-CV path and remains stored as profile-level
// signal for future personalization (item 2).

/**
 * Job-search intent captured during onboarding. Persisted under `watheq:searchIntent`
 * and stored server-side in `resumes.search_intent` (jsonb).
 */
export interface SearchIntent {
  targetRoles: string[]; // ["Senior Frontend Engineer"]
  seniority?: 'junior' | 'mid' | 'senior' | 'lead' | 'manager';
  meta: {
    confidence: 'low' | 'medium' | 'high';
    completeness: number; // 0-100, foundation for item 2
    updatedAt: string; // ISO
  };
}

/**
 * The deterministic slots onboarding fills, in canonical order. `cv_basics` is a
 * confirm step on Path A (name/title already parsed) and an input step on Path B
 * (name + 1-2 achievements typed by hand).
 */
export type OnboardingSlot = 'cv_basics' | 'role';

export type OnboardingPath = 'has_cv' | 'no_cv';

export interface OnboardingState {
  path: OnboardingPath;
  current: OnboardingSlot | 'done';
  /** A slot is "answered" once we move past it — whether filled or skipped. */
  answered: Partial<Record<OnboardingSlot, true>>;
}

/**
 * Confidence the `onboard-extract` function reports for a single parsed slot value.
 */
export type SlotConfidence = 'low' | 'medium' | 'high';
