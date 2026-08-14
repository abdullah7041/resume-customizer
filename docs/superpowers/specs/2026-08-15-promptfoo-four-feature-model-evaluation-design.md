# Promptfoo Four-Feature Model Evaluation Design

## Purpose

Add Promptfoo as an orchestration and comparison layer for Watheq's four core AI features: resume parsing, job matching, resume optimization, and Truth Check. The harness must exercise Watheq's real production prompt builders, response contracts, deterministic scorers, and OpenRouter client without changing production prompts, routing, fallbacks, or model defaults.

The first paid run compares seven models across one English and one Arabic synthetic fixture per feature. Total estimated OpenRouter spend must remain at or below USD 2.00.

## Decision boundary

Promptfoo complements the existing authoritative evaluators; it does not replace them. Existing focused gates such as `eval:parse`, `eval:match`, and `eval:optimize` remain authoritative for their frozen corpora. Promptfoo provides a consistent cross-feature matrix, diagnostics, and sanitized comparison report.

No console result may change a production model default. A model can only be recommended for further feature-specific evaluation. Any production-default change requires a separately reviewed, committed decision after the existing staged gates pass.

## Model matrix

The initial matrix contains the two current production baselines and five low-cost candidates:

| Role | Model ID |
| --- | --- |
| Parse production baseline | `google/gemini-2.5-flash-lite` |
| Match, Optimize, and Truth Check production baseline | `google/gemini-2.5-flash` |
| Candidate | `deepseek/deepseek-v4-flash` |
| Candidate | `qwen/qwen3.5-flash-02-23` |
| Candidate | `z-ai/glm-4.7-flash` |
| Candidate | `mistralai/mistral-small-3.2-24b-instruct` |
| Candidate | `google/gemini-3.1-flash-lite` |

The implementation must validate every model against OpenRouter's catalog before a paid run and persist a dated pricing snapshot used for cost estimates. An unavailable model or a model lacking Watheq's required response-format capability fails preflight instead of being silently substituted.

## Architecture

Use a Promptfoo custom JavaScript provider as a thin adapter:

```text
Promptfoo test case
  -> Watheq Promptfoo adapter
  -> production prompt builder
  -> OpenRouter client with explicit model ID
  -> Zod output contract
  -> deterministic feature scorer
  -> sanitized Promptfoo result and report
```

The adapter accepts a feature, model ID, fixture ID, and prompt variant. For the first run, `promptVariant` is always `production`. This keeps the prompt identical across models and isolates model quality. The interface must remain capable of accepting explicit future prompt variants without copying production prompt text into Promptfoo configuration.

Promptfoo owns matrix expansion, filtering, display, and result serialization. Watheq owns prompt construction, provider execution, schema validation, scoring, cost estimation, and privacy-safe result normalization.

Pin `promptfoo` version `0.122.0` as an exact development dependency and expose repository-owned npm scripts for free validation, bilingual smoke evaluation, and filtered feature/model runs. Do not rely on `npx ...@latest` during normal evaluation because an unpinned CLI could change configuration or result semantics between runs.

## Import-safe evaluator boundaries

The current Parse, Match, and Optimize evaluators are script-oriented. Shared single-attempt logic and deterministic scoring must be extracted into import-safe modules with no CLI parsing, process exit, report writing, or paid calls at module import time. Existing CLI scripts then call those modules so their behavior remains covered and Promptfoo can reuse the same paths.

Truth Check should reuse the existing direct-contract runner and deterministic contract scorer. The adapter must not reimplement prompts, JSON schemas, or feature rules in YAML or Promptfoo-specific assertion strings.

Every normalized attempt result includes:

- feature and fixture ID;
- model ID and prompt variant;
- success, schema-valid, and quality-passed states;
- deterministic score and machine-readable failure reasons;
- provider classification and fallback evidence;
- latency and token usage;
- estimated incremental and cumulative cost;
- sanitized metrics needed for comparison.

It must not include raw resume text, job descriptions, rendered prompts, provider responses, email addresses, or phone numbers.

## Fixtures and run stages

Promptfoo references the existing synthetic fixture corpus. It must not fork or duplicate fixture content.

The initial smoke stage selects exactly one English and one Arabic fixture for each of the four features. With seven models, this produces 56 provider attempts:

`4 features x 2 fixtures x 7 models = 56 attempts`

The run sequence is:

1. Unit tests for adapter dispatch, scorer reuse, failure classification, report redaction, and budget enforcement.
2. A free Promptfoo render and configuration validation that makes no provider calls.
3. The 56-attempt bilingual smoke matrix.
4. Full frozen fixtures only for models that pass both smoke fixtures for a feature and only while budget remains.

