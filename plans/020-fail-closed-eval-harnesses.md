# Plan 020: Make the eval harnesses fail closed instead of silently passing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d2fba38..HEAD -- scripts/parse-eval.mjs scripts/match-eval.mjs scripts/optimize-quality-eval.mjs scripts/lib/model-eval/gold-evaluator-options.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `d2fba38`, 2026-08-08

## Why this matters

`CLAUDE.md` names two production decisions that are guarded by these harnesses:

- `npm run eval:parse` "must stay 8/8 @ 100%" — the guard on keeping
  `parse_resume` on `responseFormat: 'json_object'` rather than `json_schema`.
- `npm run eval:match` (8/8 @ 100%) — the guard on the `strongMatches` evidence
  rule.

Both guards can currently report success without actually testing what they
claim to test:

1. **The provider can silently swap.** In their default (non-`evaluation`)
   modes, all three gold evaluators pass no `disableFallback`, so a failing or
   missing OpenRouter key makes `openrouter-client.js` fall back to direct
   Gemini and return a normal success. `classifyGoldResult` then hardcodes
   `provider: 'openrouter'` in the report. The run looks clean while measuring a
   different provider than the one production uses.
2. **`parse-eval` drops fixtures it can't run.** A fixture with no API key and
   no cache is skipped with a `console.log` and excluded from scoring — so "8/8"
   can silently become "7/7". If *every* fixture is skipped, the script prints
   "Nothing scored" and exits **0**.

`scripts/benchmark-ai-models.mjs` already gets this right and is tested; the
three older gold evaluators never inherited the pattern. This plan brings them
in line.

## Current state

### 1. `disableFallback` is only set in evaluation mode

`scripts/lib/model-eval/gold-evaluator-options.mjs:172-185`:

```js
export const buildGoldContractOptions = ({ feature, mode, modelId } = {}) => {
  assertGoldFeature(feature);
  if (mode !== 'evaluation') return {};
  if (typeof modelId !== 'string' || !modelId) {
    throw new TypeError('Evaluation contract options require a modelId.');
  }

  return {
    modelId,
    disableFallback: true,
    featureName: `benchmark.${feature}`,
    includeResponseMetadata: true,
  };
};
```

The three default-mode call sites therefore receive `{}`:

- `scripts/match-eval.mjs:72-81` — `runMatch(fixture, contractOptions = {})`
  passes `contractOptions` straight into `executeAiContract(CONTRACT_ID, input, contractOptions)`.
- `scripts/parse-eval.mjs:77-89` — `runParser` branches on
  `contractOptions.disableFallback === true`; when it is not set, it takes the
  `callOpenRouter` path directly:
  ```js
  const runParser = async (text, contractOptions = {}, retryTransient = true) => {
    const { aiContracts } = await importPath(ROOT, "netlify", "lib", "ai-contracts", "contracts", "index.js");
    if (contractOptions.disableFallback === true) {
      const { executeAiContract } = await importPath(ROOT, "netlify", "lib", "ai-contracts", "executor.js");
      return executeAiContract("parse_resume", { inputData: text }, contractOptions);
    }

    const { callOpenRouter } = await importPath(ROOT, "netlify", "lib", "openrouter-client.js");
  ```
- `scripts/optimize-quality-eval.mjs:227-241` — spreads `...directOptions` (which
  is `{}` in default mode) into the `callOpenRouter` options.

### 2. The report always claims OpenRouter

`scripts/lib/model-eval/gold-evaluator-options.mjs:252-256`:

```js
export const classifyGoldResult = ({ error = null, schemaValid = error == null } = {}) => classifyAttempt({
  provider: 'openrouter',
  schemaValid: schemaValid === true && error == null,
  failureReason: error || schemaValid !== true ? failureReasonFor(error) : null,
});
```

There is no parameter by which a caller could report the provider that actually
served the request.

### 3. `parse-eval` skips and exits 0

`scripts/parse-eval.mjs:283-307`:

```js
    let actual;
    try {
      if (hasKey) {
        actual = await runParser(fixture.text);
        // Cache the live output so the set can be re-scored offline without tokens.
        writeFileSync(cachePath, JSON.stringify(actual, null, 2) + "\n");
      } else if (existsSync(cachePath)) actual = JSON.parse(readFileSync(cachePath, "utf8"));
      else {
        console.log(`\n${C.dim}skip ${fixture.name} (no key, no cache)${C.reset}`);
        continue;
      }
    } catch (err) {
```
```js
  if (results.length === 0) {
    console.log(`\n${C.yellow}Nothing scored. Set OPENROUTER_API_KEY or add *.actual.json caches.${C.reset}`);
    process.exit(0);
  }
```

