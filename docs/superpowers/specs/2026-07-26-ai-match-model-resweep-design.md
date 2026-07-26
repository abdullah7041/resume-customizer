# ai_match model re-sweep — design

**Date:** 2026-07-26
**Status:** approved, prerequisite satisfied

## Problem

A 2026-07-26 sweep of the `ai_match_reality_check` gold set concluded that
`google/gemini-3.5-flash-lite` should replace `google/gemini-2.5-flash`: quality parity at
identical price ($0.30/$2.50) with 2.5–3x lower latency (median 4.5–5.6s vs 13.5s).

That conclusion is not usable. The sweep ran against a defective `strongMatches` prompt that
penalised every model tested — `73f72a4` (merged through #131) takes baseline
`gemini-2.5-flash` from 92% mean / 3-of-8 clean to **8/8 @ 100%**. The prompt defect was the
dominant signal in the measurement, so the model ranking derived from it is unvalidated.

The pin was wired and then reverted. This spec defines the re-measurement that would justify
re-applying it.

## Prerequisite

Satisfied: the `strongMatches` evidence-rule fix from `73f72a4` is merged to `main` through
#131, and `npm run eval:match` on baseline `gemini-2.5-flash` reproduced **8/8 @ 100%**. That
is the baseline result the re-sweep must reproduce before comparing a candidate.

If it does not reproduce, stop. An unstable gate makes any model comparison meaningless, and the
instability is the more important finding.

## Method

Extend the existing scratch harness (injects `options.modelId`, requires `OPENROUTER_API_KEY`,
deletes `GEMINI_API_KEY` so a non-Google model id cannot silently fall back to Gemini under a
bogus name):

- **3 runs per model.** Report mean plus per-fixture min/max. The harness currently runs each
  fixture once and reports no spread. Independently, the baseline's temp-0 boilerplate pair
  measured a 4–7 point spread across three live runs (82/78, 83/78, 78/85), corroborating that
  one run per fixture cannot distinguish model signal from run variance. The earlier observed
  3.5-flash-lite swing (on `arabic-accountant-partial`: 100% → 78% → 78%) is larger than the
  between-model gaps under comparison.
- **Record per-fixture latency** alongside score. Latency is the actual thesis of the switch and
  the eval does not measure it. Report median and p95.

## Candidates

`google/gemini-2.5-flash` (baseline) and `google/gemini-3.5-flash-lite`.

The other five sweep candidates are already excluded on evidence and are not re-run:

| model | exclusion |
|---|---|
| `deepseek/deepseek-v4-flash` | uniform 65s timeouts (provider throughput) |
| `z-ai/glm-4.7-flash` | uniform 65s timeouts (provider throughput) |
| `qwen/qwen3.5-flash-02-23` | wrapper shape fails Zod on all 4 top-level fields |
| `mistralai/mistral-small-3.2-24b-instruct` | 65s latency tail |
| `google/gemini-2.5-flash-lite` | non-Arabic prose on Arabic fixtures — hard product fail (`eval/match-score.mjs:146`) |

## Decision rule

Fixed before seeing data:

**Pin `ai_match_reality_check` to `gemini-3.5-flash-lite` only if it scores 8/8 on all three runs
AND its p95 latency beats baseline's. Otherwise keep `gemini-2.5-flash`.**

At 8/8 the ceiling settles the quality question — a candidate can tie but not win. The switch then
rests entirely on latency, which is the honest framing of what is being bought.

## Pin mechanism (if the rule passes)

Restore the reverted shape:

1. `FEATURE_MODEL_PINS` map in `netlify/lib/model-registry.js`, keyed by feature, each entry
   carrying its eval evidence in a comment.
2. `modelId: FEATURE_MODEL_PINS.ai_match_reality_check` on the contract in
   `netlify/lib/ai-contracts/contracts/index.js`. Keep `modelType: 'flash'` so tier token defaults
   and the direct-Gemini fallback retain their behaviour.
3. `netlify/lib/ai-contracts/executor.js` — `modelId: options.modelId ?? contract.modelId`.
   Caller override (evals, benchmarks) still wins.
4. Update the `[Gemini] Fast match analysis with …` log in `netlify/lib/gemini-client.js`, or it
   names a model that path no longer calls.

Pin the feature, never `MODELS.flash`: roughly ten features share that tier constant and they
disagree — this candidate wins match and loses optimize (−1.38 jd_alignment against a 0.09 judge
noise floor). `ai_match`, the fallback contract used when reality-check throws, is separate and
was never measured; it stays on the tier default.

## Out of scope

Hardening `eval:match` itself — built-in repeat runs, a latency assertion, more Arabic fixtures
(currently 1 of 8, and the fixture where candidates wobble). These are real gaps, but changing the
instrument and taking the measurement in the same pass makes neither trustworthy. Separate work.

## Known eval limits this design works around

`npm run eval:match` is a sound regression gate: deterministic scorer with no LLM judge, exit code
counts hard failures and tolerance-gated invariance failures. `scripts/match-eval.mjs:175-181`
marks a result failed only after `getInvariantGroupFailures`; its failure list is still assembled
at `scripts/match-eval.mjs:185`. That helper uses `BAND_CROSS_TOLERANCE = 8`: a group must cross
the published product bands *and* have a spread of at least 9 points before it fails. The
bi-analyst clean/noisy pair sits on the 80 boundary, so its measured 4–7 point spread is tolerated
and this particular guard is close to inert for that pair. If boilerplate sensitivity regresses,
move the pair away from the boundary and restore a strict band-cross check rather than treating the
tolerance as proof that boilerplate has no score effect. Missing caches still hard-error rather than
silently skipping. It is not a ranking instrument — hence the 3-run requirement and the
pre-committed decision rule above.

One operational note: `eval/match-fixtures/*.actual.json` caches are model-dependent and committed.
After any model change they hold the previous model's output, so a keyless run scores stale data
while appearing to validate production. Revert or regenerate them deliberately.
