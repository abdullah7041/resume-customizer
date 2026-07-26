# Feature-Specific Model Evaluation Implementation Plan

> **Execution note:** Use `superpowers:subagent-driven-development` to execute this plan task by task, with `superpowers:test-driven-development` for every implementation task.

## Goal

Make model-selection results reliable and feature-specific without replacing the existing evaluator scripts. Preserve their normal production-model behavior, while allowing explicit local candidate runs that expose provider fallback, schema failures, timeouts, cache use, latency percentiles, cost estimates, and quality gates. The primary decision features are parsing, match/reality check, optimization, truth check, cover letter, and interview preparation. Clarification and job metadata remain smoke-only checks.

## Architecture

Existing feature evaluators continue to own their fixtures and quality scorers. A small dependency-free `scripts/lib/model-eval/` layer supplies shared CLI parsing, attempt classification, repeat/matrix execution, p50/p95 calculation, and safe report generation. The model client gains an explicit evaluation-only no-fallback option. The generic benchmark harness becomes an authoritative contract runner for truth check, cover letter, interview prep, clarification, and metadata; its existing match and optimize modes remain labelled smoke checks because their production wrappers can recover or transform output.

Every live attempt records only non-sensitive metadata and score summaries. Raw provider output stays local. Candidate selection never consumes a cache unless the caller explicitly asks to update it, and any primary-call fallback, timeout, malformed JSON, schema failure, skipped fixture, stale cache, or unavailable model fails a confirmation run.

## Tech Stack

- Node ESM scripts and built-in `node:fs`, `node:path`, and `node:assert`
- Existing Vitest 4 test suite
- Existing AI contracts in `netlify/lib/ai-contracts/contracts/index.js`
- Existing OpenRouter client and model registry
- Existing parse, match, and optimize gold fixtures/scorers

## Global Constraints

- Do not change `MODELS`, `GEMINI_MODELS`, or any production feature default.
- Do not add dependencies, provider SDKs, migrations, or automatic CI/live evaluation.
- Candidate IDs belong only in `SUPPORTED_BENCHMARK_MODELS`; production overrides remain gated.
- Evaluation attempts must send `featureName` prefixed with `benchmark.` and must pass `disableFallback: true`.
- Reports must not serialize resumes, job descriptions, prompts, raw model responses, API keys, or usage-event payloads.
- Keep `scripts/parse-eval.mjs`, `scripts/match-eval.mjs`, and `scripts/optimize-quality-eval.mjs`; enhance them in place.
- Existing one-baseline/one-candidate benchmark CLI stays compatible. New multi-model arguments are additive.
- Any required failure must result in a non-zero process exit; a successful process exit must not conceal failed fixtures.
- Use `--update-cache` as the only path that overwrites a `*.actual.json` cache.

## Task 1: Create the shared deterministic evaluation primitives

**Files:**
- Create `scripts/lib/model-eval/statistics.mjs`
- Create `scripts/lib/model-eval/reporting.mjs`
- Create `scripts/lib/model-eval/attempts.mjs`
- Create `scripts/lib/model-eval/cli.mjs`
- Create `scripts/lib/model-eval/__tests__/statistics.test.js`
- Create `scripts/lib/model-eval/__tests__/attempts.test.js`
- Create `scripts/lib/model-eval/__tests__/reporting.test.js`

1. Write Vitest tests first for median/p50 and nearest-rank p95. Reject an empty series and non-finite values instead of returning misleading values.
2. Implement `summarizeLatencies(samples)` returning `{ count, minMs, p50Ms, p95Ms, maxMs, meanMs }`, where p95 uses the nearest-rank index `ceil(0.95 * n) - 1` in a sorted copy.
3. Write failing tests for attempt classification: `fallbackUsed`, `schemaValid`, `malformedJson`, `timeout`, `providerUnavailable`, `cacheUsed`, `skipped`, and `primarySuccess`. Primary success is true only for a direct OpenRouter response that validates against the contract schema and did not read a cache.
4. Implement `classifyAttempt()` and `isConfirmationFailure()` using an explicit `provider` field (`openrouter`, `gemini`, or `cache`) rather than error-text heuristics. Return durable machine-readable failure reasons.
5. Write failing tests for report sanitization and deterministic output paths. Tests must prove `resumeText`, `jobDescription`, `messages`, `rawOutput`, and values matching API-key names are omitted.
6. Implement `createEvaluationSession()` and `writeEvaluationReport()`. Write `manifest.json`, `<feature>.json`, and `<feature>.md` under `scripts/benchmark-reports/<timestamp>-<feature>/`; include models, fixture IDs/count, command-safe options, outcome summaries, p50/p95, approximate cost, and pricing snapshot timestamp. Use atomic filename creation and return absolute paths.
7. Implement `parseEvaluationArgs(argv)` with `--feature`, legacy `--baseline`/`--candidate`, additive `--models` (comma-separated), `--runs`, `--fixture`, `--stage`, `--update-cache`, `--report-dir`, and `--selftest`. Reject missing/duplicate/invalid values and report a concise usage message.
8. Run the new three test files. Commit only after all are green.