### The correct pattern already in the repo

`scripts/match-eval.mjs:294-304` — the fail-closed guard to port:

```js
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY);
  const missingCaches = getMissingFixtureCaches(
    files,
    hasKey,
    (file) => existsSync(join(FIXTURE_DIR, file.replace(/\.json$/, ".actual.json"))),
  );
  if (missingCaches.length) {
    console.error(`${C.red}Cannot evaluate fixtures without OPENROUTER_API_KEY or caches: ${missingCaches.join(", ")}${C.reset}`);
    process.exit(1);
  }
  if (!hasKey) console.log(`${C.yellow}No OPENROUTER_API_KEY — scoring cached *.actual.json.${C.reset}`);
```

The helper it uses, `eval/match-eval-guards.mjs:1-4`, is generic and reusable
as-is:

```js
export function getMissingFixtureCaches(files, hasLiveApiKey, hasCacheForFile) {
  if (hasLiveApiKey) return [];
  return files.filter((file) => !hasCacheForFile(file));
}
```

It is already tested at `src/__tests__/match-eval-guards.test.js`.

`scripts/parse-eval.mjs` already imports `existsSync` and defines `FIXTURE_DIR`
(`scripts/parse-eval.mjs:15`, `:38`), so the port needs no new plumbing beyond
one import.

### CRITICAL: where tests must live

`vitest.config.ts` `include` is an explicit allowlist:

```
"src/**/*.{test,spec}.{js,jsx,ts,tsx}",
"netlify/functions/__tests__/**/*.test.ts",
"netlify/lib/__tests__/**/*.test.{js,ts}",
"eval/__tests__/**/*.test.js",
"scripts/lib/model-eval/__tests__/**/*.test.js"
```

**`scripts/__tests__/` is NOT in that list.** A test file placed there would
silently never run — which is the same class of bug this plan is fixing. Put
new tests in `scripts/lib/model-eval/__tests__/` (already covered) and do not
add a new glob.

### Repo conventions

- These are `.mjs` ESM scripts run via `tsx`, not `node` — `package.json`
  defines `eval:parse`, `eval:match`, `eval:optimize` as `tsx scripts/*.mjs`.
- Dynamic imports use `pathToFileURL` (see `scripts/parse-eval.mjs:42-43`) —
  required on Windows. Do not replace with bare paths.
