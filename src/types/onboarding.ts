// src/types/onboarding.ts
// Conversational onboarding types. `SearchIntent` is the one new canonical-profile
// slice — target role / comp / location are job-search intent and do not live in a
// resume. Everything else onboarding produces populates the existing resumeStore.

/**
 * Job-search intent captured during onboarding. Persisted under `watheq:searchIntent`
 * and stored server-side in `resumes.search_intent` (jsonb). Read by the optimize
 * endpoint so the stored profile actually changes per-job tailoring output.
 */
export interface SearchIntent {
  targetRoles: string[]; // ["Senior Frontend Engineer"]
  seniority?: 'junior' | 'mid' | 'senior' | 'lead' | 'manager';
  compRange?: {
    min: number;
    max: number;
    currency: string; // "SAR"
    period: 'month' | 'year';
  };
  location?: {
    city?: string;
    country?: string; // "SA"
    workMode: 'remote' | 'hybrid' | 'onsite';
  };
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
export type OnboardingSlot = 'cv_basics' | 'role' | 'comp' | 'location';

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
