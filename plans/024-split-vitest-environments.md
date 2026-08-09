# Plan 024: Stop running happy-dom for the 55 node-only test files

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a3de47e..HEAD -- vitest.config.ts src/test/setup.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (touches how *every* test runs — the mitigation is an exact before/after count, see Done criteria)
- **Depends on**: none (but assumes plans 017–022 are merged; the baseline counts below are post-merge)
- **Category**: dx
- **Planned at**: commit `a3de47e`, 2026-08-09

## Why this matters

`vitest.config.ts` applies `environment: "happy-dom"` to **all 183 test files**,
but 55 of them (`netlify/`, `eval/`, `scripts/`) are node-only backend tests
that never touch the DOM. Every one of them pays for a full happy-dom
construction plus a setup file that installs a `localStorage` mock on `window`.

This is not theoretical. Measured across three consecutive full-suite runs on
the merged branch:

| Run | `tests` phase | `environment` phase | Wall clock | Result |
|---|---|---|---|---|
| 1 | 151s | 799s | 594s | 1 failed (`resumeText.test.js`) |
| 2 | 155s | 571s | 418s | clean |
| 3 | 158s | 519s | 405s | 2 failed (`MainContent.test.jsx`) |

The actual test work is rock-steady at ~155s. Environment construction is
**3–5× that**, and it is what pushes borderline tests past the shared 10s
`testTimeout`. The failures land on a **different file each run** and every one
is `Test timed out in 10000ms`; both files pass in isolation. So the suite
currently cannot produce a trustworthy green locally, and CI runs this same
suite against a 20-minute job cap.

Patching whichever test loses the race is the wrong fix — it just relocates the
flake, which those three runs demonstrate. Removing the unnecessary environment
work is the fix.

After this plan: node-only tests run in the `node` environment with no DOM setup,
the suite gets materially faster, and the timeout flakiness should stop.

## Current state

### `vitest.config.ts` in full (this is the only file that must change)

```ts
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "pdfjs-dist/legacy/build/pdf.mjs": fileURLToPath(
        new URL("./src/test/__mocks__/pdfjs-dist.mjs", import.meta.url)
      ),
    },
  },
  test: {
    globals: true,
    testTimeout: 10000,
    environment: "happy-dom",
    setupFiles: "./src/test/setup.ts",
    include: [
      "src/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "netlify/functions/__tests__/**/*.test.ts",
      "netlify/lib/__tests__/**/*.test.{js,ts}",
      "eval/__tests__/**/*.test.js",
      "scripts/lib/model-eval/__tests__/**/*.test.js"
    ],
    css: true,
    env: {
      // Frontend Supabase credentials for client-side tests
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
      VITE_ASSETS_BASE_URL: "",
      // Backend Supabase credentials for Netlify function tests
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      OPENROUTER_API_KEY: "test-openrouter-key",
      UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    },
  },
});
```

### The setup file is DOM-only — this is the crux of the plan

`src/test/setup.ts` opens with:

```ts
import "@testing-library/jest-dom"; // nice matchers: toBeInTheDocument, etc.
import { vi } from "vitest";
```

and installs a `localStorage` mock via:

```ts
Object.defineProperty(window, "localStorage", {
```

`window` does not exist in the `node` environment, so **this setup file must not
run for the node project**. That is the single most important constraint here.

### The installed Vitest API — verified, do not substitute from memory

- Installed version: **`vitest@4.1.10`** (`node -p "require('./node_modules/vitest/package.json').version"`).
- **`environmentMatchGlobs` no longer exists in Vitest 4** — a repo-wide search of
  `node_modules/vitest/dist/**/*.d.ts` returns zero matches. Do not use it.
- The supported mechanism is `test.projects`
  (`projects?: TestProjectConfiguration[]`, `reporters.d.*.d.ts:2859`).
- A project entry accepts `extends?: string | true` — documented in the types as
  *"If `true`, the project will inherit all options from the root config."*

### Verified: no node-glob test actually needs the DOM

A search of all `{netlify,eval,scripts}/**/__tests__/**/*.test.{js,ts}` for
`document|window|localStorage|HTMLElement|createObjectURL` returns hits in 6
files, and **every one is a false positive** — confirmed by reading each:

- `netlify/lib/__tests__/rate-limiter.test.ts:7,20,21,106` — `window` is a
  *property name* on an Upstash `slidingWindow` mock, not the DOM `window`.
- `netlify/functions/__tests__/extract-resume-json*.test.ts` (many lines) —
  `body.document` / `.document` is a **JSON response field**, not the DOM `document`.
- `netlify/lib/__tests__/ai-contracts.test.js:51` and
  `netlify/functions/__tests__/generate-pdf.margins.test.ts:66` — the word
  "window" inside a prose comment.

So the split is expected to be clean. If a node test nevertheless fails for a
missing DOM global, see STOP conditions — do not silently move it back.

### Repo conventions

