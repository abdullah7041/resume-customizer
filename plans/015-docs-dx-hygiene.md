# Plan 015: Docs & DX hygiene — setup docs, env docs, drift fixes, repo litter

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- README.md .env.example CLAUDE.md docs/ MATCH_PAGE_SPEC.md OPTIMIZE_PAGE_SPEC.md outputs/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs + dx
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

This repo is operated primarily by AI agents reading its docs; doc drift here converts directly into wasted agent runs. Current drift: README has **no setup section** at all; `.env.example` omits real runtime toggles; CLAUDE.md's Netlify-function inventory lists 10 of ~25 functions; the job-variant ADR cites a design doc that was deleted; two completed AI work-orders sit at repo root named like living specs; a known dev-machine OOM workaround exists only in one agent's private memory; and a generated one-off HTML report is committed. Each fix is small; together they make the repo tell the truth to its next reader.

## Current state

- `README.md` (165 lines) — covers product/license/architecture/privacy; never mentions `npm install`, `.env`, or any dev script.
- `.env.example` (39 lines) — missing env vars that code actually reads (names verified by grep across `netlify/` and `scripts/`): `ALLOW_CELEBRATION_BONUS`, `ALLOW_DEV_RESET`, `WATHEQ_AI_ENABLE_MODEL_OVERRIDES`, `WATHEQ_AI_MODEL_OVERRIDE_FLASH`, `WATHEQ_AI_MODEL_OVERRIDE_LITE`, `WATHEQ_AI_MODEL_OVERRIDE_OPTIMIZE`. Also `.env.example:14` documents `VITE_SUPABASE_REDIRECT_URL`, which has **no** `import.meta.env` reader in `src/` (grep-negative — needs confirm-then-remove or re-wire note).
- `CLAUDE.md` "Key File Locations" — lists functions as "parse-resume, extract-resume-json, ai-match, optimize, predict-questions, generate-cover-letter, generate-pdf, batch-api, user-data-api, referral-api"; actual `netlify/functions/` has ~25 (missing: optimize-stream, import-job-url, extract-job-metadata, onboard-extract, generate-clarifications, refine-bullet, resume-truth-check, vision2030-alignment, feedback-api, notify-waitlist, waitlist-confirm, cron-monthly-summary, cron-reset-credits, dev-*).
- `CLAUDE.md` "Commands" section lists `npm run dev:netlify` with no caveat. Known reality (from agent memory, verified against `netlify.toml:30`'s comment about low-RAM bundling): `dev:netlify` OOMs esbuild on 8GB machines; functions are tested via `tsx` handler harnesses instead.
- `docs/adr/ADR-job-specific-resume-builder.md:5` — "**Related:** `docs/WATHEQ_ENGINEERING_PLAN.md` §5.1 (persistence/retention)" + §1/§5 references. That file was **deleted** in commit `dee2ee3`; `ls docs/WATHEQ_ENGINEERING_PLAN.md` → No such file (verified). The ADR's §5 storage/retention section itself restates the constraints, so the fix is reference repair, not content recovery.
- Root `OPTIMIZE_PAGE_SPEC.md` — opens "Copy into repo root as `OPTIMIZE_PAGE_SPEC.md`… Two passes, shipped separately" (verified) — a completed one-shot work order; its Pass 1a (fraction-guard in `normalizeScore`) verifiably shipped (`netlify/lib/score-utils.ts`). `MATCH_PAGE_SPEC.md` — same shape ("Match page redesign spec", cites `MatchSection.tsx (918 lines)`).
- `outputs/first-customer-finder-watheq-2026-07-14.html` — git-TRACKED generated report (verified via `git ls-files`); `outputs/` is not in `.gitignore`.
- `docs/archive/` exists (contains e.g. `HOW_SCORING_WORKS.md`) — the destination convention for completed docs.
- NOT in this plan (maintainer decisions, listed as candidates in `plans/README.md`): de-duplicating the diverged `.agents/skills/` vs `.claude/skills/` trees; deleting the caller-less `batch-api` surface.

## Commands you will need

| Purpose   | Command                | Expected on success |
|-----------|------------------------|---------------------|
| Docs-only check | `git diff --check` | no whitespace errors |
| i18n untouched sanity | `npm run lint` | exit 0 (only if any code file was touched — otherwise skip) |

## Scope

**In scope**:
- `README.md`, `.env.example`, `CLAUDE.md`
- `docs/adr/ADR-job-specific-resume-builder.md` (reference lines only)
- `MATCH_PAGE_SPEC.md`, `OPTIMIZE_PAGE_SPEC.md` (move to `docs/archive/`)
- `outputs/` (git rm the tracked file), `.gitignore` (add `outputs/`)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Any source code, any test, any skill tree (`.agents/`, `.claude/`), `AGENTS.md`.
- ADR content/decision sections — only the dangling "Related:" references.
- Deleting `MATCH/OPTIMIZE_PAGE_SPEC.md` outright — archive, don't destroy.

## Git workflow

- Branch: `advisor/015-docs-dx-hygiene`
- Suggested commit: `docs: setup section, env toggle docs, de-drift CLAUDE.md, archive completed specs`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: README development section

Add a `## Development` section after the architecture overview: Node 20 (`netlify.toml` pins `NODE_VERSION = "20"`), `npm install`, `cp .env.example .env` (+ one line: fill Supabase/OpenRouter keys — never commit `.env`), `npm run dev` for UI-only work vs `npm run dev:netlify` for functions (with the low-RAM caveat from Step 3), `npm run test` / `npm run lint` / `npm run type:check`. Keep it under ~25 lines; match README's existing heading style.

**Verify**: `git diff --check` → clean.

### Step 2: .env.example completeness

Append a commented "Dev/override toggles (optional)" block listing the six missing vars by NAME with one-line purpose each and safe defaults (empty/false). **Never include a real value.** For `VITE_SUPABASE_REDIRECT_URL`: grep `src/` and `netlify/` one more time; if still reader-less, delete the line and note the removal in the commit body; if a reader exists, leave it and correct this plan's report.

**Verify**: `grep -c "WATHEQ_AI_MODEL_OVERRIDE" .env.example` → ≥3; no value after any `=` you added beyond placeholders.

### Step 3: CLAUDE.md de-drift

- Commands section: annotate `npm run dev:netlify` with: "OOMs esbuild on low-RAM (~8GB) machines — test functions via a `tsx` handler harness instead (see `netlify.toml` per-function `external_node_modules` note)."
- Key File Locations: replace the 10-name function list with grouped, drift-resistant phrasing, e.g.: "`netlify/functions/` — ~25 functions; groups: parsing (parse-resume, extract-resume-json, onboard-extract), match/optimize (ai-match, optimize, optimize-stream, refine-bullet, resume-truth-check, vision2030-alignment), job import (import-job-url, extract-job-metadata), generation (generate-cover-letter, generate-pdf, predict-questions, generate-clarifications), accounts/growth (user-data-api, referral-api, feedback-api, batch-api, notify-waitlist, waitlist-confirm), scheduled (cron-monthly-summary, cron-reset-credits), dev-*". Verify the list against `ls netlify/functions/` at execution time — do not trust this plan's enumeration blindly.

**Verify**: every function name you wrote exists: for each name `N`, `test -f netlify/functions/N.ts` (script a loop) → all exist.

### Step 4: ADR reference repair

In the ADR, replace both references to `docs/WATHEQ_ENGINEERING_PLAN.md` (the `Related:` line and any `§5.1` body citations — grep `WATHEQ_ENGINEERING_PLAN` in the file) with: "engineering plan §5.1 (deleted in `dee2ee3`; its persistence/retention constraints are restated in §5 of this ADR)". Do not alter any decision content.

**Verify**: `grep -c "WATHEQ_ENGINEERING_PLAN.md`" docs/adr/ADR-job-specific-resume-builder.md` → 0 (references to the deleted path now carry the tombstone note instead of implying the file exists).

### Step 5: Archive the completed specs

`git mv MATCH_PAGE_SPEC.md docs/archive/MATCH_PAGE_SPEC.md` and same for `OPTIMIZE_PAGE_SPEC.md`. Prepend to each: `> **Status: completed work order (archived 2026-07-21).** This described a one-shot redesign task, since shipped; line numbers within are stale. It is not a living spec of the page.` Then grep the repo for inbound references to the old root paths (`grep -rn "PAGE_SPEC" --include="*.md" --include="*.ts" --include="*.tsx" .` excluding `.git`, `node_modules`, `.worktrees`) and update any found.

**Verify**: `test -f MATCH_PAGE_SPEC.md` → absent at root; both present under `docs/archive/` with the banner; inbound-reference grep → no stale root paths.

### Step 6: Untrack the generated report

`git rm outputs/first-customer-finder-watheq-2026-07-14.html` and add `outputs/` to `.gitignore`. (Local file removal is fine — it's a generated one-off; if the maintainer wants it, it survives in git history.)

**Verify**: `git ls-files outputs/` → empty; `grep -n "^outputs/" .gitignore` → present.

## Test plan

Docs-only change → per CLAUDE.md's own quality-matching rule: `git diff --check`, no test run. Step 3's function-name existence loop is the only scripted verification.

## Done criteria

- [ ] README has a Development section with install/env/dev/test commands
- [ ] `.env.example` documents the six toggles (names only); redirect-URL line resolved either way
- [ ] CLAUDE.md: dev:netlify caveat present; function inventory current (all named files exist)
- [ ] ADR: zero implied-live references to the deleted plan doc
- [ ] PAGE_SPECs archived with status banners; no stale inbound references
- [ ] `git ls-files outputs/` empty; `outputs/` ignored
- [ ] `git diff --check` clean
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `WATHEQ_ENGINEERING_PLAN.md` turns out to exist somewhere else under `docs/` (search first) — then fix the path instead of tombstoning.
- Any inbound reference to the PAGE_SPEC root paths is from code (not docs) — report it; moving the file would break something at runtime.
- CLAUDE.md's structure around the sections you're editing has materially changed (it's actively maintained — merge conflicts with the maintainer's own edits are the risk; keep your diff minimal and additive).

## Maintenance notes

- CLAUDE.md is the highest-value doc in the repo for agent throughput — future feature PRs should update its inventory lines as part of the PR, which reviewers should start checking.
- The `.agents/skills` vs `.claude/skills` divergence and the caller-less `batch-api` surface remain open maintainer decisions (candidates in `plans/README.md`).
