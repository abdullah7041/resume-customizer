# Plan 022: SPIKE — make the ADR's Phase-2 gate for Job Variants actually measurable

> **Executor instructions**: This is a **spike**, not a build-everything plan.
> Its deliverable is a written recommendation plus the smallest instrumentation
> needed to answer a decision question. Follow the steps in order, run every
> verification command, and honour the STOP conditions. When done, update the
> status row for this plan in `plans/README.md` — unless a reviewer dispatched
> you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat d2fba38..HEAD -- src/components/sections/JobVariantsBar.tsx src/lib/stores/resumeStore.ts src/services/analytics.ts src/types/analytics.ts docs/adr/ADR-job-specific-resume-builder.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `d2fba38`, 2026-08-08

## Why this matters

`docs/adr/ADR-job-specific-resume-builder.md` designs the Job-Specific Resume
Builder in three phases. **Phase 1 has shipped** — the `jobVariants` slice, the
`JobVariantsBar` UI, and their tests are all live. Phase 2 (Supabase persistence
of variants) is explicitly gated behind measured usage.

The problem: **the gate cannot be evaluated, because nothing measures it.** The
ADR asks for a variant *save rate* and a variant *reopen rate*, both of which
are frontend interaction events. A search across `src/` for variant-related
analytics turns up nothing, and `src/components/sections/JobVariantsBar.tsx`
contains no reference to `analytics`, `track`, or `mixpanel` at all.

So the decision "do we build Phase 2?" is currently unanswerable, and will stay
unanswerable for another four weeks after anyone notices — because the
measurement window only starts once instrumentation exists.

This spike closes that: add the two events, confirm they flow, and write down
what the maintainer should check and when. It deliberately does **not** build
Phase 2, and does not decide whether Phase 2 should happen.

## Current state

### The gate, verbatim from the ADR

`docs/adr/ADR-job-specific-resume-builder.md:224-229`:

```
**Kill the idea (after Phase 1 ships)** if the feature doesn't earn its keep over ~4 weeks:

- Variant **save rate** stays below ~5% of optimize completions (users finish a run but never save it as a variant), **or**
- Variant **reopen rate** stays below ~10% of saved variants (users save but never come back). Saving without reopening means the value was in the single run, not the persistence — kill and reclaim the store/UI complexity before Phase 2.

Do **not** advance to Phase 2 (server persistence, with its migration + export/delete + retention cost) until Phase 1 clears both the save-rate and reopen-rate thresholds.
```

Note what those two metrics need:
- **save rate** = variant-save events ÷ optimize-completion events
- **reopen rate** = variant-open events ÷ variant-save events

### The ADR's own action item is about the *wrong* phase

`docs/adr/ADR-job-specific-resume-builder.md:253`:

```
1. [ ] Confirm the Phase-1 kill-criteria metric is queryable from current `ai_usage_events` + JD-fingerprint data before committing to build.
```

That item concerns the **pre-Phase-1 build signal** (§9's "Build Phase 1 if…"
clause, derivable from `ai_usage_events`). It is now moot — Phase 1 was built.
Do not spend time on it. The live question is the post-ship gate above, and
`ai_usage_events` cannot answer it: saving and reopening a variant make no AI
call, so they produce no `ai_usage_events` rows at all.

### The ADR is also mislabelled

`docs/adr/ADR-job-specific-resume-builder.md:3` still reads:

```
**Status:** Proposed
```

despite Phase 1 being live. Anyone reading it concludes this is an open
proposal.

### What exists — Phase 1 is real

The store slice and UI are present across these files (confirmed by search for
`jobVariants` / `activeVariantId` / `saveCurrentAsVariant` / `openVariant`):

- `src/types/templates.ts` — the `JobVariant` type
- `src/lib/stores/resumeStore.ts` — the slice and its actions
- `src/lib/stores/jobVariants.test.ts` — store tests
- `src/components/sections/JobVariantsBar.tsx` + `JobVariantsBar.test.tsx` — UI and tests

### What is missing — any measurement, including the denominator

- `src/types/analytics.ts` contains no variant-related event (case-insensitive
  search for `variant`: no matches).
- No file under `src/` calls an analytics tracker with a variant event.
- `src/components/sections/JobVariantsBar.tsx` imports no analytics module.

**And the denominator does not exist either.** The save rate is
"variant saves ÷ optimize completions", but there is **no optimize-completion
event**. The full list of tracked event names in `src/services/analytics.ts` is:

