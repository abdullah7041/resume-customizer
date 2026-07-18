# Watheq — Conversational mobile onboarding (item 1)

Implemented spec. A first-time phone user finishes onboarding without a form and
without uploading twice. Output is the canonical profile: existing resume data plus
a new `searchIntent` (target role). Role feeds the no-CV starter-CV path and is kept
as profile-level signal for future personalization (item 2).

**Scope note:** salary/comp was dropped entirely — it fed nothing downstream (no
display, no tailoring signal), just a sensitive question with no payoff. The
location/work-mode question was later removed for the same reason. `role` is
collected but is NOT injected into the optimize prompt: `optimize` always requires a
job description, which already dominates tailoring, so there is no "no-JD" case that
would justify biasing the AI call with stated intent.

## Design

- **No parallel store.** Canonical profile is `resumeStore` + the Supabase resume row.
  Onboarding only populates it. `searchIntent` is the one new slice.
- **Deterministic slot-filling, not a free agent.** Slots: `cv_basics`, `role`.
  Fixed client-side sequence (`src/lib/onboarding/flow.ts`). The LLM is called once
  per answer (`onboard-extract`), only to parse one freeform reply into one
  structured slot value. No server-side multi-turn loop.
- **Voice = the OS keyboard mic.** Plain text input; the native keyboard dictation
  button gives voice on iOS/Android. No STT code.
- **Two paths, one destination.**
  - Path A (has CV): upload/paste → `parse-resume` → confirm name/title → role → done.
  - Path B (no CV): name + 1-2 achievements → role → generate starter CV → done.
- **Onboard guests, gate save behind sign-in.** Guests complete onboarding in-store;
  flush to Supabase on sign-in.

## Where it lives

| Concern | File |
| --- | --- |
| Types | `src/types/onboarding.ts` (`SearchIntent`, `OnboardingSlot`, `OnboardingState`) |
| Client Zod | `src/lib/validation/store-schemas.ts` (`SearchIntentSchema`) |
| Server Zod | `netlify/lib/resume-schemas.ts` (`SearchIntentSchema`, `OnboardExtractRequestSchema`) |
| State machine | `src/lib/onboarding/flow.ts` (+ `__tests__/flow.test.ts`) |
| Slot extraction | `netlify/functions/onboard-extract.ts` (`lite`, `reasoningBudget: 0`) |
| Store slice | `resumeStore.ts` (`searchIntent`, `setSearchIntent`, `patchProfile`, `getProfileCompleteness`) |
| UI | `src/components/onboarding/OnboardingChat.tsx` |
| Persistence | `user-data-api` actions `save_search_intent` / `get_search_intent` |
| Migration | `supabase/migrations/20260630000000_add_search_intent.sql` (run manually) |

## Storage keys

- `watheq:searchIntent` persisted client-side via the existing `resume-storage` Zustand
  persist (survives refresh; flushed to Supabase on sign-in).
- `resumes.search_intent jsonb` server-side.

## Single writer

All onboarding resume writes go through `resumeStore.patchProfile` (fuzzy-merge +
`meta.ai_suggestions` provenance). The onboarding component never writes
`originalResume` directly.

## Out of scope (v1)

Server-side STT, a conversational agent loop, portal scanning, multi-resume profiles.