- Existing harness tests to model on: `scripts/lib/model-eval/__tests__/gold-evaluator-options.test.js`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run type:check` | exit 0, no errors |
| Harness tests | `npx vitest run scripts/lib/model-eval/__tests__/` | all pass |
| Guard test | `npx vitest run src/__tests__/match-eval-guards.test.js` | all pass |
| Lint | `npm run lint` | exit 0 |
| Full suite | `npm run test` | exit 0 (181 files) |

**Do NOT run `npm run eval:parse`, `eval:match`, `eval:optimize`, or
`benchmark:ai`.** They make real, paid AI calls. Every change here is verified
by unit tests instead.

## Scope

**In scope:**
- `scripts/lib/model-eval/gold-evaluator-options.mjs`
- `scripts/parse-eval.mjs`
- `scripts/match-eval.mjs`
- `scripts/optimize-quality-eval.mjs`
- `scripts/lib/model-eval/__tests__/gold-evaluator-options.test.js` (add tests)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `netlify/lib/openrouter-client.js` — its Gemini fallback is **correct
  production behaviour** for real user traffic. The bug is that benchmarks
  inherit it, not that it exists. Do not disable or weaken the fallback.
- `netlify/lib/ai-contracts/executor.js` — `disableFallback: options.disableFallback === true`
  defaulting to `false` is right for production callers.
- `scripts/benchmark-ai-models.mjs` and `scripts/lib/model-eval/contract-runners.mjs`
  — already correct; they are the exemplar, not the target.
- `vitest.config.ts` — do not add a `scripts/__tests__/` glob; put tests in the
  already-covered directory instead.
- Any fixture in `eval/` or any `*.actual.json` cache. Do not regenerate caches.
- The scoring logic (`eval/score.mjs`) and any threshold value.

## Git workflow

- Branch: `advisor/020-fail-closed-eval-harnesses`
- Conventional commits; this repo uses an `eval` scope for these files
  (e.g. `fix(eval): enforce final benchmark selection gates`,
  `fix(eval): record providers in benchmark reports`).
  Suggested: `fix(eval): fail closed on missing key, cache and provider fallback`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Let `classifyGoldResult` report the real provider

In `scripts/lib/model-eval/gold-evaluator-options.mjs:252-256`, add an optional
`provider` parameter that defaults to `'openrouter'` so existing callers are
unaffected:

```js
export const classifyGoldResult = ({ error = null, schemaValid = error == null, provider = 'openrouter' } = {}) => classifyAttempt({
  provider,
  schemaValid: schemaValid === true && error == null,
  failureReason: error || schemaValid !== true ? failureReasonFor(error) : null,
});
```

**Verify**: `npx vitest run scripts/lib/model-eval/__tests__/gold-evaluator-options.test.js` → all pass (behaviour unchanged for existing callers).

### Step 2: Always disable fallback in the gold evaluators

The cleanest change is at the source. In `buildGoldContractOptions`
(`gold-evaluator-options.mjs:172-185`), the non-evaluation branch should still
pin the provider even though it has no `modelId` to pin:

```js
export const buildGoldContractOptions = ({ feature, mode, modelId } = {}) => {
  assertGoldFeature(feature);
  if (mode !== 'evaluation') {
    // Default/legacy mode still must not silently fall back to direct Gemini —
    // a gold evaluator that measures a different provider than production is
    // worse than one that fails. No modelId here: default mode uses whatever
    // the contract's own model is.
    return { disableFallback: true, includeResponseMetadata: true };
  }
  if (typeof modelId !== 'string' || !modelId) {
    throw new TypeError('Evaluation contract options require a modelId.');
  }

  return {
    modelId,
    disableFallback: true,
    featureName: `benchmark.${feature}`,
    includeResponseMetadata: true,
  };
};
```

Then make sure each of the three scripts actually routes its default-mode call
through these options:

- **`scripts/optimize-quality-eval.mjs:227-241`** already spreads
  `...directOptions` from `buildGoldContractOptions`, so it now inherits the fix
  with no further change. Confirm by reading.
- **`scripts/match-eval.mjs`** — the default-mode call at the loop body
  (around `:308`, `actual = await runMatch(fixture);`) passes no options. Change
  it to pass `buildGoldContractOptions({ feature: 'match', mode: options.mode })`.
- **`scripts/parse-eval.mjs`** — the default-mode call at `:286`
  (`actual = await runParser(fixture.text);`) passes no options. Change it to
  pass `buildGoldContractOptions({ feature: 'parse', mode: options.mode })`.

**The accepted feature strings are fixed and known** — you do not need to go
looking. `scripts/lib/model-eval/gold-evaluator-options.mjs:10`:

```js
const GOLD_FEATURES = new Set(['parse', 'match', 'optimize']);
```

So `'parse'` and `'match'` above are correct as written.

**Note on mode values**: the default mode string in this codebase is
`'production'`, not `'default'` —
`scripts/lib/model-eval/gold-evaluator-options.mjs:31-34` returns
`{ mode: 'production', ... }` when `argv` is empty. Only `'evaluation'` is
special-cased. Use `'production'` in any test you write.

### The unwrap is shape-safe — this is why Step 2 is not risky

Routing `parse-eval`'s default path through `disableFallback: true` makes
`runParser` take the `executeAiContract` branch at `:79-82`, which returns a
**response envelope** rather than raw parsed JSON. The default path must
therefore unwrap before calling `scoreResume`.

`unwrapEvaluationResponse` handles **both** shapes safely —
`scripts/lib/model-eval/gold-evaluator-options.mjs:187-206`:

```js
export const unwrapEvaluationResponse = ({ response, modelId } = {}) => {
  const isEnvelope = response
    && typeof response === 'object'
    && Object.hasOwn(response, 'metadata')
    && (Object.hasOwn(response, 'data') || Object.hasOwn(response, 'text'));
  const value = isEnvelope
    ? (Object.hasOwn(response, 'data') ? response.data : response.text)
    : response;
```

When the response is **not** an envelope it returns `value === response`
verbatim. So calling it unconditionally is a no-op on the old shape and a
correct unwrap on the new one — it cannot corrupt the value handed to
`scoreResume` either way. (`approximateCostUsd` comes back `null` in default
mode because `metadata.modelId !== modelId`; that is harmless — the default
path does not report cost.)

The evaluation path in the same file already does exactly this, and is your
template — `scripts/parse-eval.mjs:149-158`:

```js
      const execution = await runParser(fixture.text, planned.contractOptions, false);
      const {
        value: actual,
        approximateCostUsd,
      } = unwrapEvaluationResponse({
        response: execution,
        modelId: planned.modelId,
      });
      const latencyMs = Date.now() - startedAt;
      const result = scoreResume(fixture.expected, actual);
```

Mirror that in the default-mode loop: call `runParser` with the contract
options, pass the result through `unwrapEvaluationResponse`, and hand `.value`
to `scoreResume` and to the `*.actual.json` cache write. In default mode there
is no `planned.modelId`; passing `modelId: undefined` is fine (it only affects
the cost estimate, which is already unused there).

**Cache-write caution**: the existing default path writes
`JSON.stringify(actual, null, 2)` to the `*.actual.json` cache. Make sure it
writes the **unwrapped** value, not the envelope — otherwise every cache file
gains a `metadata` wrapper and offline re-scoring silently breaks.

**Verify**: `npx vitest run scripts/lib/model-eval/__tests__/` → all pass.

### Step 3: Make `parse-eval` fail closed on missing key + cache

In `scripts/parse-eval.mjs`, import the existing helper and add the guard
before the scoring loop, mirroring `scripts/match-eval.mjs:294-304`:

```js
import { getMissingFixtureCaches } from "../eval/match-eval-guards.mjs";
```

(Confirm the correct relative path from `scripts/` to `eval/` and match how
`match-eval.mjs` imports it.)

Then, immediately before the fixture loop:

```js
  const missingCaches = getMissingFixtureCaches(
    files,
    hasKey,
    (file) => existsSync(join(FIXTURE_DIR, file.replace(/\.json$/, ".actual.json"))),
  );
  if (missingCaches.length) {
    console.error(`${C.red}Cannot evaluate fixtures without OPENROUTER_API_KEY or caches: ${missingCaches.join(", ")}${C.reset}`);
    process.exit(1);
  }
```

Adapt `files` / the cache-path derivation to whatever `parse-eval.mjs` actually
iterates — read the loop first; its fixture list may be built differently from
`match-eval.mjs`'s.

Then replace the now-unreachable silent `continue` at `:290-293` with a hard
failure, and change the `results.length === 0` branch at `:304-307` from
`process.exit(0)` to `process.exit(1)` with a message saying nothing was scored.
An eval that scores nothing is a failed eval, not a passed one.

**Verify**: `node -e "process.exit(0)"` is not a real check here — instead
confirm by reading that no `continue` remains in the cache-miss branch and that
the empty-results branch exits non-zero:
`grep -n "process.exit(0)" scripts/parse-eval.mjs` → the only remaining matches,
if any, must be on genuine success paths (e.g. `--selftest`). Report which.

### Step 4: Close the vacuous-success hole in `aggregateGoldAttempts`

`scripts/lib/model-eval/gold-evaluator-options.mjs` — `aggregateGoldAttempts`
computes `requiredFailures = attempts.length - primarySuccesses`, which for an
empty array yields `0` and therefore reports **no required failure**, i.e. a
pass. No caller can reach it with an empty array today, but its siblings fail
closed on the same condition (`buildGoldEvaluationAttempts` throws on empty
`fixtureIds`).

Add a guard at the top of the function that throws a `TypeError` on an empty
array, matching the style of `buildGoldEvaluationAttempts`.

**Verify**: `npx vitest run scripts/lib/model-eval/__tests__/gold-evaluator-options.test.js` → all pass.

### Step 5: Add tests

In `scripts/lib/model-eval/__tests__/gold-evaluator-options.test.js` (already
inside the vitest include globs), add:

1. `buildGoldContractOptions({ feature: 'parse', mode: 'production' })` returns
   an object with `disableFallback: true` — this is the regression that matters.
   (`'production'` is the real default-mode string; see the note in Step 2.)
2. `buildGoldContractOptions` in evaluation mode still returns the full option
   set including `modelId` and `featureName` (guards against breaking Step 2).
3. `classifyGoldResult({ provider: 'gemini' })` reports `gemini`, and
   `classifyGoldResult({})` still defaults to `openrouter`.
4. `aggregateGoldAttempts([])` throws.

Model the structure on the existing tests in that same file.

**Verify**: `npx vitest run scripts/lib/model-eval/__tests__/gold-evaluator-options.test.js`
→ all pass, including 4 new tests.

### Step 6: Full verification

**Verify**:
- `npm run type:check` → exit 0
- `npm run lint` → exit 0
- `npm run test` → exit 0

## Test plan

- **New tests**: 4, added to
  `scripts/lib/model-eval/__tests__/gold-evaluator-options.test.js` (chosen
  because `scripts/__tests__/` is outside the vitest include globs and would
  never run).
- **Cases**: default-mode `disableFallback`; evaluation-mode options unchanged;
  provider passthrough + default; empty-attempts rejection.
- **Structural pattern to follow**: the existing tests in that same file.
- **Not covered here**: end-to-end behaviour of the three scripts, which would
  require real AI calls. Testing their CLI control flow directly is worthwhile
  but is deliberately deferred (see Maintenance notes).
- Verification: `npx vitest run scripts/lib/model-eval/__tests__/` → all pass.

## Done criteria

ALL must hold:

- [ ] `grep -n "if (mode !== 'evaluation') return {};" scripts/lib/model-eval/gold-evaluator-options.mjs` → no matches
- [ ] `grep -c "disableFallback: true" scripts/lib/model-eval/gold-evaluator-options.mjs` → ≥ 2
- [ ] `grep -c "provider" scripts/lib/model-eval/gold-evaluator-options.mjs` → includes the new parameter in `classifyGoldResult`
- [ ] `grep -n "getMissingFixtureCaches" scripts/parse-eval.mjs` → ≥ 1 match
- [ ] `grep -n "skip ${fixture.name} (no key, no cache)" scripts/parse-eval.mjs` → no matches
- [ ] `npm run type:check` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test` exits 0; 4 new tests exist and pass
- [ ] No new test file was created under `scripts/__tests__/`
- [ ] No `eval/**/*.actual.json` file was modified (`git status`)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `unwrapEvaluationResponse` excerpt in "Current state" does not match the
  live code — the shape-safety argument this plan rests on would no longer hold,
  and a wrong unwrap silently changes every fixture's score rather than erroring.
- After Step 2, a `*.actual.json` cache file gains a `metadata` key in a diff —
  that means the envelope is being cached instead of the unwrapped value.
  Revert and report; do not commit a rewritten cache.
- Any existing test in `scripts/lib/model-eval/__tests__/` fails after Step 2.
  That means a caller depended on the empty-object return.
- You are tempted to run `npm run eval:parse` / `eval:match` / `eval:optimize` /
  `benchmark:ai` to check your work. These cost real money — stop and report
  instead.
- You are tempted to weaken or remove the Gemini fallback in
  `netlify/lib/openrouter-client.js`. That is production behaviour and out of scope.

## Maintenance notes

- **What a reviewer should scrutinise**: Step 2's `parse-eval` change. It flips
  that script from the `callOpenRouter` path to the `executeAiContract` path,
  which is a genuine behavioural change to how the gold set is produced. The
  next live `npm run eval:parse` run should be compared against the committed
  `*.actual.json` caches to confirm scores did not move.
- **Operator follow-up (not an executor action)**: after this lands, someone
  with a key should run `npm run eval:parse` and `npm run eval:match` once and
  confirm they still report 8/8 @ 100%. Until that happens, the CLAUDE.md
  claims about those gates are unverified against the new code path.
- **Deferred out of this plan**: direct tests of the three scripts' own CLI
  control flow (arg parsing, exit codes for the key/cache matrix). They have no
  test coverage at all today, which is precisely why these two bugs survived.
  Doing it properly needs a filesystem/env stubbing harness and a decision about
  whether to widen the vitest include globs — too much to bundle into this fix.
- If a new gold evaluator script is ever added, it should call
  `buildGoldContractOptions` for **both** modes rather than constructing options
  inline; that is now the single place the fallback policy is decided.
