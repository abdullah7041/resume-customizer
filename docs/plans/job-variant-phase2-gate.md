# Job-Variant Phase-2 Gate: Making the ADR's Kill Criteria Measurable

**Status:** Instrumentation shipped (this doc). The 4-week measurement window has
not started yet — see "When to check" below.
**Related:** `docs/adr/ADR-job-specific-resume-builder.md` §9 (Kill Criteria), §11
(Action Items); plan `plans/022-spike-instrument-job-variant-gate.md`.

## 1. The finding

Phase 1 of the Job-Specific Resume Builder has shipped: the `jobVariants` /
`activeVariantId` store slice (`src/lib/stores/resumeStore.ts`), the
`JobVariantsBar` UI (`src/components/sections/JobVariantsBar.tsx`), and their
tests are all live.

The ADR's Phase-2 gate (`docs/adr/ADR-job-specific-resume-builder.md:224-229`)
reads:

> **Kill the idea (after Phase 1 ships)** if the feature doesn't earn its keep
> over ~4 weeks:
> - Variant **save rate** stays below ~5% of optimize completions ..., **or**
> - Variant **reopen rate** stays below ~10% of saved variants ...
>
> Do **not** advance to Phase 2 ... until Phase 1 clears both thresholds.

Before this change, that gate was **unanswerable**: a repo-wide search found no
variant-related analytics event anywhere (`src/types/analytics.ts` had zero
matches for "variant"; `JobVariantsBar.tsx` imported no analytics module). The
denominator was missing too — "save rate" is defined against **optimize
completions**, but `src/services/analytics.ts` tracked only
`optimization_failed` (`:371` before this change); no event fired on a
successful optimize run. Saving and reopening a variant make no AI call, so
none of this is recoverable from `ai_usage_events` either — the ADR's own
action item 1 (`:253`) measures a different, already-resolved question (the
pre-Phase-1 build signal), not this gate.

So the maintainer had no way to ever check the gate, regardless of how long
Phase 1 ran in production.

## 2. What was added

Three Mixpanel events, all fired with **zero properties** — counts alone
answer the gate, so there is nothing to bucket and nothing to leak.

| Event | Fired from | Fires when |
|---|---|---|
| `variant_saved` | `src/components/sections/JobVariantsBar.tsx` `commitSave()` (`src/services/analytics.ts` `trackVariantSaved()`) | A user names and saves the current optimize run as a variant. |
| `variant_opened` | `src/components/sections/JobVariantsBar.tsx` `handleOpen()` (`trackVariantOpened()`) | A user deliberately clicks an existing variant chip to reopen it, and the lookup succeeds. |
| `optimization_completed` | `src/components/Layout/MainContent.tsx` `handleOptimizeActual()`, immediately after `result` is available from either the SSE or legacy-fallback path (`trackOptimizationCompleted()`) | An optimize run completes successfully, exactly once per user-initiated run. |

**`variant_saved` counts variant *creations* only.** `handleUpdateActive`
("Save changes" in `JobVariantsBar.tsx`, which calls the store's
`updateVariant`) deliberately does **not** fire `trackVariantSaved()`. Firing
it there would inflate both the save-rate numerator (double-counting one
variant as multiple "saves") and the reopen-rate denominator (an update is
not a new saved variant). When reading the gate: `variant_saved` = "the user
created a new variant," not "any write to a variant."

**What they deliberately do not carry:** no variant label, no job title, no
company name, no job-description text, no resume content. This repo's
analytics posture (`src/services/analytics.ts`) is bucketed enums / counts
only, and a variant's label and JD are user-authored, potentially identifying
free text. In this case there wasn't even a bucketed count worth sending — the
gate only needs event *counts* — so the safest and simplest choice was no
payload at all. This is enforced by a test
(`src/components/sections/JobVariantsBar.test.tsx`, "sends no properties")
that asserts the tracker calls take zero arguments and scans the mock call
args for the label/JD strings used in the test.

