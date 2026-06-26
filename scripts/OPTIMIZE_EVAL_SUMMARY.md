# Optimize Rewrite-Quality: What We Built

A summary of the evaluation system and the changes it produced for the `optimize` feature
(resume rewriting) in Watheq.

## The question we started with

"I want to refine the AI prompt to get better enhancement results, but I'm not sure the
prompt is the most impactful change." The honest reframing: don't refine the prompt blind.
Build a way to *measure* rewrite quality, then test which lever actually moves it — model,
temperature, or prompt — and change only what the evidence supports.

## What we built: an eval harness

`scripts/optimize-quality-eval.mjs` (run with `npm run eval:optimize`, via `tsx`). It runs the
same resume + job-description fixtures through several variants of the optimize call and scores
the results, so production changes are decided by data, not opinion.

Core pieces:

- **Variant matrix.** Each variant changes exactly one thing (model, temperature, or prompt)
  so gains are attributable: `baseline` (current prod), `prompt_v2`, `v3_truthful`,
  `v4_evidence`, plus model-upgrade variants when `--candidate` is passed.
- **Reuses the real production contract** via `getAiContract('optimize')`, so every variant is
  validated against the exact prod JSON schema — no forked copy that can drift.
- **LLM-as-judge scoring.** Variants are anonymized and shuffled, then a judge model scores
  each on specificity, JD-alignment, truthfulness, and readability. A `--judges` panel
  averages several judges to cut single-judge variance.
- **Deterministic checks (zero cost, zero variance).** `fabricationFlags` flags credentials
  or metrics not present in the resume; `groundingFlags` (for the evidence variant) flags any
  bullet whose cited `source_span` isn't a verbatim substring of the resume or whose numbers
  don't trace to it. These became the most trustworthy signal.
- **Synthetic fixtures** in `scripts/benchmark-fixtures/` (10 total), including hard cases
  built to expose fabrication: `sparse-vague`, `career-pivot`, `padded-inflated`,
  `junior-thin`, plus a `dense-senior-control` to catch over-stripping of real achievements.
- **Cost controls:** `--dry-run` (zero API calls), `--limit N`, and comma-list `--fixture` for
  cheap targeted runs. Reports (md + json) are written to `scripts/benchmark-reports/`.

## What we tested, and what won

| Lever tested | Verdict |
|---|---|
| Raise temperature (0 → 0.5) | **Rejected.** Made output worse and *less* truthful. Kept `temperature: 0`. |
| Upgrade model only (gemini-3.5-flash, stock prompt) | **Rejected.** Faster, but lowered truthfulness on vague resumes — the model alone does not fix fabrication. |
| Specificity prompt (`v2`) | Better prose, but fabricated more on weak resumes. Superseded by v3. |
| Truthfulness prompt (`v3`) | **Shipped.** Grounding rules + negative example + self-audit. |
| Evidence grounding (`v4`, `source_span` per bullet) | **Winning, pending a schema PR.** Drove ungrounded claims to ~0. |

## What shipped to production

**The `v3_truthful` prompt** was ported into `buildOptimizeMessages` in
`netlify/lib/ai-contracts/contracts/index.js` (covers both `optimize` and `optimize_stream`),
with model and `temperature: 0` unchanged — one reversible change. Result vs the old stock
prompt: **fabrication flags dropped from 11 to 6 (about −45%)**, the deterministic and most
trustworthy measure, with truthfulness directionally up. Committed on branch
`fix/parse-eval-flash-lite-extraction`.

## What's pending: the evidence-field PR

`v4_evidence` requires each rewritten bullet to carry a verbatim `source_span` from the resume,
which a deterministic check then verifies. Across the full 10 fixtures it drove **ungrounded
claims to ~0** (1 across all fixtures) and scored truthfulness ~4.8 vs prod ~3.9. Two issues
were found and fixed in the harness before shipping: an output-truncation failure (solved by
capping span length, not by raising `maxTokens`, which would re-open the optimize timeout
path), and mild over-caution that lowered specificity on the metric-rich control (solved by a
"preserve real evidence" rule). It is **not yet shipped** because it is a schema change, not a
prompt swap: it needs `source_span` added (optional) to `optimizeJsonSchema` + the Zod
`optimizeOutput`, the prompt ported into prod, and the frontend card mapping to surface or
safely ignore the field. The forward plan lives in `scripts/EVAL_HANDOFF.md`.

## Methodology lessons (the real value)

- **Measure before shipping.** The prompt was not the obvious weak link; `temperature: 0` was
  a hidden suspect and the model was a real candidate. Only the eval settled it.
- **The judge is a noisy instrument.** The same config scored truthfulness 3.0 in one run and
  3.9 in another. So: lock one judge, never compare across runs that used different judges,
  treat composite deltas under ~0.4 as noise, and lean on the deterministic counts
  (`fab`, `ungrounded`) which don't vary.
- **One change at a time, gated.** Each production change was isolated and confirmed by a
  re-run before the next, and a permanent schema change is gated behind a cheap validation run.
- **Commit early.** Work was silently reverted twice (a prompt and the npm scripts) before we
  committed; uncommitted experiments are fragile.
- **Config truth:** the executor reads `contract.temperature`/etc. from
  `contracts/index.js`. `FEATURE_CONFIGS` in `model-registry.js` (via `model-router.js`) is dead
  config on the optimize path. Scripts run through `tsx` because the lib imports `.ts` as `.js`.

## Key files

- `scripts/optimize-quality-eval.mjs` — the eval harness.
- `scripts/benchmark-fixtures/` — 10 synthetic test cases.
- `scripts/benchmark-reports/` — generated reports (gitignored).
- `scripts/EVAL_HANDOFF.md` — round-by-round briefs and the forward plan.
- `netlify/lib/ai-contracts/contracts/index.js` — production prompts/schema (the shipped change).

## Open items

- Pre-existing test failure `supabase-rls-migrations.test.ts:61` (migration whitespace) is
  unrelated to this work and was flagged separately; lint and type-check are clean and the
  rest of the suite passes.
- The v4 evidence-field schema PR is the recommended next step, gated on a full-10 confirm of
  the loosened prompt.
