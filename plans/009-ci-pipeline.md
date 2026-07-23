# Plan 009: Add a CI pipeline that gates main (lint, typecheck, tests)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- package.json .husky/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

There is no CI: `.github/workflows/` does not exist. The only gate between a change and `main` is the maintainer's local machine — which (per CLAUDE.md) cannot reliably run the broad quality gate in-agent, and which has 8GB RAM. A production outage has already shipped this way (commit `04dd199 Fix prod outage (supabase-js Node 20 crash)`). One workflow running lint + typecheck + tests on every push/PR turns every other plan's "done criteria" into an enforced contract instead of an honor system. This is the verification baseline for the rest of the plan set.

## Current state

- No `.github/` directory exists at the repo root.
- `package.json:16-24` (scripts, verified):

  ```json
  "lint": "eslint .",
  "type:check": "tsc --noEmit && tsc -p netlify/tsconfig.json --noEmit",
  "test": "vitest run",
  ```

- `netlify.toml:21` — `NODE_VERSION = "20"` (the production runtime; CI must match).
- `package.json:5` — `"packageManager": "npm@11.14.0"`; lockfile is `package-lock.json` → use `npm ci`.
- `package.json:116-121` — lint-staged runs a **full dual typecheck on every commit**:

  ```json
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "bash -c 'npm run type:check'"
    ]
  }
  ```

  `.husky/pre-commit` contains only `npx lint-staged`.
- Known test-suite facts:
  - Tests mock the AI/network boundary. One OCR-related test (`extract-resume-json` "rejects scanned PDFs") is flaky **only** under the parallel `npm-run-all` gate when a real `OPENROUTER_API_KEY` is present; in CI no key is set and `vitest run` is a single process, so it is expected to pass. Do NOT add any real API key to CI.
  - `App.navigation.test.tsx` had an AuthProvider failure historically; commit `b14f39d test(app): mock useAuth in App.navigation test` addressed it. Confirm current state in Step 1.
- Eval harnesses (`npm run eval:parse` etc.) hit the real OpenRouter API and cost money — they must NOT run in CI.

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Lint      | `npm run lint`       | exit 0              |
| Typecheck | `npm run type:check` | exit 0              |
| Tests     | `npm run test`       | exit 0, all pass    |

## Scope

**In scope** (the only files you should modify/create):
- `.github/workflows/ci.yml` (create)
- `package.json` (lint-staged block only)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Any test file — if the suite fails in Step 1, that's a STOP, not a fix-it-here.
- `netlify.toml`, Netlify deploy settings, branch-protection settings (GitHub UI — maintainer's job; mention in your report).
- Eval scripts and their npm scripts.

## Git workflow

- Branch: `advisor/009-ci-pipeline`
- Suggested commit: `ci: add lint/typecheck/test workflow; slim pre-commit typecheck`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Establish the local baseline

Run the three commands sequentially (NOT `quality:parallel`): `npm run lint`, then `npm run type:check`, then `npm run test`. Record pass/fail for each.

**Verify**: all three exit 0. If any fails → STOP condition (report which, with output). CI must start green or it will be ignored.

### Step 2: Create the workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run type:check
      - run: npm run test
```

Notes: no secrets configured (tests must pass without any API keys — that's the contract); Node 20 matches `netlify.toml`; sequential steps mirror CLAUDE.md's guidance against the all-or-nothing parallel bundle.

**Verify**: `npx yaml-lint .github/workflows/ci.yml` if available; otherwise `node -e "require('js-yaml')"` is NOT guaranteed present — a plain visual check plus `git diff --check` suffices.

### Step 3: Slim the pre-commit typecheck

In `package.json`, change the lint-staged block to drop the full dual typecheck (it re-checks the whole project on every commit and ignores the staged file list; CI now owns whole-project typechecking):

```json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --fix"
  ]
}
```

**Verify**: `npx lint-staged --help` exits 0 (config still parseable). Make a scratch commit on your branch touching a `.ts` file to confirm the hook runs eslint only, then keep or squash that commit as appropriate.

### Step 4: Report follow-ups for the maintainer

In your final report (not in code), remind the maintainer to: (a) enable branch protection on `main` requiring the `quality` check, and (b) optionally add a separate manually-triggered workflow for the eval harnesses later (needs `OPENROUTER_API_KEY` secret and costs money — deliberately excluded here).

## Test plan

No new tests. The deliverable IS the test infrastructure. Step 1's baseline run is the verification that the workflow will pass on first execution.

## Done criteria

- [ ] `.github/workflows/ci.yml` exists with lint, type:check, test steps on Node 20 with npm cache
- [ ] `npm run lint && npm run type:check && npm run test` all exit 0 locally
- [ ] lint-staged no longer invokes `npm run type:check`
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 baseline has ANY failing test, lint error, or type error — list them; fixing them is separate work that must not be smuggled into this plan.
- `npm run test` attempts real network calls without env keys (would mean the mock-boundary assumption is stale) — name the test.
- The repo turns out to have a non-GitHub remote (check `git remote -v`) — GitHub Actions would be dead weight; report and propose the platform-appropriate CI instead.

## Maintenance notes

- Every subsequent plan's done criteria now get enforced on push — reviewers should treat a red CI as an automatic "not done".
- If test wall-clock in CI exceeds ~10 minutes, split lint/typecheck/test into parallel jobs; kept as one job initially for simplicity and npm-cache reuse.
- The flaky-under-parallel OCR test: if it ever fails in CI (single-process), that's a real regression, not the known flake — investigate rather than retry.