**Where the event types live:** `src/types/analytics.ts` now exports
`VARIANT_SAVED_EVENT`, `VARIANT_OPENED_EVENT`, and
`OPTIMIZATION_COMPLETED_EVENT` as the source of truth for these three literal
event names, per this repo's convention of declaring event
names/types in `types/analytics.ts` and the tracker methods in
`services/analytics.ts`.

**Double-count guard (the part most likely to be wrong):**

- *Reopen rate risk:* `openVariant()` (the store action) is called from
  exactly one call site in production code — `JobVariantsBar.tsx`'s
  `handleOpen()`, wired to a variant chip's `onClick`. Saving a variant
  (`saveCurrentAsVariant`) sets `activeVariantId` directly without calling
  `openVariant()`, and zustand's `persist` middleware rehydrates
  `jobVariants`/`activeVariantId` on page load by restoring state directly,
  never by invoking the `openVariant` action. So a page refresh that leaves a
  variant "active" cannot fire `variant_opened` — only an explicit click can.
  Tested by "does NOT fire the variant-opened event when a variant is merely
  restored as active on mount" in `JobVariantsBar.test.tsx`.
- *Save-rate denominator risk:* `MainContent.tsx`'s `handleOptimizeActual`
  tries the SSE endpoint (`optimizeResumeStream`) first and falls back to the
  legacy endpoint (`optimizeResume`) only when the SSE call fails with a
  billing-safe error. `trackOptimizationCompleted()` is placed **after** that
  inner try/catch has already resolved to a single `result` — not inside
  either branch — so it fires exactly once per user-initiated run regardless
  of which path produced the result. Tested by two new
  `src/__tests__/MainContent.test.jsx` cases: one asserting exactly one call
  on the pure-SSE-success path, and one asserting exactly one call (not two)
  when SSE fails and the legacy fallback succeeds for the same user action.

**A correction to the plan that authored this spike:** the plan assumed
`optimization_failed` already had a live call site in `MainContent.tsx` to
place the new success event beside ("the sibling branch"). That assumption
was wrong — `trackOptimizationFailed()` is defined in `analytics.ts` and
referenced only in test mocks (`recommendation-cards.test.jsx`,
`optimize-zero-noise.test.jsx`, `optimize-verify-integrity.test.jsx`); no
production code calls it today. `optimization_completed` was still placed
correctly (in the shared success continuation described above), so this
didn't block the spike, but it means **failed optimize runs are currently
untracked too** — the funnel has no denominator-side visibility into
"attempted but failed" separate from "never attempted." That gap is outside
this spike's scope (it doesn't affect the save-rate/reopen-rate math, which
only needs completions) but is worth a follow-up: wiring
`trackOptimizationFailed()` into the `catch` block of `handleOptimizeActual`
(`src/components/Layout/MainContent.tsx`) alongside the existing
`optimizationFailed` toast.

## 3. How to compute the gate

Both ratios are plain Mixpanel event-count ratios over the same rolling
window:

- **Save rate** = count(`variant_saved`) ÷ count(`optimization_completed`)
- **Reopen rate** = count(`variant_opened`) ÷ count(`variant_saved`)

**`optimization_completed` counts completed runs, not distinct jobs.** A
guest who runs a free preview and then pays to re-run the same job
(`onRequirePaidReoptimize` in `MainContent.tsx`, wired to
`handleOptimize('auto', { freePreview: false })`) produces **two**
`optimization_completed` events for what is, from the user's perspective, one
job — even though at most one of those runs can become one `variant_saved`.
This is the correct behavior for "fires once per user-initiated run" (each
API call the user asked for is a real run), but it means the save-rate
denominator is inflated relative to *distinct jobs worked on*, not inflated
by a bug. If the free-preview-to-paid-conversion rate is high, expect the
measured save rate to read a little lower than the "true" per-job rate.

`optimization_completed` did not exist before this change — **there is no
historical data**. Every optimize run before this instrumentation deploys is
invisible to this gate. The 4-week window described in the ADR genuinely
starts counting from zero at deployment; it cannot be backfilled or
approximated from `ai_usage_events` (which records AI calls, not user-facing
save/reopen actions, and predates the variant feature's usage signal
entirely).

