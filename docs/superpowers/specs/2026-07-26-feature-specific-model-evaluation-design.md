# Feature-specific AI model evaluation — design

**Date:** 2026-07-26
**Status:** approved design
**Scope:** model selection for Watheq's main AI features

## Goal

Choose the most reliable model independently for each main AI feature. Reliability and
feature quality are hard gates; latency and cost only decide between candidates that clear
those gates.

The main features are:

1. Resume parsing
2. Match analysis plus Reality Check
3. Resume optimization
4. Resume Truth Check
5. Cover-letter generation
6. Interview preparation

Clarification generation and job metadata extraction remain supporting smoke tests. They
measure provider availability, schema reliability, language compliance, and latency, but
they do not block a main-feature routing decision.

## Existing evaluators are retained

Do not delete or replace the existing evaluation scripts in the first iteration:

- `scripts/parse-eval.mjs` remains the authoritative deterministic resume-extraction
  evaluator.
- `scripts/match-eval.mjs` remains the authoritative deterministic Match plus Reality
  Check evaluator.
- `scripts/optimize-quality-eval.mjs` remains the authoritative optimization-quality
  evaluator with deterministic grounding checks, A/A noise control, and a blind judge
  panel.
- `scripts/benchmark-ai-models.mjs` remains the generic provider/schema/latency harness.
  Its current `match` and `optimize` modes are smoke tests only and must not select a
  production model. Enhance this existing script with authoritative, feature-specific
  `truth-check`, `cover-letter`, and `interview` modes whose adapters call the real
  production contracts and whose scorers enforce the quality gates below.

Enhance these scripts around their proven feature-specific scoring logic. Small shared
support modules may be added under `scripts/lib/model-eval/` for model matrices, repeated
runs, statistics, fallback detection, and reporting. These modules support the existing
evaluators; they are not replacement evaluators.

No evaluator is deleted until its enhanced replacement path reproduces the incumbent
baseline and historical evidence format.

## Architecture

Each evaluator follows the same outer flow while retaining its feature-specific scorer:

```text
candidate matrix
  -> shared live-runner
  -> exact production contract and prompt
  -> feature-specific scorer and hard gates
  -> reliability, latency, token, and cost aggregation
  -> JSON evidence plus Markdown decision report
```

The shared runner must:

- invoke the exact production contract with an explicit candidate `modelId`;
- keep production routing defaults unchanged;
- disable direct-Gemini/provider fallback during comparisons;
- verify the requested model against response and telemetry metadata;
- classify primary-contract failure separately from any fallback attempt;
- record every attempt, including timeout, malformed JSON, schema failure, and provider
  error;
- collect latency, prompt/completion/reasoning tokens, and a provider-pricing snapshot;
- support deterministic repeated runs without overwriting committed fixture caches; and
- write machine-readable evidence that the feature-specific scorer can consume.

`processMatchOnly()` currently hides a failed `ai_match_reality_check` call behind its
`ai_match` fallback. Model-selection runs must bypass or instrument that wrapper so the
primary-contract failure is visible and disqualifying.

## Execution funnel

### Stage 0 — incumbent baseline

Before comparing candidates, reproduce the current production baseline on the unchanged
gold fixtures. Stop the feature evaluation if the incumbent does not reproduce its
documented baseline; an unstable instrument cannot rank candidates.

Every main feature needs at least eight synthetic or approved gold fixtures, including at
least two Arabic cases plus English, mixed-language, positive, negative, and adversarial
cases appropriate to that feature. Where fixtures or deterministic scorers are missing,
add and validate them against the incumbent in a separate committed change. Freeze the
fixture set, scorer, and decision thresholds before running any candidate. Candidate
results must never influence fixture or threshold design.

### Stage 1 — eligibility smoke

Run one English and one Arabic fixture through the exact production contract for the
incumbent and these candidates, subject to current provider availability:

- `google/gemini-3.5-flash-lite`
- `google/gemini-3.1-flash-lite`
- `google/gemini-3.5-flash`
- `deepseek/deepseek-v4-flash`
- `qwen/qwen3.5-flash-02-23`
- `z-ai/glm-4.7-flash`
- `mistralai/mistral-small-3.2-24b-instruct`

The model registry's benchmark allow-list may be expanded for local evaluation. Expanding
that allow-list must not change `MODELS`, feature pins, or any production default.

Eliminate a candidate immediately for:

- unavailable model/provider;
- timeout;
- malformed JSON or schema failure;
- primary-contract fallback;
- wrong output language;
- empty or truncated output; or
- fabricated content detected by a deterministic hard gate.

The eligibility smoke is a cost-control filter, not model-selection evidence. If more than
two candidates survive for a feature, shortlist the two with the strongest deterministic
fixture result; break a tie by lower p95 latency, then lower estimated cost. Record every
survivor and the shortlisting calculation so a model is never omitted by an undocumented
manual choice.

### Stage 2 — three-run feature screening

The incumbent and at most two surviving candidates per feature run the full fixture set
three times. Use identical prompts, schemas, token budgets, reasoning settings, fixture
order, and temperature for every model unless a production contract requires otherwise.

Report:

- every per-fixture score for every run;
- mean and per-fixture minimum/maximum;
- primary-contract success rate and all failure classes;
- median and p95 latency;
- prompt, completion, and reasoning tokens;
- estimated cost from the captured provider-pricing snapshot; and
- feature-specific hard-gate results.

### Stage 3 — five-run confirmation

The apparent feature winner and incumbent receive five fresh full-suite runs. Evidence
from screening is retained but not substituted for confirmation.

Confirmation requires zero:

- primary-contract failures;
- fallbacks;
- timeouts;
- malformed responses;
- schema failures;
- skipped fixtures; and
- stale-cache reads.

