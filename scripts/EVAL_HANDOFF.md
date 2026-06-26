# Handoff: finish the optimize rewrite-quality eval (step 5)

## Goal
Decide, with evidence, which single lever most improves the QUALITY of the `optimize`
feature's rewrites (reads better, less generic, no new fabrication): **temperature**,
**prompt**, or **model**. Then apply the winning change to production, one change at a time,
and confirm the gain by re-running the eval.

## What already exists (built, do not rebuild)
- `scripts/optimize-quality-eval.mjs` — LLM-as-judge harness. Runs fixtures through 4
  variants and blind-scores the rewrites. Reuses the REAL `getAiContract('optimize')`
  contract + schema, so variants are validated exactly like production.
  - Variants: `baseline` (flash, temp 0, stock prompt) | `temp_05` (flash, temp 0.5) |
    `prompt_v2` (flash, temp 0.5, anti-cliché prompt + worked example) |
    `model_up` (only when `--candidate <modelId>` is passed).
  - Writes ranked `.md` + `.json` reports to `scripts/benchmark-reports/`.
- `package.json` script: `npm run eval:optimize`.
- Flags: `--dry-run` (no API calls), `--fixture <file>`, `--baseline <id>`,
  `--candidate <id>`, `--judge <id>`, `--fixtures <dir>`.

## Your tasks (in order)
1. **Reproduce and report the exact error** the user hit on `npm run eval:optimize`.
   State the failing command and the full stack before changing anything.
2. **Fix the runtime, not the logic.** Most likely causes, in order:
   a. **TS-as-JS module resolution.** `netlify/lib/openrouter-client.js` and siblings
      `import './sentry.js'` while only `sentry.ts` exists. Bare `node` can't resolve it.
      This is shared with `npm run benchmark:ai`. Fix by running both scripts through the
      project's TS-aware path (e.g. a `tsx`/loader invocation or whatever `benchmark:ai`
      already relies on). Apply the same run mechanism to `eval:optimize`. Do NOT rewrite
      the production imports to `.ts`.
   b. **Missing env.** The script does `import 'dotenv/config'`; confirm `.env` has a valid
      `OPENROUTER_API_KEY` (and `GEMINI_API_KEY` for fallback). Surface a clear message if absent.
   c. **`package.json` integrity.** A concurrent linter briefly truncated it mid-session;
      confirm it parses (`node -e "JSON.parse(require('fs').readFileSync('package.json'))"`).
3. **Dry run first:** `npm run eval:optimize -- --dry-run --fixture en-resume-jd.json`.
   Confirm every variant's messages and the judge prompt look right. ZERO API spend.
4. **Real run:** `npm run eval:optimize -- --candidate google/gemini-3.5-flash --judge <strongest model you have access to>`.
   (Confirm `google/gemini-3.5-flash` is reachable on the account; if not, drop `--candidate`
   or pick an available candidate.) Read the generated report in `scripts/benchmark-reports/`.
5. **Apply the winning change — exactly one at a time, lowest-effort first:**
   - **CRITICAL — find the authoritative config.** The executor (`netlify/lib/ai-contracts/executor.js`,
     `buildCallOptions`) reads `contract.temperature` etc. from the contract object in
     `netlify/lib/ai-contracts/contracts/index.js` (the `optimize` + `optimize_stream` entries),
     NOT from `netlify/lib/model-registry.js` `FEATURE_CONFIGS`. Verify this before editing.
     Change temperature for the optimize path in `contracts/index.js` (both `optimize` and
     `optimize_stream`). If `FEATURE_CONFIGS.optimize` is dead/parallel config, note it.
   - **Model change** should be per-feature, not global: flipping `MODELS.flash` affects
     match, cover_letter, etc. Prefer the existing env override
     (`WATHEQ_AI_ENABLE_MODEL_OVERRIDES=true` + `WATHEQ_AI_MODEL_OVERRIDE_OPTIMIZE=<id>`) or add
     a per-contract `modelId`. Add the chosen model to `SUPPORTED_BENCHMARK_MODELS` if needed.
   - **Prompt change**: only if `prompt_v2` won. Port the winning prompt from
     `buildOptimizeMessagesV2` in the eval script into `buildOptimizeMessages` in
     `contracts/index.js`, preserving all anti-fabrication rules.
