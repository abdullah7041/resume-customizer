# Final fix wave report

Date: 2026-07-26

Branch: `codex/feature-model-evaluation-design`

Scope: final whole-branch review findings for feature-specific model evaluation.

## Outcome

All four final-review findings were fixed with focused red-green regression coverage. Production model defaults, provider fallback defaults, contract schemas, token limits, temperatures, reasoning controls, and candidate allowlists remain unchanged. No dependency was added and no paid matrix was run.

## Finding 1: bounded caller timeouts

Root cause: `buildCallOptions()` always replaced a caller deadline with `contract.timeoutMs`, so production callers could no longer reduce an AI contract timeout.

Fix:

- A finite caller timeout is now bounded with `Math.min(contract.timeoutMs, options.timeoutMs)`.
- Caller increases are rejected by retaining the contract deadline.
- Contract temperature, maximum tokens, reasoning budget, schema name/schema, and response format remain authoritative.

TDD evidence:

- Added a regression proving a 1 ms caller timeout reaches the client as 1 ms.
- Added a regression proving a 120000 ms caller timeout remains capped at the 65000 ms contract deadline.
- The smaller-timeout regression failed first with `timeoutMs: 65000`, then passed after the bounded merge.

## Finding 2: enforced stages and selection gates

Root cause: the benchmark CLI parsed and reported `--stage` but did not use the matrix primitives. A stage-3 label could therefore be paired with one run, and no winner decision applied reliability, quality, noise-floor, or efficiency gates.

Fix:

- `--stage` now enforces the matrix run requirements: stage 0 = 1, stage 1 = 1, stage 2 = 3, stage 3 = 5.
- `--stage 3 --runs 1` is rejected before fixture execution or a network request.
- Stage 0 requires one incumbent; stage 3 requires exactly an incumbent and one candidate.
- Staged runs cannot use `--fixture`, which prevents partial fixture sets from masquerading as a completed stage.
- Stage 1 deterministically selects one English and one Arabic fixture.
- `buildEvaluationStages()`, `selectAdvancingModels()`, and `recommendWinner()` now participate in benchmark execution.
- Matrix advancement consumes the runner's nested classified-attempt shape without trusting a caller-supplied `primarySuccess`.
- Selection reports record stage, required runs, advanced/excluded models, per-model quality/reliability/latency/cost summaries, the quality noise floor, and the recommendation.
- Stage-3 recommendations require completed quality and reliability confirmation for both models before applying quality, p95-latency, and cost tie policy.
- When pricing is unavailable, the cost tie gate is marked unavailable; it is never treated as a zero-cost improvement. The independent p95-latency gate remains usable.
- Match, optimize, clarification, and metadata are smoke-only. The CLI rejects staged selection for them and their reports record `smoke_only_feature`.

TDD evidence:

- Added red-first CLI regressions for stage-3 run mismatch and smoke-only staged selection.
- Added red-first stage-1 fixture-scope and advancement-report coverage.
- Added red-first stage-3 recommendation coverage for quality/reliability/noise/latency policy.
- Added matrix regressions for nested classifications and unknown-cost tie handling.
- Added persisted smoke-only selection metadata coverage.

## Finding 3: pricing snapshot and cost evidence

Root cause: the provider client reduced successful responses to text, the executor reduced them to validated data, and attempts therefore had no safe token evidence. Reports wrote `pricingSnapshotTimestamp: null` and costs remained unknown.

Fix:

- Default production client behavior still returns text.
- Default production executor behavior still returns validated/transformed contract data.
- Evaluation callers can opt into `includeResponseMetadata`, which returns a narrow envelope containing the normal value plus provider, model ID, and normalized token counts.
- Only non-negative integer token counts are exposed. Missing, string, negative, non-finite, or provider-private usage fields are not copied and yield `null`.
- Direct contract attempts and gold evaluators request the opt-in envelope, unwrap the original value, and calculate approximate cost using `estimateCostUsd()` from the existing model registry.
- Metadata must identify direct OpenRouter and the exact requested model before it can be priced.
- Unknown pricing or incomplete token evidence produces `null` cost. Aggregate and per-fixture totals also remain `null` if any constituent attempt lacks cost evidence; partial totals are not presented as complete.
- The model registry now exports `APPROXIMATE_PRICING_SNAPSHOT_DATE = "2026-07-26"`.
- Generic, parse, match, and optimize evaluation reports record that pricing snapshot date.

TDD evidence:

- Added red-first client tests for the opt-in envelope, raw usage omission, and invalid/missing token normalization.
- Added red-first executor envelope coverage.
- Added red-first direct-runner known-price and unknown-price cost coverage.
- Added registry regressions for the snapshot date and unsafe token rejection.
- Added gold evaluator envelope/cost and incomplete aggregate-cost coverage.
- Added benchmark report coverage for the non-null pricing snapshot.

## Finding 4: dedicated clarification and metadata fixtures

Root cause: clarification and metadata fell back to `scripts/benchmark-fixtures/` without feature filtering, so every generic benchmark JSON was sent to those contracts.

Fix:

- Clarification loads only `clarification-*.json`.
- Metadata loads only `metadata-*.json`.
- Both smoke corpora require stable fixture IDs for `--fixture`; filenames are not accepted as aliases.
- Tests require exactly two dedicated fixtures per feature with English and Arabic coverage, and verify every selected fixture declares the matching feature.

TDD evidence:

- The routing tests failed first because each feature loaded the entire generic corpus.
- They pass after prefix routing and stable-ID filtering.

## Verification

All commands were run from the linked worktree.

- `npx vitest run netlify/lib/__tests__/openrouter-client.test.js netlify/lib/__tests__/ai-contracts.test.js netlify/lib/__tests__/model-registry.test.js` — passed.
- `npx vitest run scripts/lib/model-eval/__tests__/matrix.test.js scripts/lib/model-eval/__tests__/benchmark-cli.test.js scripts/lib/model-eval/__tests__/contract-runners.test.js scripts/lib/model-eval/__tests__/gold-evaluator-options.test.js scripts/lib/model-eval/__tests__/reporting.test.js` — passed.
- Touched-file `npx eslint` across all changed runtime and test files — no issues.
- `rtk tsc` — no TypeScript errors.
- `npm run eval:parse -- --selftest` — passed.
- `npm run eval:match -- --selftest` — passed.
- `npm run eval:optimize -- --dry-run --fixture en-resume-jd.json` — passed without API calls.
- `git diff --check` — passed before report creation and is rerun after this report.

## Remaining concerns

- No live OpenRouter call or paid stage matrix was run in this fix wave. Provider-reported token metadata and approximate prices are covered with controlled response fixtures, while live billing remains provider/dashboard evidence.
- Approximate costs use the registry snapshot dated 2026-07-26 and must not be treated as billing truth after provider pricing changes.
- The optimize dry-run logs the existing no-provider-key startup warning because it imports the shared client, but it completed successfully and made no API calls.
- The installed CodeGraph index was unavailable in this linked worktree, so repository-guided RTK inspection and narrow PowerShell line reads were used instead.