A model qualifies for the full corpus separately for each feature. Failure in one feature does not exclude the model from other features.

## Scoring and selection

Each feature retains its existing deterministic quality policy:

- Parse measures schema validity, required-field recovery, section completeness, and evidence fidelity.
- Match measures contract validity, score-band correctness, demonstrated-skill evidence, and missing-keyword accuracy.
- Optimize measures contract validity, fabrication, evidence grounding, unverifiable metrics, and score-band correctness.
- Truth Check measures contract validity, evidence classification, banned employer-decision claims, and language correctness.

There is no cross-feature winner. Within each feature, schema validity, safety, English eligibility, and Arabic eligibility are hard gates. Qualifying models are compared by deterministic quality score, reliability, latency, and estimated cost in that order. A tie or incomplete evidence retains the current production model.

The initial run does not use an LLM judge. This avoids self-preference, nondeterminism, and additional cost. A future judge-assisted experiment requires a separate design and budget approval.

## Cost controls

The paid run has a hard USD 2.00 ceiling, configurable only through an explicit environment variable or CLI option. Default concurrency is one.

Before execution, the harness computes a conservative projected cost from the dated pricing snapshot, fixture prompt sizes, and each contract's maximum output tokens. If the complete requested stage cannot fit, it must either select the approved smoke subset or fail preflight; it may not start a knowingly over-budget stage.

During execution, the adapter accumulates actual or best-available estimated cost from provider token metadata. Before each subsequent request, it reserves that request's conservative maximum. When the reservation would exceed the cap, execution stops before sending the request.

Unknown pricing, missing token metadata without a safe estimate, and inconsistent model IDs fail closed. A budget-stopped or partially completed matrix is reported as incomplete and cannot produce a winner recommendation.

## Provider and failure controls

All benchmark calls use an explicit model ID, disable application fallback, and bypass application response caches. Promptfoo result caching is disabled for paid decision runs. Provider metadata must confirm OpenRouter as the primary provider.

The adapter returns machine-readable failures for at least:

- unavailable or unsupported model;
- missing credential;
- projected or cumulative budget exhaustion;
- provider timeout or rate limit;
- provider substitution or fallback evidence;
- malformed JSON;
- schema-invalid response;
- deterministic quality failure;
- privacy-redaction failure.

No failed attempt is converted into a successful fallback result. Retries, if introduced later, must be explicit, bounded, cost-accounted, and visible in the report.

## Reports and diagnosis

Promptfoo writes local artifacts below a gitignored evaluation report directory. The committed configuration must default to non-sharing behavior.

The final sanitized summary contains:

- a feature-by-model comparison table;
- pass and failure counts with machine-readable reasons;
- English and Arabic results shown separately;
- schema validity and deterministic quality scores;
- latency aggregates and estimated cost;
- provider, timeout, and malformed-output diagnostics;
- per-feature recommendation: advance, retain baseline, or insufficient evidence.

Raw local Promptfoo databases or outputs that include rendered prompts or model responses must not be committed. The implementation must include a privacy test that rejects report artifacts containing known synthetic fixture text, email-shaped strings, or phone-shaped strings.

## Prompt comparison support

The first run compares models using only current production prompts. This is intentional: changing model and prompt simultaneously would make the result uninterpretable.

The adapter contract includes a prompt-variant field so a later run can compare the production prompt with a named candidate prompt while holding the model fixed. Candidate prompts must live beside Watheq's contract code, use the same input/output contracts, and receive their own review. Promptfoo configuration must reference the variant name, not contain copied prompt text.

## Verification and acceptance

The implementation is accepted when all of the following are demonstrated with fresh output:

1. Adapter and budget tests fail before implementation and pass afterward.
2. Existing focused evaluator self-tests and affected Vitest tests remain green.
3. Promptfoo validates and renders the complete matrix without a provider call.
4. The paid smoke run uses only the seven approved model IDs, four approved features, two approved language fixtures, and no fallback or cache result.
5. Recorded cumulative estimated cost does not exceed USD 2.00.
6. The report is sanitized and marks partial or budget-stopped runs as incomplete.
7. No production prompt, route, fallback, cache policy, or model default changes in the implementation diff.

## Out of scope

- Changing production models or prompts.
- Replacing Watheq's existing feature-specific evaluators.
- Applying an LLM-as-judge rubric.
- Adding real resumes or job descriptions to fixtures.
- Running more than the approved USD 2.00 provider budget.
- Publishing or sharing raw Promptfoo results.