- `vitest.config.ts` is TypeScript, 2-space indent, double-quoted strings.
- Do not use `any`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Baseline / final counts | `npm run test` | see Done criteria |
| List collected files only | `npx vitest list --filesOnly` | 183 lines |
| Node project alone | `npx vitest run --project node` | all pass |
| DOM project alone | `npx vitest run --project dom` | all pass |
| Typecheck | `npm run type:check` | exit 0 |
| Lint | `npm run lint` | exit 0 |

**Capture exit codes correctly.** Do **not** write `npm run test | tail -N` — the
pipe returns `tail`'s status, not the suite's, which masked a real failure
earlier in this project. Use:

```bash
npm run test > /tmp/out.txt 2>&1; echo "EXIT=$?"; grep -E "^ Test Files|^      Tests " /tmp/out.txt
```

**Run only one suite at a time.** Concurrent full-suite runs on this machine
produce spurious timeout failures in unrelated files — that is the very problem
this plan fixes; do not reintroduce it while measuring.

## Scope

**In scope:**
- `vitest.config.ts`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `src/test/setup.ts` — it is correct as-is; the fix is to stop running it where
  it does not belong, not to make it environment-agnostic.
- Any test file. If the split is right, zero test files need editing. Editing a
  test to accommodate the config is a sign the config is wrong — STOP instead.
- `testTimeout` — do **not** raise it. Raising it hides the flake rather than
  removing its cause, and would mask a regression this plan is meant to expose.
- The `resolve.alias` entries (including the `pdfjs-dist` mock alias) and the
  `react()` / `tailwindcss()` plugins — both must keep applying to the DOM
  project. `extends: true` is what preserves them.
- `.github/workflows/ci.yml` — the `npm run test` entry point is unchanged, so
  CI needs no edit.
- `package.json` scripts.

## Git workflow

- Branch: `advisor/024-split-vitest-environments`
- Conventional commits, matching `git log` style. Suggested:
  `perf(test): split vitest into dom and node projects`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record the exact baseline — you will be judged against it

Before changing anything:

```bash
npm run test > /tmp/before.txt 2>&1; echo "EXIT=$?"
grep -E "^ Test Files|^      Tests " /tmp/before.txt
npx vitest list --filesOnly > /tmp/before-files.txt 2>&1; wc -l < /tmp/before-files.txt
```

Expected baseline (post-merge of plans 017–022): **183 test files, 1794 passed,
2 skipped (1796 total)**, `EXIT=0`.

If your baseline shows a *timeout* failure, re-run once — per the table in "Why
this matters" this happens roughly 2 runs in 3 today. You need one clean
baseline before proceeding. If it fails the same way twice with the same file,
STOP.

**Verify**: you have a clean baseline recorded, and `/tmp/before-files.txt` has
183 lines.

### Step 2: Convert to two projects

Rewrite the `test` block of `vitest.config.ts` to use `projects`. Keep
`plugins` and `resolve` exactly as they are at the top level.

Target shape:

```ts
  test: {
    // Root-level options shared by every project. NOTE: `environment`,
    // `setupFiles`, `include` and `css` deliberately do NOT live here — the
    // DOM setup file touches `window` and must never run in the node project.
    globals: true,
    testTimeout: 10000,
    env: {
      // ...unchanged, copy the existing block verbatim...
    },
    projects: [
      {
        extends: true,
        test: {
          name: "dom",
          environment: "happy-dom",
          setupFiles: "./src/test/setup.ts",
          css: true,
          include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "netlify/functions/__tests__/**/*.test.ts",
            "netlify/lib/__tests__/**/*.test.{js,ts}",
            "eval/__tests__/**/*.test.js",
            "scripts/lib/model-eval/__tests__/**/*.test.js",
          ],
        },
      },
    ],
  },
```

Two things to get right:

1. **The union of the two `include` arrays must be byte-identical to the
   original five globs.** Dropping or altering one silently stops running a
   whole directory of tests — exactly the class of bug this project already hit
   (`scripts/__tests__/` is outside the globs and never runs). Copy them across,
   do not retype from memory.
2. **`setupFiles` must appear only in the `dom` project**, never at root. If it
   is inherited by the node project, every node test fails on `window is not
   defined`.

`env` stays at root so both projects inherit it — the netlify tests need
`SUPABASE_*`/`OPENROUTER_API_KEY`, and plan 018's tests deliberately delete the
`UPSTASH_*` vars at module scope.

**Verify**: `npx vitest list --filesOnly > /tmp/after-files.txt 2>&1; wc -l < /tmp/after-files.txt`
→ **183**, and `diff <(sort /tmp/before-files.txt) <(sort /tmp/after-files.txt)`
→ **no output**. Same files collected, nothing gained or lost.

### Step 3: Run each project independently

```bash
npx vitest run --project node > /tmp/node.txt 2>&1; echo "EXIT=$?"; grep -E "^ Test Files|^      Tests " /tmp/node.txt
npx vitest run --project dom  > /tmp/dom.txt  2>&1; echo "EXIT=$?"; grep -E "^ Test Files|^      Tests " /tmp/dom.txt
```