```
resume_upload_completed · resume_upload_failed · clarification_outcome ·
clarification_score_delta · match_analysis_run · cover_letter_generated ·
template_selected · pdf_exported · language_changed · pricing_intent_clicked ·
feedback_submitted · landing_viewed · get_started_clicked · signin_started ·
signup_started · guest_preview_started · guest_preview_limit_hit ·
guest_preview_signin_started · job_description_submitted ·
match_analysis_started · match_analysis_success · strategic_reality_check_result ·
resume_truth_check_result · explainability_panel_opened · score_diff_expanded ·
match_analysis_failed · optimization_failed · export_clicked · export_success ·
export_failed · waitlist_joined · pipeline_save_clicked · pipeline_job_saved ·
pipeline_save_failed · pipeline_status_updated · pipeline_export_attached ·
job_metadata_extracted · job_metadata_extraction_failed
```

Note the asymmetry: **match** has the full triad
(`match_analysis_started` / `match_analysis_success` / `match_analysis_failed`),
but **optimize** — the flagship 5-credit action — has only
`optimization_failed` (`src/services/analytics.ts:371`). Successful optimize
runs are not tracked at all.

> **Corrected 2026-08-09 after execution — it is worse than the above.**
> `trackOptimizationFailed()` is *defined* in `src/services/analytics.ts` but
> has **no production call site**; the only callers are test mocks
> (`recommendation-cards.test.jsx`, `optimize-zero-noise.test.jsx`,
> `optimize-verify-integrity.test.jsx`). So optimize is not merely missing its
> success event — **neither** outcome is tracked in production. Do not plan on
> placing the success event "in the sibling branch of the existing failure
> call"; there is no such call. Place it in the shared success continuation
> after the SSE-vs-legacy branch resolves (see the double-count note in Step 3).
> Separately, `trackOptimization(action: 'started'|'completed'|…)` already
> carries `'completed'` as a valid but never-invoked union member — a dead
> earlier attempt at this same event. Wiring up the failure event is deliberately
> **out of scope** for this spike and is recorded as a follow-up.

So this spike must add **three** events, not two: the two variant events plus
the missing optimize-completion event that serves as the save-rate denominator.
Adding it is independently worth doing — tracking only an action's failures
makes every funnel metric for the product's core action uncomputable.

### Repo conventions you must follow

- Analytics live in `src/services/analytics.ts`, with event names/types declared
  in `src/types/analytics.ts`. Read both before adding anything, and follow the
  existing event-naming convention exactly (do not invent a new style).
- **Analytics in this repo are consent-gated and send only bucketed enums, never
  free text or PII.** A variant event must never include the job description,
  job title, company name, or the variant label — those are user-authored and
  potentially identifying. Send counts and booleans only.
- Never use `any`; types go in `src/types/`.
- There is an existing analytics test to model on: `src/services/analytics.init.test.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run type:check` | exit 0, no errors |
| Store + UI tests | `npx vitest run src/lib/stores/jobVariants.test.ts src/components/sections/JobVariantsBar.test.tsx` | all pass |
| Analytics tests | `npx vitest run src/services/analytics.init.test.ts` | all pass |
| Lint | `npm run lint` | exit 0 |
| Full suite | `npm run test` | exit 0 (181 files) |

## Scope

**In scope:**
- `src/types/analytics.ts` and `src/services/analytics.ts` — add the three event
  definitions and their tracker methods
- `src/components/sections/JobVariantsBar.tsx` — fire the two variant events (or
  the store actions, if that is where the repo's existing analytics calls live —
  read first and match)
- Whichever file already fires `optimization_failed` (find it with
  `grep -rn "optimization_failed" src`) — add the success event in the sibling
  branch. Expected to be `src/components/Layout/MainContent.tsx`; confirm rather
  than assume.
- `src/components/sections/JobVariantsBar.test.tsx` — assert the variant events fire
- The test file covering the optimize flow (expected
  `src/__tests__/MainContent.test.jsx`) — assert the completion event fires once
  per run on both the SSE and fallback paths
- `docs/adr/ADR-job-specific-resume-builder.md` — status line + action items
- `plans/README.md` (status row)
- **A written recommendation** (see Step 5) — the primary deliverable

**Out of scope** (do NOT touch, even though they look related):
- **Anything in Phase 2.** No `resume_variants` table, no migration, no
  Supabase sync, no `user-data-api` changes. The ADR gates all of it behind
  data that does not exist yet — building any of it now inverts the decision
  this spike exists to enable.
- The `jobVariants` store slice's logic, shape, or persistence version. Adding
  a field would force a `resume-storage` migration; this spike must not.