## Global decision rule

Reliability and feature quality are hard gates. A model that fails either cannot win on
latency or price.

Among models that pass:

1. Prefer the model with higher feature quality.
2. If quality is tied within measured A/A noise, replace the incumbent only when the
   candidate improves p95 latency by at least 15% or estimated cost by at least 20%.
3. If the advantage is smaller, inconsistent, or ambiguous, retain the incumbent.
4. Select independently per feature. There is no app-wide winner.

## Feature-specific quality gates

### Resume parsing

- Reproduce the incumbent gold-set score on every confirmation run.
- Recover every evidenced field and section required by the fixture.
- Produce no fabricated fields, entries, credentials, dates, or metrics.
- Preserve Arabic and English text correctly.
- Treat truncation, deterministic-recovery substitution, or provider fallback as a
  reported failure for model-comparison purposes, even if production can recover safely.

### Match plus Reality Check

- Score 8/8 fixtures at 100% on every screening and confirmation run.
- Pass evidence-gated `strongMatches`, missing-keyword, structure, Arabic-prose, and
  invariance checks.
- Produce a valid `ai_match_reality_check` response directly; `ai_match` fallback is a
  failure.
- Report the clean/noisy invariance-pair spread rather than hiding it behind the tolerance.

### Resume optimization

- Use the real production optimize contract and an identical prompt/schema for all models.
- Keep truthfulness no worse than the incumbent after accounting for the `prod` versus
  `prod_aa` A/A noise floor.
- Introduce no additional deterministic fabrication, grounding, or score-band failures.
- Require zero ungrounded rewritten claims.
- Use a blind, shuffled, cross-family judge panel; truthfulness remains a veto.
- A candidate must win a majority of valid judge decisions when quality is not an A/A tie.

### Resume Truth Check

- Detect all seeded high-severity contradictions and unsupported claims.
- Trace every visible evidence snippet to the supplied resume text.
- Produce zero invented risks, contradictions, employers, credentials, dates, or metrics.
- Distinguish supported, needs-evidence, unclear, and contradicted claims according to the
  fixture truth.
- Preserve correct Arabic or English output.

### Cover-letter generation

- Produce zero invented facts, employers, credentials, dates, skills, or metrics.
- Ground candidate claims in the resume and role claims in the job description.
- Follow the requested language, tone, and length constraints.
- Avoid unsupported keyword stuffing and generic filler.
- Match or exceed incumbent quality outside the judge panel's A/A noise floor.

### Interview preparation

- Ground every question in the resume, job description, or a clearly stated uncertainty.
- Produce no invented-premise, discriminatory, or protected-class questions.
- Follow the requested language and question type.
- Avoid duplicate or materially equivalent questions.
- Match or exceed incumbent relevance, specificity, and actionability outside A/A noise.

## Supporting smoke tests

Clarification generation and metadata extraction use the enhanced
`benchmark-ai-models.mjs` harness. They report:

- exact requested and returned model;
- schema/JSON success;
- fallback and provider failures;
- correct Arabic/English output;
- median and p95 latency; and
- token and estimated-cost totals.

They do not receive judge-panel scoring and do not block a main-feature winner unless a
proposed shared tier change would route them to the same candidate. Production changes
should prefer feature pins so unrelated smoke-tested features are not changed accidentally.

## Reports and evidence

Each evaluation session creates a unique local report directory containing:

- `manifest.json` — Git SHA, dirty-state flag, evaluator version, fixture hashes, model
  IDs, provider-pricing snapshot, contract settings, timestamp, and command;
- `<feature>.json` — every raw metric and hard-gate result;
- `<feature>.md` — readable model comparison table and rejection reasons; and
- `routing-recommendation.md` — incumbent, selected model, confidence, evidence summary,
  and rejected candidates for every main feature.

Raw provider output remains local and excluded from commits. An approved model-routing
change commits only the evidence summary required to explain and reproduce the decision.

Every feature table includes:

- attempts and primary-contract successes;
- fallbacks, timeouts, malformed outputs, and schema failures;
- quality score and hard-gate status;
- median and p95 latency;
- prompt/completion/reasoning tokens;
- estimated cost and pricing timestamp; and
- final verdict: rejected, retained incumbent, or selected candidate.

## Cache and data safety

- Live evaluations never overwrite committed `*.actual.json` files by default.
- Updating a cache requires an explicit `--update-cache` mode and a separate reviewable
  action.
- Model-dependent caches record their model ID and contract/fixture hash.
- A keyless run must fail when the required cache does not match the requested model,
  contract, and fixture hash.
- All new fixtures use synthetic data unless an existing approved gold fixture is already
  part of the repository.

## Verification of the evaluation system

Before spending on a full model matrix:

1. Add deterministic unit tests for percentile calculations, repeat aggregation, model-ID
   verification, cache identity, fallback classification, hard-gate propagation, and final
   winner selection.
2. Run each evaluator in dry-run mode and confirm identical prompts/contracts across models.
3. Prove a deliberately malformed candidate response is classified as a failure even when
   the production wrapper could fall back.
4. Reproduce the incumbent baseline for parse, match, and optimize.
5. Run the two-fixture eligibility smoke.
6. Proceed to screening and confirmation only for surviving candidates.

The evaluation scripts must exit nonzero when a required fixture, run, model identity, or
hard gate fails. A report showing failures with process exit code zero is itself an
evaluation-system defect.

## Out of scope

- Changing any production model or feature pin.
- Applying one model to every feature.
- Deleting historical reports or existing evaluators.
- Using benchmark results as proof of hiring outcomes.
- Treating approximate local cost calculations as billing truth.