6. **Re-run `npm run eval:optimize`** after the change to confirm the composite score rose
   with no fabrication regression. Then run `npm run quality:parallel` (per CLAUDE.md — zero
   errors before done). Do not touch DB migrations.

## Guardrails
- Truthfulness is a gate: never ship a variant that raises fabrication flags, even if it
  "reads better."
- Change ONE production setting per eval cycle so the report attributes the gain correctly.
- Keep fixtures synthetic in the repo; real user resumes must stay out of git.
- Report the before/after composite scores and the exact prod diff you applied.

---

# Round 2: raise the truthfulness score (gate dimension)

Context: round 1 shipped the v2 specificity prompt to prod (composite 2.45 → 4.25). The
laggard is now **truthfulness 3.4 / fabrication flags 5** — the gate. Goal: raise
truthfulness without losing composite.

## What's already added to the harness (do not rebuild)
`scripts/optimize-quality-eval.mjs` now has:
- `buildOptimizeMessagesV3Truthful` — the v2 prompt PLUS: an explicit grounding rule
  (every proper noun/date/tool/scope/number must trace to the resume), a contrastive
  NEGATIVE example (a fabrication and its correction), a final self-audit instruction,
  and a requirement that each item's `rationale` quote the supporting resume phrase
  (prompt-only grounding — no schema change).
- Variant matrix (all at temp 0, so prompt is the only variable):
  `baseline` (current prod prompt) | `prompt_v2` (noise-floor/consistency check) |
  `v3_truthful` | `v3_modelup` (only with `--candidate`, runs the truthful prompt on the
  upgraded model — folds in the "new prompt × 3.5-flash" test).

## Tasks
1. **Run in the BRANCH worktree** (where prod prompt = v2, so `baseline` = current prod).
   Bring the updated eval script into the branch worktree the same way you did before.
2. Dry run first: `npm run eval:optimize -- --dry-run --fixture en-resume-jd.json`. Confirm
   `v3_truthful` shows the grounding rule + negative example.
3. Real run: `npm run eval:optimize -- --candidate google/gemini-3.5-flash --judge google/gemini-2.5-pro`.
4. **Decision rule (truthfulness-first this round):**
   - Ship `v3_truthful` only if `truthfulness` rises vs `baseline` AND `composite` does not
     drop and `fabrication flags` do not rise. Truthfulness is the objective; do not trade
     it away for a higher composite.
   - If `v3_modelup` wins truthfulness AND composite with acceptable latency, that's the
     real prize (quality + speed) — but a model swap must be per-feature (env override
     `WATHEQ_AI_MODEL_OVERRIDE_OPTIMIZE`, not global `MODELS.flash`).
   - Sanity check: `baseline` and `prompt_v2` should score close together. If they diverge
     widely, your n=5 judge variance is high — add fixtures before trusting small deltas.
5. **If prompt-only doesn't move truthfulness enough**, escalate (next round, not now):
   (a) add an `evidence` field to `bullet_improvements` in the optimize schema requiring a
       quoted resume span per bullet, or (b) a cheap second "verifier" pass that audits each
       improved bullet against the resume and strips unsupported claims.
6. Apply the winner to `buildOptimizeMessages` in `contracts/index.js` (covers `optimize`
   and `optimize_stream`), keep `temperature: 0`, re-run to confirm, then `quality:parallel`.

## Known noise floor
At n=5 fixtures, deltas under ~0.3 are within judge variance. If the truthfulness gain is
small, expand `scripts/benchmark-fixtures/` with 5-10 harder synthetic cases (sparse
resumes, career pivots, padded/inflated resumes) before declaring a winner.

---

