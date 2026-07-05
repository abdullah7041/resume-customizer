# Goal 3: Value-moment feedback prompt

**Model**: Opus direct. No Fable, no plan mode needed beyond a quick review.

Implement automatic value-moment feedback prompting per `docs/VALIDATION_AND_LAUNCH_DECISION_PLAN.md` section 2.

Spec: after match success, optimize success, export success, or pipeline save, prompt the authenticated user with the EXISTING manual feedback modal. At most once per session, deduped via sessionStorage key `watheq:feedbackPromptedThisSession`. Guests are never prompted. Do not build a new modal or new questions — reuse the shipped one (rating, required text, trust_to_apply, willingness_to_pay).

Constraints:

- No resume/JD/AI text in analytics.
- `feedback_submitted` event fires only on API success (already wired — don't double-emit).
- `watheq:` key prefix; no `any` types.

State your plan in 5 lines before coding.

Done when: feedback modal auto-opens at most once per session after a value moment, dedup key works, existing manual path untouched, Vitest for trigger + dedup logic passes, lint:fix clean on touched files.