Both must exit 0. The two file counts must sum to 183.

This is also the step that proves the environment split is real: the node
project should complete dramatically faster than before, because it no longer
builds happy-dom per file.

**Verify**: both exit 0; `node` files + `dom` files = 183.

### Step 4: Full suite, and compare against the baseline

```bash
npm run test > /tmp/after.txt 2>&1; echo "EXIT=$?"
grep -E "^ Test Files|^      Tests |^   Duration" /tmp/after.txt
```

**Verify**: `EXIT=0`, **183 files**, **1794 passed | 2 skipped** — identical to
your Step 1 baseline. Record the `Duration` line and the `environment` figure
inside it; report both alongside the baseline numbers so the improvement is
measured, not assumed.

### Step 5: Confirm the flakiness is actually gone

Run the full suite **twice more**, serially (never concurrently):

```bash
for i in 2 3; do npm run test > /tmp/after-$i.txt 2>&1; echo "RUN$i EXIT=$?"; grep -E "^      Tests " /tmp/after-$i.txt; done
```

All three runs (Step 4 + these two) must be green. Given the pre-change failure
rate was roughly 2 in 3, three consecutive greens is meaningful evidence.

If any run fails, report the exact file and error rather than retrying until
green — a remaining flake is a result, not an obstacle.

**Verify**: 3 consecutive clean full-suite runs, each 1794 passed | 2 skipped.

### Step 6: Typecheck and lint

**Verify**: `npm run type:check` → exit 0; `npm run lint` → exit 0.

## Test plan

No new tests. This plan changes *how* tests run, so the verification is a strict
before/after equivalence check plus a stability check:

- **Equivalence**: same 183 collected files (`diff` of the sorted
  `vitest list --filesOnly` output), same 1794 passed / 2 skipped.
- **Stability**: 3 consecutive green full-suite runs (Step 5).
- **Performance**: report the `Duration` and `environment` figures before and
  after. Expect a large drop in `environment`; a *smaller* wall-clock drop is
  fine, but no drop at all in `environment` means the split did not take effect
  — treat that as a STOP condition.

## Done criteria

ALL must hold:

- [ ] `grep -c "projects" vitest.config.ts` → ≥ 1
- [ ] `grep -c "environmentMatchGlobs" vitest.config.ts` → 0
- [ ] `setupFiles` appears exactly once in `vitest.config.ts`, inside the `dom` project (not at root)
- [ ] `npx vitest list --filesOnly | wc -l` → **183**
- [ ] `diff <(sort /tmp/before-files.txt) <(sort /tmp/after-files.txt)` → no output
- [ ] `npx vitest run --project node` exits 0
- [ ] `npx vitest run --project dom` exits 0
- [ ] Three consecutive `npm run test` runs each exit 0 with **1794 passed | 2 skipped**
- [ ] `npm run type:check` exits 0
- [ ] `npm run lint` exits 0
- [ ] `git status` shows only `vitest.config.ts` modified (no test file edited)
- [ ] Before/after `Duration` + `environment` figures reported
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The collected file count is anything other than 183, or the `diff` in Step 2
  is non-empty. A changed file set means a glob is wrong, and silently dropping
  tests is far worse than a slow suite.
- The passing test count changes from 1794 in either direction. **More** passing
  is as suspicious as fewer — it would mean a file is being collected twice by
  both projects.
- A node test fails on a missing DOM global (`window is not defined`,
  `document is not defined`). The pre-flight search says this should not happen;
  if it does, report which file and which global. **Do not** move the file into
  the `dom` project or re-add `setupFiles` at root without reporting first —
  that would quietly undo the plan's benefit for that whole glob.
- You find yourself needing to edit any test file, `src/test/setup.ts`, or
  `testTimeout` to make this pass.
- The `environment` figure does not drop meaningfully — the projects are not
  taking effect, and a green run would be misleading.
- Any of the three Step 5 runs fails. Report the file and error.

## Maintenance notes

- **What a reviewer should scrutinise**: the union of the two `include` arrays
  against the original five globs, and that `setupFiles` is not at root. Those
  two mistakes both produce a green run that is quietly testing less.
- New test directories must now be added to the **correct project's** `include`,
  not to a single root list. A file matching neither project's globs runs
  nowhere and fails silently — the same trap `scripts/__tests__/` already sits
  in (it is outside every glob and has never run; deliberately left that way
  here, since fixing it is a separate decision about whether those tests should
  exist).
- If the timeout flakiness persists after this lands, the next lever is the
  `pool`/`poolOptions` concurrency (this is an 8GB machine), **not** raising
  `testTimeout`.
- CI (`.github/workflows/ci.yml`) calls `npm run test` and needs no change, but
  the job should get noticeably faster; if the 20-minute cap was ever a concern,
  re-check the margin after this lands.