# Round 3: de-noise the eval and find the MINIMAL change to ship

Why: Round 2 showed v3_modelup (truthful prompt + gemini-3.5-flash) winning truthfulness +
composite + speed. BUT the same prod config swung truthfulness 3.4 (R1) -> 2.0 (R2) on
identical inputs. n=5 is too noisy to make a model-swap call, and we never tested the
model change ALONE, so we can't attribute the win to prompt vs model.

## What's already added (do not rebuild)
5 new harder synthetic fixtures in `scripts/benchmark-fixtures/`, targeting the fabrication
failure mode plus a control: `sparse-vague-resume`, `career-pivot-resume`,
`padded-inflated-resume`, `junior-thin-resume`, `dense-senior-control` (the control checks
v3 does NOT over-strip real metrics when evidence exists). Total fixtures now 10.

## Tasks
1. **Add the missing attribution cell** to `buildVariants()` in `optimize-quality-eval.mjs`,
   so model-alone is isolated. Insert (only when `CANDIDATE_MODEL` is set):
   ```js
   variants.push({ name: 'modelup_v2', modelId: CANDIDATE_MODEL, temperature: 0, buildMessages: optimizeContract.buildMessages, note: `current prod prompt on ${CANDIDATE_MODEL}` });
   ```
   This tests whether gemini-3.5-flash with the CURRENT prod prompt is already truthful —
   if so, the clean ship is a MODEL OVERRIDE ONLY (one change), no prompt edit.
2. Bring the 5 new fixtures + updated script into the BRANCH worktree (Round 1 pattern).
3. Real run on all 10 fixtures:
   `npm run eval:optimize -- --candidate google/gemini-3.5-flash --judge google/gemini-2.5-pro`
4. **Decide from the n=10 numbers, in this order (prefer the fewest changes):**
   a. If `modelup_v2` (model only) clears the gate (truthfulness >= baseline, composite >=
      baseline, fab <= baseline): ship the MODEL OVERRIDE ONLY. One change, no prompt edit.
   b. Else if `v3_modelup` (prompt + model) clearly wins: ship BOTH, but as TWO separate
      commits, and re-run to confirm.
   c. Else if `v3_truthful` (prompt only) clears the gate on the bigger set: ship prompt only.
   d. Model overrides use `WATHEQ_AI_MODEL_OVERRIDE_OPTIMIZE` (per-feature, reversible),
      NOT global `MODELS.flash`. Add the model to `SUPPORTED_BENCHMARK_MODELS` if needed.
      Confirm gemini-3.5-flash pricing in `APPROXIMATE_PRICING` before shipping.