## Task 2: Make provider identity and no-fallback selection enforceable

**Files:**
- Modify `netlify/lib/openrouter-client.js`
- Modify `netlify/lib/ai-contracts/executor.js`
- Modify `netlify/lib/__tests__/openrouter-client.test.js`
- Modify `netlify/lib/__tests__/ai-contracts.test.js` only if executor option forwarding lacks coverage

1. Add failing tests showing `callOpenRouter(..., { disableFallback: true })` throws the original eligible OpenRouter error and calls `fetch` once even when Gemini credentials exist.
2. Add a failing test proving `disableFallback` also rejects Gemini-only execution rather than silently switching provider when no OpenRouter key is configured.
3. Implement the option in `callOpenRouter`. It must not alter default production behavior, timeout budgeting, existing usage logging, or existing fallback tests.
4. Extend the executor’s call-options builder to accept and pass `modelId`, `disableFallback`, and an evaluation-only `featureName` override without allowing a caller to override contract schema, temperature, token limit, or timeout.
5. Add an executor test with a mocked client that asserts the safe options are forwarded and contract options remain authoritative.
6. Run `npx vitest run netlify/lib/__tests__/openrouter-client.test.js netlify/lib/__tests__/ai-contracts.test.js`.

## Task 3: Add the candidate matrix without affecting production routing

**Files:**
- Modify `netlify/lib/model-registry.js`
- Modify `netlify/lib/__tests__/model-registry.test.js`
- Create `scripts/lib/model-eval/matrix.mjs`
- Create `scripts/lib/model-eval/__tests__/matrix.test.js`

1. Write registry tests that preserve the current defaults and assert each approved candidate is allowed: Gemini 3.5 Flash Lite, Gemini 3.1 Flash Lite, Gemini 3.5 Flash, DeepSeek V4 Flash, Qwen 3.5 Flash, GLM 4.7 Flash, and Mistral Small 3.2 24B Instruct. Use exact current OpenRouter IDs verified before editing.
2. Add those exact IDs to `SUPPORTED_BENCHMARK_MODELS` only. Extend `APPROXIMATE_PRICING` only for candidates whose provider pricing can be sourced at implementation time; unknown pricing must be represented as `null`, never invented.
3. Write tests for `buildEvaluationStages()` defining: stage 0 incumbent sanity, stage 1 two-fixture English+Arabic eligibility, stage 2 three full-suite runs, and stage 3 five fresh confirmation runs for the winner and incumbent.
4. Implement matrix selection so a model advances only when every required fixture has a primary success. Treat unavailable models as excluded with a recorded reason, not a script crash.
5. Implement `recommendWinner()` with quality/reliability gates first. For a statistically indistinguishable tie, retain incumbent unless candidate has at least 15% p95 improvement or 20% cost improvement. Return `no-decision` when gates or required metrics are incomplete.
6. Run the matrix and registry tests.

## Task 4: Enhance parse, match, and optimize gold evaluators in place

**Files:**
- Modify `scripts/parse-eval.mjs`
- Modify `scripts/match-eval.mjs`
- Modify `scripts/optimize-quality-eval.mjs`
- Create `scripts/lib/model-eval/__tests__/gold-evaluator-options.test.js`
- Modify existing evaluator guard tests only where a new pure helper is extracted

1. Extract only pure option/result helpers required for unit testing; do not import a script that calls `main()` at module load.
2. Write failing tests that explicit `--models`/`--runs` converts every direct contract invocation into `modelId` plus `disableFallback: true`, while an ordinary no-argument evaluator run preserves its production default behavior.
3. Parse evaluator: accept the shared evaluation arguments, call the real `parse_resume` contract with an explicit candidate `modelId`, classify each repeat, report score/latency/cost, and prohibit cache reads/writes for a candidate run unless `--update-cache` is passed. Preserve `--selftest`.
4. Match evaluator: use the real `ai_match_reality_check` contract directly for every candidate attempt; pass the explicit `modelId` and `disableFallback: true`; keep existing score-band and invariant scoring. Do not use `processMatchOnly` for a selection decision.
5. Optimize evaluator: retain its contract validation, grounding/fabrication checks, and blind quality judge. Add repeat-aware result aggregation and report all quality/failure metrics. A failure in any required confirmation attempt must fail the feature run even if the judge scores other attempts.
6. For all three scripts, emit result records compatible with `writeEvaluationReport()` and exit non-zero for required failures, invalid candidates, empty fixture sets, or stale cache use.
7. Run offline/self-test coverage: `npm run eval:parse -- --selftest`, `npm run eval:match -- --selftest`, and the optimize script’s dry-run/self-test path. Then run the focused Vitest tests.

## Task 5: Make the generic benchmark authoritative for the remaining contracts

