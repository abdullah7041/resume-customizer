# AI Model Benchmarking

## Purpose and decision boundary

`eval/model-eval-fixture-manifest.json` freezes the synthetic evaluation corpus for the decision features: parse, match/reality check, optimize, truth check, cover letter, and interview preparation. It contains metadata-only references; resume and job text stay in their fixture files.

Clarification and job-metadata extraction are deliberately **smoke-only**. Their two English/Arabic fixtures verify the direct contract shape and language path, but they are never evidence for a model winner. A smoke result cannot promote, demote, or change a production model default.

No production model default, fallback, prompt, or routing change may be made from a console result. First create a committed evaluation report, review it, and approve the feature-specific decision.

## Fixture gate

Run this before any paid provider call:

```powershell
npm run test -- eval/__tests__/model-eval-fixture-manifest.test.js
```

The gate requires at least eight fixtures per primary feature, with English, at least two Arabic cases, mixed language, positive, negative, and adversarial coverage. New fixtures must be synthetic, stable-ID JSON with input fields that match the real contract, safety expectations, required evidence terms, and expected score bands or flags.

## Staged matrix

Use the stages in order. `--stage` is persisted in the report for traceability; it does not change a contract, cache, or model default.

### Stage 0 — local fixture and contract checks

```powershell
npm run test -- eval/__tests__/model-eval-fixture-manifest.test.js
npm run eval:parse
npm run eval:match
npm run eval:optimize
```

Do not start provider evaluation if the manifest gate fails. The parse, match, and optimize commands remain their focused local corpus gates.

### Stage 1 — one direct-provider fixture per feature

For direct-provider evaluation, set the OpenRouter credential and intentionally leave the direct Gemini credential unset. This prevents an accidental fallback from contaminating the candidate result.

```powershell
$env:OPENROUTER_API_KEY = "<approved benchmark key>"
Remove-Item Env:GEMINI_API_KEY -ErrorAction Ignore

npm run benchmark:ai -- --feature truth-check --models google/gemini-2.5-flash,google/gemini-3.1-flash-lite --runs 1 --fixture truth-check-en-inflated-metric --stage 1
npm run benchmark:ai -- --feature cover-letter --models google/gemini-2.5-flash,google/gemini-3.1-flash-lite --runs 1 --fixture cover-letter-en-operations-positive --stage 1
npm run benchmark:ai -- --feature interview --models google/gemini-2.5-flash,google/gemini-3.1-flash-lite --runs 1 --fixture interview-en-operations-positive --stage 1
```

These runs execute the real AI contract, revalidate the returned Zod shape, and set `disableFallback: true`. A provider, timeout, JSON, or schema failure is a failed attempt, not a fallback success.

### Stage 2 — feature matrix

Run every fixture and at least two repeats for the feature under evaluation:

```powershell
npm run benchmark:ai -- --feature truth-check --models google/gemini-2.5-flash,google/gemini-3.1-flash-lite --runs 2 --stage 2
npm run benchmark:ai -- --feature cover-letter --models google/gemini-2.5-flash,google/gemini-3.1-flash-lite --runs 2 --stage 2
npm run benchmark:ai -- --feature interview --models google/gemini-2.5-flash,google/gemini-3.1-flash-lite --runs 2 --stage 2
```

The current direct benchmark runner marks truth check, cover letter, and interview as authoritative direct-contract runs. Match and optimize wrapper runs remain smoke telemetry in that runner while their focused `eval:match` and `eval:optimize` gates protect the primary corpus. The manifest preserves all six decision corpora without changing that runtime behavior.

Clarification and metadata may be run only as explicit smoke probes:

```powershell
npm run benchmark:ai -- --feature clarification --models google/gemini-2.5-flash --runs 1 --fixture clarification-ar-metrics-smoke --stage 2
npm run benchmark:ai -- --feature metadata --models google/gemini-2.5-flash --runs 1 --fixture metadata-en-explicit-smoke --stage 2
```

### Stage 3 — review and decision

Use the report directory printed by the command. The evaluation is reviewable only when every required attempt is primary-provider successful, schema-valid, and quality-passing. A candidate also needs a feature-specific quality improvement that is material on the frozen corpus.

Tie policy: if the candidate is tied, results are noisy or incomplete, safety/reliability regresses, or the advantage is not clear, retain the incumbent. There is no cross-feature winner: every decision is feature-specific. Smoke-only clarification and metadata results are excluded from this decision.

Commit the sanitized evaluation report or decision summary, review it, then make a separately reviewed production-default change if approved. Never combine an evaluation run with a default change in the same unreviewed step.

## Cache, provider, and report handling

- Benchmark calls are tagged `benchmark.<contract>` and set `disableFallback: true`.
- The benchmark report records `updateCache: false`; benchmark attempts must not update or rely on an application response-cache result. Re-run the matrix for fresh provider evidence.
- A direct-provider run requires `OPENROUTER_API_KEY`. Keep `GEMINI_API_KEY` unset for the run so an accidental direct-Gemini route is visible as a failure.
- Reports are written below `scripts/benchmark-reports/`, which is gitignored. The report writer stores fixture IDs, model IDs, sanitized outcome/score summaries, and latency aggregates; it does not persist raw resume text, prompts, or model outputs.
- Keep raw local reports only in access-controlled storage and remove them after the decision review (maximum 30 days). A committed decision summary must remain metadata-only and must never contain a resume, job description, raw provider response, email address, or phone number.

## Adding fixtures

1. Use fully synthetic text and no candidate PII.
2. Give every new file a stable `id`, `feature`, `language`, `caseType`, `synthetic: true`, `safetyExpectations`, `requiredEvidenceTerms`, and expected score band or flags.
3. Keep the manifest metadata-only; reference the file and never paste fixture text into it.
4. Add English, Arabic, mixed, positive, negative, and adversarial coverage where the manifest gate requires it.
5. Run the fixture gate and the focused privacy scan before committing.

See `scripts/benchmark-fixtures/README.md` for the fixture format and synthetic-data rules.