- `netlify/lib/ai-usage-logger.js`, `ai_usage_events`, and the
  `AI_USAGE_USER_ATTRIBUTION` flag — a different measurement system, and not
  the one this gate needs.
- Phase 3 / the Job-Variants ↔ Pipeline linkage (a separate recorded candidate).
- Any change to what analytics data is collected beyond the two counters
  described here, and any relaxation of the no-PII rule.

## Git workflow

- Branch: `advisor/022-spike-job-variant-gate`
- Conventional commits, matching `git log` style.
  Suggested: `feat(analytics): instrument job-variant save and reopen`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read the analytics layer before writing anything

Read `src/services/analytics.ts` and `src/types/analytics.ts` in full, plus one
existing call site of an event fired from a section component. Establish:

- the exact event-name convention (snake_case? dotted? a union type?)
- how properties are typed and what the consent gate looks like
- whether events are fired from components or from store actions in this codebase

Write down which convention you found; the next steps depend on matching it.

**Verify**: you can name the existing convention and cite one call site with `file:line`.

### Step 2: Add the three events

Add exactly three events, named to match the convention you found in Step 1
(descriptions below are illustrative — use the repo's naming style):

- a **variant saved** event
- a **variant opened** event
- an **optimize completed / succeeded** event — the save-rate denominator,
  which does not exist today (see "Current state"). Name it to pair with the
  existing `optimization_failed` at `src/services/analytics.ts:371`, and model
  its shape on the match triad's `match_analysis_success` in the same file so
  the two flagship actions are instrumented consistently.

Properties: at most small bucketed counts, e.g. how many variants the user now
has (bucketed, not raw, if that is the house style). **No** label, job title,
company, or JD text. If in doubt, send no properties at all — the counts alone
answer the gate.

**Verify**: `npm run type:check` → exit 0.

### Step 3: Fire them

Fire the saved event where a variant is created and the opened event where an
existing variant is activated. Match where the repo fires other analytics
(component vs store action) per Step 1.

Fire the optimize-completion event on the success path of the same flow that
already fires `optimization_failed` — find that call site first
(`grep -rn "optimization_failed\|trackOptimizationFailed" src`) and put the
success event in the sibling branch, so the pair cannot drift apart. Fire it
once per completed optimize run; be careful that the SSE path
(`optimizeResumeStream`) and the legacy fallback (`optimizeResume`) do not both
fire it for a single user action — `MainContent.tsx` falls back from one to the
other on failure, so a naive placement double-counts the denominator and
deflates the save rate.

Be careful about double-counting: if `openVariant` is also invoked immediately
after a save, or on mount to restore `activeVariantId`, a naive call inflates
the reopen rate — which is precisely the metric the gate reads. Read the call
sites and make sure "reopen" means a deliberate user action, not a restore.

**Verify**: `npx vitest run src/components/sections/JobVariantsBar.test.tsx` → all pass.

### Step 4: Test that the events fire, and only when they should

Add tests to `src/components/sections/JobVariantsBar.test.tsx` (or the store
test file, matching where you placed the calls):

1. Saving a variant fires the saved event exactly once.
2. Opening an existing variant fires the opened event exactly once.
3. **Restoring an active variant on mount does NOT fire the opened event** —
   this is the double-count guard from Step 3 and is the test most likely to
   catch a wrong implementation.
4. No event payload contains the variant label or job description text.

**Verify**: `npx vitest run src/components/sections/JobVariantsBar.test.tsx src/lib/stores/jobVariants.test.ts` → all pass, including 4 new tests.

### Step 5: Write the recommendation — this is the deliverable

Create `docs/plans/job-variant-phase2-gate.md` containing:

1. **The finding**: Phase 1 shipped, but the ADR's Phase-2 gate was never
   measurable because no variant analytics existed. Cite the ADR lines and the
   absence.
2. **What you added**: the two event names, where they fire, what properties
   they carry, and explicitly what they deliberately do not carry.
3. **How to compute the gate**: the exact ratio for save rate and reopen rate,
   naming the optimize-completion event you added as the denominator — and
   noting that it did not exist before this change, so no historical data is
   available and the window genuinely starts from deployment.
4. **When to check**: the earliest date the ~4-week window can close, counted
   from the date this instrumentation is *deployed* (not merged). State that
   date arithmetic explicitly rather than a relative phrase.
5. **The three possible outcomes** and what each means: both thresholds clear →
   Phase 2 is unblocked (and note the ADR's own hard gate at `:243` — Phase 2
   cannot ship until `user-data-api` export/delete covers variants); either
   threshold misses → the ADR says kill and reclaim the store/UI complexity;
   inconclusive volume → extend the window rather than guessing.
6. **Open questions you could not resolve** from the repo alone.

Do **not** make the Phase-2 build/kill call yourself. The spike's job is to
make the call possible.

**Verify**: the file exists and covers all six points.

### Step 6: Correct the ADR's status

In `docs/adr/ADR-job-specific-resume-builder.md`:

- Change `:3` from `**Status:** Proposed` to a status reflecting that Phase 1
  shipped and Phase 2 is gated on pending measurement.
- Update `§11` action item 1 (`:253`) — it targets the moot pre-build signal.
  Replace it with the live item: measure the post-ship gate, pointing at the
  doc you wrote in Step 5.
- Do not rewrite the design sections. The design is sound and already
  implemented; only the metadata is wrong.

**Verify**: `grep -n "Status:" docs/adr/ADR-job-specific-resume-builder.md` → no longer says `Proposed`.

### Step 7: Full verification

**Verify**:
- `npm run type:check` → exit 0
- `npm run lint` → exit 0
- `npm run test` → exit 0

## Test plan

- **New tests**: 6.
  - 4 in `src/components/sections/JobVariantsBar.test.tsx` and/or
    `src/lib/stores/jobVariants.test.ts`: save fires once; open fires once;
    mount-restore does **not** fire; no PII in payloads.
  - 2 in the optimize-flow test file (expected `src/__tests__/MainContent.test.jsx`):
    the completion event fires exactly once on the SSE success path, and exactly
    once — not twice — when the SSE path fails and the legacy fallback succeeds.
    That file already has fixtures for both paths (search it for
    `optimizeResumeStreamMock` and the legacy-fallback test) — reuse them rather
    than building new ones.
- **Structural pattern to follow**: the existing tests in
  `src/components/sections/JobVariantsBar.test.tsx`, plus
  `src/services/analytics.init.test.ts` for how analytics is mocked.
- Verification: the vitest command in Step 4, then the full suite.

## Done criteria

ALL must hold:

- [ ] Two variant events exist in `src/types/analytics.ts`
- [ ] `grep -ic "variant" src/types/analytics.ts` → ≥ 2
- [ ] An optimize-completion event exists and pairs with the existing `optimization_failed`
- [ ] All three events are fired from live code paths (not only from tests)
- [ ] The optimize-completion event fires exactly once per run across BOTH the SSE and legacy-fallback paths (covered by a test)
- [ ] `docs/plans/job-variant-phase2-gate.md` exists and covers all six points from Step 5
- [ ] `grep -n "Status:\*\* Proposed" docs/adr/ADR-job-specific-resume-builder.md` → no matches
- [ ] `npm run type:check` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test` exits 0; 4 new tests exist and pass
- [ ] `git diff --name-only -- supabase/` → **empty** (no Phase-2 migration was created)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- You cannot place the optimize-completion event so that it fires exactly once
  per user-initiated run across both the SSE path and the legacy fallback.
  Double-counting the denominator deflates the save rate and would push the
  gate toward a false "kill" — report rather than approximating.
- The consent gate means these events would not fire for most users. Report the
  implication — the gate would then measure only consenting users, which the
  maintainer must know before reading the numbers.
- Firing a "reopen" event without double-counting requires changing the store
  slice's shape or its persisted `version`. That is out of scope; report the
  constraint instead.
- You find variant analytics already exist somewhere this plan missed — the
  plan is stale, report what you found.
- You are tempted to start Phase 2 (a table, a migration, Supabase sync). Stop:
  that is exactly the decision this spike exists to inform, and it has not been
  made.

## Maintenance notes

- **Operator follow-up (not an executor action)**: the ~4-week measurement
  window starts when this instrumentation is **deployed**, not merged. Someone
  must diarise the check date computed in Step 5.
- **What a reviewer should scrutinise**: the double-count guard on the reopen
  event (test 3). Reopen rate is one of the two numbers the kill decision turns
  on — inflating it would manufacture a false "clear" and green-light Phase 2's
  schema/export/delete cost on bad data.
- Also verify no event payload carries the variant label or JD text. Those are
  user-authored and the repo's analytics posture is bucketed enums only.
- If the gate is later missed and the ADR's "kill" branch is taken, the removal
  is bounded: the `jobVariants` slice, `JobVariantsBar`, and their tests — plus
  a `resume-storage` migration to drop the slice cleanly.