**Files:**
- Modify `scripts/benchmark-ai-models.mjs`
- Create `scripts/lib/model-eval/contract-runners.mjs`
- Create `scripts/lib/model-eval/__tests__/contract-runners.test.js`
- Create `scripts/lib/model-eval/__tests__/benchmark-cli.test.js`

1. Write tests for `runContractAttempt()` using mocked contracts/client. Assert it builds each real contract message, calls the contract executor with `modelId`, `disableFallback: true`, and a `benchmark.` feature name, validates with the contract output schema, and returns a classified result without raw output.
2. Implement real-contract feature aliases: `truth-check -> resume_truth_check`, `cover-letter -> cover_letter`, `interview -> interview_prep`, `clarification -> clarification_questions`, and `metadata -> job_metadata_extraction`.
3. Keep generic `match` and `optimize` accepted but label them smoke-only in terminal and report metadata. Their production wrappers must not determine a winner.
4. Replace hand-copied clarification and metadata prompt/schema definitions with real contract calls. Add feature-specific deterministic scorers: truth-check evidence/flag coverage, cover-letter required employer/role/evidence and unsupported-claim flags, interview question/answer/evidence coverage, clarification maximum/required question shape, and metadata exact-field/null handling.
5. Preserve legacy `--baseline` + `--candidate`, add `--models` + `--runs`, and ensure the runner compares all requested models across the selected fixtures. Any failed attempt causes non-zero exit after the complete report is written.
6. Run the new unit tests and a no-key CLI validation invocation that proves unsupported models and bad feature names fail before a network request.

## Task 6: Freeze feature fixtures, smoke fixtures, and decision documentation

**Files:**
- Create `eval/truth-check-fixtures/*.json` (minimum 8)
- Create `eval/cover-letter-fixtures/*.json` (minimum 8)
- Create `eval/interview-fixtures/*.json` (minimum 8)
- Create `scripts/benchmark-fixtures/clarification-*.json` and `scripts/benchmark-fixtures/metadata-*.json` as needed for Arabic/English smoke coverage
- Create `eval/model-eval-fixture-manifest.json`
- Create `eval/__tests__/model-eval-fixture-manifest.test.js`
- Modify `scripts/benchmark-fixtures/README.md`
- Create or modify `docs/AI_MODEL_BENCHMARKING.md`

1. Write the manifest test first. It must require at least eight synthetic fixtures for every primary feature; each must include at least two Arabic cases and cover English, Arabic, mixed language, positive, negative, and adversarial cases. Existing parse/match/optimize fixture IDs may be referenced after verification; new manifests must not duplicate their sensitive content.
2. Add synthetic JSON fixtures with stable IDs, a `language`, safety expectations, required evidence/terms, expected score bands/flags, and no actual candidate PII. Every fixture must be internally consistent with the real contract input shape.
3. Add two-fixture Arabic+English smoke coverage for clarification and metadata. Keep them out of winner selection and state that status prominently in documentation.
4. Document staged matrix commands, required environment (`OPENROUTER_API_KEY`, `GEMINI_API_KEY` intentionally unset for direct-provider runs), report retention/privacy, gates, tie policy, cache behavior, and the rule that no production default changes until a committed evaluation report is reviewed.
5. Run fixture manifest tests and a privacy scan that rejects unapproved email domains/phone-like values in newly added fixture files.

## Task 7: Integrate, verify, and conduct a bounded live smoke

**Files:**
- Modify only files needed to resolve test/integration failures from Tasks 1-6

1. Run `git diff --check` and `npm run type:check`.
2. Run all touched focused Vitest suites, including provider, executor, registry, model-eval library, and fixture-manifest tests.
3. Run offline evaluator self-tests and dry-run CLI checks.
4. With `OPENROUTER_API_KEY` available and `GEMINI_API_KEY` explicitly empty, run one English and one Arabic fixture for the incumbent and one candidate using the new stage-1 command. This is a smoke of the new reporting/no-fallback path, not a model-selection conclusion.
5. Verify the report contains no raw fixture text or secrets, records the direct provider, and exits non-zero if a forced invalid candidate is passed.
6. Do not update production defaults. Summarize any live model result as preliminary unless stages 0-3 have all been completed.

## Final Verification Checklist

1. `git diff --check`
2. `npx vitest run netlify/lib/__tests__/openrouter-client.test.js netlify/lib/__tests__/ai-contracts.test.js netlify/lib/__tests__/model-registry.test.js scripts/lib/model-eval/__tests__ eval/__tests__/model-eval-fixture-manifest.test.js`
3. `npm run type:check`
4. `npm run eval:parse -- --selftest`
5. `npm run eval:match -- --selftest`
6. The optimized evaluator dry-run/self-test command
7. One two-fixture, no-fallback live smoke with a report privacy inspection

## Expected Commits

1. `test: cover model-evaluation primitives and direct-provider calls`
2. `feat: add reliable feature-specific model evaluation`
3. `test: freeze model-evaluation fixture coverage`
4. `docs: document model evaluation matrix and gates`