## 4. When to check

The ADR's window is ~4 weeks from when the feature is actually exposed to
users generating data — i.e. from **deployment**, not from when this commit
merges. This spike does not deploy anything; a human must record the actual
deploy date.

Stated explicitly: if this instrumentation deploys on **2026-08-09** (today,
per the session this spike ran in), the earliest the ~4-week window closes is
**2026-09-06**. Recompute this date from the real deploy date once known — do
not treat 2026-09-06 as fixed if deployment slips.

## 5. The three possible outcomes

1. **Both thresholds clear** (save rate ≥ ~5% of `optimization_completed`,
   reopen rate ≥ ~10% of `variant_saved`) → Phase 2 is unblocked *as a
   candidate*, not automatically green-lit. The ADR's own hard gate at
   `docs/adr/ADR-job-specific-resume-builder.md:243` still applies: Phase 2
   (server persistence) cannot ship until `netlify/functions/user-data-api.ts`
   export/delete coverage is extended to variants (§5 of the ADR marks this
   **⚑ SCHEMA/CONTRACT**, not optional).
2. **Either threshold misses** → per the ADR, kill the idea and reclaim the
   `jobVariants` store slice, `JobVariantsBar`, and their tests, plus the
   `resume-storage` migration needed to drop the slice cleanly (noted in the
   ADR's action items and this spike's source plan).
3. **Inconclusive volume** (too few `optimization_completed` events in the
   window for the ratios to be statistically meaningful — e.g. low double
   digits) → extend the measurement window rather than making a call on noise.
   This spike does not define a specific minimum sample size; the maintainer
   should sanity-check the raw `optimization_completed` count before trusting
   either ratio.

This spike does not make the Phase-2 build/kill call. Its job was only to make
the call possible.

## 6. Open questions this spike could not resolve from the repo alone

- **Consent gating limits who is measured.** `src/services/analytics.ts` only
  sends events after `useConsentStore` reports `analyticsConsent: true` and
  Mixpanel successfully initializes (`src/services/analytics.init.test.ts`
  documents this gate). All three new events — like every existing event in
  this file — are invisible for users who decline analytics consent or have
  Do Not Track enabled. The gate's ratios will only ever reflect
  **consenting users**, not the full user base. If consent opt-in is low or
  skews toward a particular user segment (e.g. more technical users more
  likely to accept analytics), the measured save/reopen rates may not
  represent the whole population. This spike has no visibility into the
  actual consent opt-in rate in production; the maintainer should check it
  (e.g. via Mixpanel's own event volume vs. total active users) before
  trusting the gate numbers at face value.
- **No minimum sample size is defined.** The ADR states percentage thresholds
  but not a minimum `optimization_completed` count needed for those
  percentages to be meaningful. A maintainer reading "3% save rate" needs to
  know whether that's 3 of 100 or 30 of 1000 before deciding it's a real
  signal.
- **`trackOptimizationFailed()` has no call site**, as noted in section 2 —
  this is a pre-existing gap, not something this spike introduced or was
  asked to fix, but it means the optimize funnel's failure side stays dark
  until someone wires it up.
- **Guest / signed-out users, and the free-preview re-run path specifically.**
  This spike did not investigate whether `JobVariantsBar` and the optimize
  flow behave differently for guests vs. signed-in users in a way that would
  skew which population the gate measures. One concrete instance found but
  not quantified: `MainContent.tsx`'s `onRequirePaidReoptimize` lets a guest
  preview a job for free, then pay to re-run the *same* job — that produces
  two `optimization_completed` events (see §3) for one job the user might
  save once. If free-preview-to-paid conversion volume is high, the save
  rate will read structurally lower than a "per distinct job" measure would.
  This spike doesn't know the actual free-preview conversion rate; the
  maintainer should check it before concluding a low save rate means low
  variant demand rather than an artifact of this counting path.