5. Report per-variant n=10 means + the per-fixture truthfulness on `sparse-vague-resume`
   specifically (that's the case where prod fabricated a career). Then `quality:parallel`.

## Hard rule
Truthfulness is the objective this track. Do not ship anything that lowers truthfulness vs
current prod on the sparse/vague fixtures, regardless of composite.

---

# Round 4: de-noise the judge + structural grounding (push fab -> 0)

Context: prompt-only (v3) shipped. Fab 11 -> 6, truthfulness directionally up but the judge
is noisy (same config scored 3.0 vs 3.9 across runs) and the judge model even CHANGED to
flash mid-experiment. To go further on truthfulness/fab we need (a) a reliable judge and
(b) a structural anti-fabrication mechanism, not more prompt adjectives.

## First, before spending credits: COMMIT
The shipped v3 prompt is still uncommitted and the tsx npm scripts got reverted (work has
been lost twice). Commit on the branch FIRST:
- `netlify/lib/ai-contracts/contracts/index.js` (the shipped v3 prompt)
- `scripts/optimize-quality-eval.mjs`, `scripts/benchmark-fixtures/*` (10 fixtures)
- `package.json` tsx script fix (point `eval:optimize`/`benchmark:ai` at tsx, not node)
Two commits (prompt; harness+tooling). Then proceed.

## What's already built into the harness (do not rebuild)
1. **Judge panel** — `--judges "a,b"` averages dimensions across models and takes a majority
   best, cutting single-judge variance. Default = one judge. Budget choice: use
   `google/gemini-2.5-flash` as the judge (pro was cancelled — too expensive). Flash IS
   noisier (the 3.0<->3.9 swing), so this round DO NOT decide on the flash judge's
   composite/truthfulness alone — lean on the deterministic `ungrounded` and `fab` columns
   (zero cost, zero variance) as the PRIMARY signal. Cheap variance cut without pro: pass
   the same model twice, `--judges "google/gemini-2.5-flash,google/gemini-2.5-flash"`, to
   average two independent flash passes.
2. **`v4_evidence` variant** — requires a verbatim `source_span` per bullet (extends the
   prod schema in-harness) + a DETERMINISTIC `groundingFlags` check that flags any bullet
   whose span isn't in the resume or whose numbers don't trace to it. New report column
   "ungrounded" (target: 0). `v4_modelup` runs the same prompt on `--candidate`.
3. **`--limit N`** and comma-list `--fixture a.json,b.json` for cheap, targeted runs.

## Run plan (budget ~$3 — go cheap first)
1. Dry run (free): `npm run eval:optimize -- --dry-run --fixture sparse-vague-resume.json`.
   Confirm `v4_evidence` shows the EVIDENCE PROTOCOL + source_span requirement.
2. Cheap targeted real run (4 trap fixtures, single flash judge, no candidate):
   `npm run eval:optimize -- --judge google/gemini-2.5-flash --fixture sparse-vague-resume.json,career-pivot-resume.json,padded-inflated-resume.json,junior-thin-resume.json`
   This is ~4 fixtures x 4 variants = 16 generations + 4 judge calls. Decide primarily on the
   "ungrounded" and "fab" columns for `v4_evidence` vs `baseline`; treat "truthful" as
   directional only (flash judge is noisy).
3. Only if budget allows and v4 looks promising: run the full 10 and/or a 2x-flash panel.

## Decision
- If `v4_evidence` drives ungrounded -> ~0 AND truthfulness >= current prod (baseline) on
  the trap fixtures, the evidence field is the win. To ship it you MUST also add the
  `source_span` field to the optimize output schema in `contracts/index.js`
  (`optimizeJsonSchema` + the Zod `optimizeOutput`) and surface/ignore it in the frontend
  card mapping — it's a schema change, not just a prompt change. Plan that as its own PR.
- If v4 doesn't beat v3 on the gate, stay on v3 and consider the cheaper Round-5 option:
  a lightweight verifier pass (a lite-model call that audits each bullet vs the resume and
  strips unsupported claims). The 2.4x speed from gemini-3.5-flash is the latency budget
  that funds a verifier pass while staying faster than today.

## Standing methodology fixes
- Lock the judge: always gemini-2.5-flash this track (pro cancelled for cost). Never compare
  across runs that used different judges — re-baseline if the judge changes.
- Because the flash judge is noisy, the deterministic `fab` and `ungrounded` counts are the
  PRIMARY decision signal for the evidence work; the judge's truthfulness is directional.
- Treat composite deltas < ~0.4 as noise on the flash judge; trust the gate + deterministic
  counts.
- Note: I could not `node --check` (sandbox disk full); the dry run is the validation gate.

---

# Round 4.5: de-risk v4_evidence BEFORE committing to the schema PR

The first v4 run was promising (ungrounded 4 -> 0) but had a production-breaking defect:
1 of 4 runs truncated (junior-thin, ~65k chars) because source_span bloats output past the
16,384-token cap. Do NOT build the schema PR until this is fixed and the win generalizes.

## Harness fix already applied (sync from main worktree)
- `buildOptimizeMessagesV4Evidence` now caps each source_span to ~120 chars / 15 words.
- v4 variants get `maxTokens: 24576` IN THE HARNESS ONLY (measurement headroom; this is NOT
  the prod fix — see below).

## Steps (cheap, flash judge, deterministic-first)
1. Dry-run v4_evidence: confirm the span-length cap text is present.
2. Re-run the SAME 4 traps to confirm 0 truncation failures now:
   `npm run eval:optimize -- --judge google/gemini-2.5-flash --fixture sparse-vague-resume.json,career-pivot-resume.json,padded-inflated-resume.json,junior-thin-resume.json`
   Pass criterion: 4/4 succeed AND v4 ungrounded stays 0.
3. Generalize on all 10 (budget permitting), flash judge:
   `npm run eval:optimize -- --judge google/gemini-2.5-flash`
   Watch `dense-senior-control` specifically: v4 must NOT strip the real metrics (12M txns,
   p99 850->210ms, etc.). If v4 specificity craters on the dense control, the evidence prompt
   is over-cautious and needs loosening before it ships.

## Gate to the schema PR
Proceed to the schema PR ONLY IF: 0 truncations across 10 fixtures, ungrounded ~0, truthful
>= current prod, and specificity holds on the dense control. Then the PR is:
- `optimizeJsonSchema` + Zod `optimizeOutput` in `contracts/index.js`: add `source_span`
  (keep it OPTIONAL in Zod so older cached results still validate).
- Port the capped-span evidence prompt into `buildOptimizeMessages`.
- Prod truncation fix: do NOT just raise maxTokens (CLAUDE.md: re-opens the optimize timeout
  path). Prefer the span-length cap (already in the prompt) + a modest maxTokens review; if
  still tight, cap how many bullets carry a span.
- Frontend: surface or safely ignore `source_span` in the card mapping (it must not break
  rendering). It's also a nice UX feature — show the source line as proof on hover.
- Re-run the eval after, then `quality:parallel`.

If the de-risk run FAILS (truncation persists or v4 doesn't beat prod), stay on v3 and pivot
to the lighter Round-5 verifier-pass option instead of the schema change.

---

# Round 4.6: fix the one blemish (dense-control specificity) before the PR

Round 4.5 passed 3/4 gates cleanly (0 truncations, ungrounded ~0, truthful 4.8 vs prod 3.9).
The only miss: `dense-senior-control` specificity dipped 4 -> 3 (v4 mild over-caution on a
resume full of real metrics). Likely partly flash-judge noise (aggregate v4 specificity is
UP, 3.1 vs 2.8), but it's the exact fixture built to catch over-stripping, so confirm the
fix before the permanent schema PR.

## Harness fix already applied (sync from main worktree)
`buildOptimizeMessagesV4Evidence` now has a PRESERVE REAL EVIDENCE line: keep concrete
metrics/scope verbatim when the resume states them; the protocol stops invented facts, not
real ones.

## Steps (cheap, flash judge)
1. Dry-run: confirm the "PRESERVE REAL EVIDENCE" line is present in v4_evidence.
2. Targeted retest — dense control + 2 traps, baseline vs v4 only to save credits:
   `npm run eval:optimize -- --judge google/gemini-2.5-flash --fixture dense-senior-control.json,sparse-vague-resume.json,padded-inflated-resume.json`
3. Pass criterion: v4 specificity on `dense-senior-control` recovers to >= 4 (i.e. >= prod),
   ungrounded still 0 on the traps, truthful still >= prod. ~6 generations + 3 judge calls.

## Then green-light the schema PR (Round 4.5 "Gate to the schema PR" section)
Only after specificity recovers. The PR: `source_span` optional in `optimizeJsonSchema` +
Zod `optimizeOutput`, port the capped + preserve-evidence prompt into `buildOptimizeMessages`,
keep the span-cap truncation fix (NOT raw maxTokens), frontend surfaces/ignores `source_span`,
re-run the full 10, then `quality:parallel`.

If specificity does NOT recover to >= 4 after this line, the evidence approach has a real
cost on strong resumes — stop and reconsider (verifier-pass alternative) rather than shipping
a v4 that weakens good candidates.
