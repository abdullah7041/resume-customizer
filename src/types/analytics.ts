export type GetStartedSource = 'hero' | 'walkthrough' | 'final_cta' | 'footer';

/**
 * Job-variant analytics events (docs/adr/ADR-job-specific-resume-builder.md
 * Phase-2 gate). Fired with NO properties: a variant's label, job title,
 * company, and job-description text are user-authored and must never reach
 * analytics. Event *counts* alone answer the ADR's gate —
 * save rate = variant_saved / optimization_completed,
 * reopen rate = variant_opened / variant_saved.
 */
export const VARIANT_SAVED_EVENT = 'variant_saved' as const;
export const VARIANT_OPENED_EVENT = 'variant_opened' as const;
export type JobVariantAnalyticsEvent = typeof VARIANT_SAVED_EVENT | typeof VARIANT_OPENED_EVENT;

/**
 * Optimize-completion event — the save-rate denominator for the job-variant
 * gate above. Pairs with the existing `optimization_failed` event
 * (src/services/analytics.ts) so the flagship optimize action has a full
 * success/failure pair, matching the match triad's
 * `match_analysis_success` / `match_analysis_failed`.
 */
export const OPTIMIZATION_COMPLETED_EVENT = 'optimization_completed' as const;
