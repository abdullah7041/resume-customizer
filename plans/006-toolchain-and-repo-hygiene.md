# Plan 006: Toolchain and repo hygiene (dead prod dependency, tracked artifacts, honest pre-commit gate, env docs)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat baebbd7..HEAD -- package.json .gitignore pre-commit-check.sh .env.example`
> On any mismatch with the "Current state" excerpts, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `baebbd7`, 2026-07-08

## Why this matters

Five small, mechanical cleanups that each pay for themselves:

1. `@anthropic-ai/claude-code` is a production `dependency` of a React/Netlify app that never imports it — it pulls 8 per-platform binary sub-packages into every `npm install` and CI cache for nothing.
2. `eslint.json` (322 KB of generated ESLint report output) and `deno.lock` (stale — the runtime is Node, and the repo's own `cleanup` script deletes it) are tracked in git.
3. The pre-commit typecheck runs `bash -c 'tsc --noEmit'` — a full-repo check that is simultaneously slow (ignores the staged-file list) and incomplete (skips `netlify/tsconfig.json`, so backend type errors pass the hook).
4. `pre-commit-check.sh` is unwired dead weight that greps test output for a hardcoded `"371 passed"` (the suite is now ~90+ files) and greps lint output for `"0 errors"` (ESLint prints nothing on success) — it can only mislead.
5. `.env.example` omits two env vars the server actually reads (`SITE_URL`, `STRATEGIC_REALITY_CHECK_HASH_SECRET`) and advertises one nothing reads (`DEEPSEEK_API_KEY`).

Context that shapes decision 3: there is NO CI in this repo (`.github/workflows/` does not exist). The husky pre-commit hook is the only automated gate, so it should be complete rather than removed.

## Current state

Relevant files:

- `package.json` — dep at line 35: `"@anthropic-ai/claude-code": "^2.1.120"` under `dependencies`; `lint-staged` config at lines 114–119; `type:check` script at line 18: `"tsc --noEmit && tsc -p netlify/tsconfig.json --noEmit"`.
- `.gitignore` — already covers `*.log`, `.env*`; does NOT cover `eslint.json` or `deno.lock`.
- `pre-commit-check.sh` — 54-line unwired script; test step at lines 32–37 greps for `"371 passed"`; lint step at line 14 greps for `"0 errors"`. `.husky/pre-commit` runs only `npx lint-staged` (this script is referenced by nothing).
- `.env.example` — full contents known; "Optional Services" block at lines 25–33 includes `DEEPSEEK_API_KEY=your-deepseek-key` (line 26).

Excerpts as of commit `baebbd7`:

`package.json:114-119`:
```json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --fix",
    "bash -c 'tsc --noEmit'"
  ]
}
```

`pre-commit-check.sh:32-37`:
```bash
if npm run test 2>&1 | grep -q "371 passed"; then
  echo -e "${GREEN}✓ Tests passed (371/373)${NC}"
else
  echo -e "${RED}✗ Tests failed${NC}"
  exit 1
fi
```

Verification of claims you should re-run yourself before acting:
- `grep -rn "@anthropic-ai/claude-code" src/ netlify/ scripts/` → expected: no matches (only package.json / lockfiles reference it).
- `git ls-files | grep -E "^eslint\.json$|^deno\.lock$"` → expected: both listed.
- `grep -rn "DEEPSEEK_API_KEY" src/ netlify/ scripts/` → expected: no matches.
- `grep -rn "process.env.SITE_URL" netlify/` → expected: hits in `netlify/lib/openrouter-client.js` (~line 194) and `netlify/lib/openrouter-stream.js` (~line 83).
- `grep -rn "STRATEGIC_REALITY_CHECK_HASH_SECRET" netlify/` → expected: hit in `netlify/lib/strategic-reality-check.js` (~line 263).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Reinstall after dep removal | `npm install` | exit 0, lockfile updated |
| Typecheck | `npm run type:check` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Quick test sanity | `npm run test -- src/__tests__/Footer.test.tsx` | passes (cheap smoke that vitest still runs) |

## Scope

**In scope**:
- `package.json` + `package-lock.json` (dependency removal, lint-staged change)
- `.gitignore`
- `eslint.json`, `deno.lock` (untrack — `git rm --cached`, do not delete from disk unless untracked copies are unwanted; removing from index is sufficient)
- `pre-commit-check.sh` (delete)
- `.env.example`

**Out of scope**:
- `.husky/pre-commit` content beyond what lint-staged reads from package.json.
- Adding CI (worth doing, but a separate decision — note it, don't build it).
- Any source file under `src/` or `netlify/`.
- The other files the `cleanup` script mentions.

## Git workflow

- Branch: `advisor/006-toolchain-hygiene`
- One commit per numbered step is fine; short imperative subjects.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove the dead production dependency

1. Run the verification grep: `grep -rn "@anthropic-ai/claude-code" src/ netlify/ scripts/` → must be empty (STOP if not).
2. `npm uninstall @anthropic-ai/claude-code`

**Verify**: `grep -n "claude-code" package.json` → no match; `npm run type:check` → exit 0.

### Step 2: Untrack generated artifacts

```
git rm --cached eslint.json deno.lock
```
Append to `.gitignore`:
```
eslint.json
deno.lock
```

**Verify**: `git ls-files | grep -E "eslint\.json|deno\.lock"` → empty; `git check-ignore eslint.json deno.lock` → both printed.

### Step 3: Make the pre-commit typecheck complete

In `package.json`, change the lint-staged entry to run the repo's real typecheck (both tsconfigs):

```json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --fix",
    "bash -c 'npm run type:check'"
  ]
}
```

Note in the commit message that this makes commits slower but complete, and that the alternative (dropping typecheck from the hook) was rejected because no CI exists to catch what the hook misses. (`tsc --noEmit` cannot be scoped to staged files anyway — project-wide is inherent.)

**Verify**: `npx lint-staged --help` exits 0 (config parses); stage a trivial whitespace edit to any `.ts` file, run `npx lint-staged`, confirm both tsc projects run, then restore the file (`git checkout -- <file>`).

### Step 4: Delete the stale gate script

`git rm pre-commit-check.sh`

**Verify**: `grep -rn "pre-commit-check" .husky/ package.json docs/ CLAUDE.md AGENTS.md` → no live references (if a doc references it, remove that line too and include the doc in the commit).

### Step 5: True up .env.example

- Remove line 26 (`DEEPSEEK_API_KEY=your-deepseek-key`) after re-running its verification grep.
- Add under "Optional Services":

```
# OpenRouter HTTP-Referer attribution (openrouter-client.js / openrouter-stream.js)
SITE_URL=https://watheqai.app
# Salt for strategic-reality-check input hashing; unsalted fallback when unset
STRATEGIC_REALITY_CHECK_HASH_SECRET=change-me-in-production
```

(If Plan 005 already added `CRON_SECRET`/`BETA_ACCESS_CODES` here, keep them — the plans touch different lines of the same file.)

**Verify**: `grep -n "DEEPSEEK" .env.example` → empty; `grep -n "SITE_URL\|STRATEGIC_REALITY_CHECK_HASH_SECRET" .env.example` → both present.

## Test plan

No new tests — this plan touches no runtime source. The gate is: `npm run lint` exit 0, `npm run type:check` exit 0, and the vitest smoke command from the table passing after `npm install`.

## Done criteria

- [ ] `npm install` exits 0 and `package-lock.json` no longer contains `@anthropic-ai/claude-code`
- [ ] `git ls-files | grep -E "eslint\.json|deno\.lock"` → empty
- [ ] lint-staged runs `npm run type:check` (both tsconfigs) — verified once by a staged dry run
- [ ] `pre-commit-check.sh` deleted; no dangling references
- [ ] `.env.example` updated per Step 5
- [ ] `npm run lint` and `npm run type:check` exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 1's grep finds a real import/spawn of the claude-code package or binary.
- `npm uninstall` produces peer-dependency errors it cannot resolve cleanly.
- The lint-staged change makes commits fail on PRE-EXISTING type errors in `netlify/` — if `npm run type:check` is currently red on an untouched tree, report that instead of "fixing" unrelated type errors (that's someone else's regression to own).
- A doc (README/CLAUDE.md) turns out to instruct users to run `pre-commit-check.sh` as a required workflow — report before deleting.

## Maintenance notes

- The honest long-term fix for gate speed is CI (GitHub Actions running lint + type:check + vitest) so the local hook can shrink back to `eslint --fix` — recorded here as the natural follow-up, deliberately out of scope.
- Reviewer: the lint-staged change affects every future commit's latency on the dev machine; if it proves too slow in practice, the agreed fallback is reverting to root-only `tsc --noEmit` (accepting the netlify/ blind spot) until CI exists.
