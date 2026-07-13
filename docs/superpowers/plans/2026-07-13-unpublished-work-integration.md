# Unpublished Work Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish and reconcile all confirmed unpublished Watheq work and leave one verified integration branch plus clean source worktrees.

**Architecture:** Apply source histories onto a fresh integration branch in dependency order, then port each dirty worktree as a separately reviewable commit. Preserve source branches and local-only settings as recovery points; resolve shared-file conflicts against current `main` behavior.

**Tech Stack:** Git, React 19, Vite 8, TypeScript, Tailwind CSS v4, Zustand, Vitest, Netlify Functions, Node.js.

## Global Constraints

- Do not add dependencies.
- Preserve anti-inflation scoring, no-fabrication rules, and `applied: true` semantics.
- Preserve English/Arabic localization parity.
- Do not publish `.claude/settings.local.json`.
- Do not discard or overwrite dirty-worktree changes.
- Run broad gates as separate commands; do not invoke `quality:parallel` in-agent.

---

### Task 1: Establish recovery points and integration baseline

**Files:**
- Create: `docs/superpowers/specs/2026-07-13-unpublished-work-integration-design.md`
- Create: `docs/superpowers/plans/2026-07-13-unpublished-work-integration.md`

**Interfaces:**
- Consumes: current `origin/main` and the five audited local source branches.
- Produces: remote recovery branches and `codex/integrate-unpublished-work` based on `origin/main`.

- [x] **Step 1: Push the five source branches with upstream tracking**

  Run `git push -u origin codex/optimize-page-pass1-pass2`, `git push -u origin codex/execute-vetted-plans`, `git push -u origin claude/feature-flags-system`, `git push -u origin codex/clarification-e2-e4`, and `git push -u origin fix/resume-parse-extraction-and-eval`.

- [x] **Step 2: Create the isolated integration branch**

  Run `git worktree add "C:\\Users\\NoteBook Pc\\.codex\\worktrees\\integrate-unpublished-work\\resume-customizer" -b codex/integrate-unpublished-work origin/main`.

- [ ] **Step 3: Verify the baseline**

  Run `npm run lint`, `npm run type:check`, and `npm run test -- --changed`. Expected: zero failures on unmodified `origin/main`.

- [ ] **Step 4: Commit the design and plan**

  Stage only the two documentation files and commit `Document unpublished work integration`.

### Task 2: Integrate published source histories

**Files:**
- Modify: files changed by `0940ece`, `6648827`, `705feaa`, `6adba36`, `5899e95`, and `3536043` after comparison with current `main`.
- Test: existing tests carried by those commits.

**Interfaces:**
- Consumes: remote source branches and current parser, Optimize, clarification, and feature-flag contracts.
- Produces: current-main-compatible hardening, clarification, parser, and feature-flag behavior.

- [ ] **Step 1: Apply vetted hardening**

  Cherry-pick `0940ece`, resolve against current `main`, and retain the already-included Optimize commits by applying `7b0a297` and `baebbd7` first when required by ancestry.

- [ ] **Step 2: Verify hardening and Optimize behavior**

  Run focused Optimize, API integration, cache, credit, referral, batch, and parsing-warning tests named by the changed files. Expected: zero failures.

- [ ] **Step 3: Apply clarification E2-E4**

  Cherry-pick `6648827`, `705feaa`, and `6adba36`; resolve `MainContent`, API, schemas, contracts, Truth Check, and analytics against current `main`.

- [ ] **Step 4: Verify clarification behavior**

  Run `MainContent`, clarification, API, AI-contract, and analytics clarification tests. Expected: zero failures.

- [ ] **Step 5: Reconcile parser/evaluation work**

  Compare `5899e95` file-by-file with current parser behavior. Port only behavior and fixtures not already superseded, retaining current `json_object`, token budget, deterministic recovery, and OCR contracts.

- [ ] **Step 6: Verify parser behavior**

  Run resume-text extraction, parser contracts, extraction API, parse-quality, and evaluation harness unit tests. Expected: zero failures.

- [ ] **Step 7: Apply the committed feature-flag system**

  Cherry-pick `3536043` and resolve `App`, `Header`, `MainContent`, and package scripts against current `main`.

- [ ] **Step 8: Verify feature flags**

  Run `DevFlagsPage`, registry, application navigation, header, and main-content tests. Expected: zero failures.

### Task 3: Recover seven dirty worktrees

**Files:**
- Modify: the exact tracked and untracked files reported by `git status --porcelain` in each dirty worktree.
- Test: every test file contained in those patches.

**Interfaces:**
- Consumes: seven dirty worktree patches and the integrated contracts from Task 2.
- Produces: one commit per meaningful bundle and named stashes preserving source-worktree state.

- [ ] **Step 1: Capture immutable patch manifests**

  Record each worktree path, branch or detached HEAD, status, binary-safe diff, and untracked-file list before modifying any source worktree.

- [ ] **Step 2: Integrate hard-stop suppression changes**

  Port the two-file detached patch from `b76e`, run `hard-stop-suppression.test.js`, and commit the recovered behavior.

- [ ] **Step 3: Integrate source-span evidence changes**

  Port the nine-file `gracious-cray-653c95` patch, reconcile it with Optimize redesign code, run AI-contract, optimize endpoint, and `OptimizationCard` tests, and commit.

- [ ] **Step 4: Integrate ATS explainability**

  Port the `lucid-aryabhata-77971e` product files while excluding `.claude/settings.local.json`, reconcile stores/types/locales/Match/Optimize, run its component and utility tests, and commit.

- [ ] **Step 5: Integrate job variants**

  Port the `unruffled-euler-5fada8` product files, reconcile `OptimizeSection`, resume store, and template types, run job-variant/store/Optimize tests, and commit.

- [ ] **Step 6: Integrate optimize-quality evaluation changes**

  Port `scripts/optimize-quality-eval.mjs` from `upbeat-mcnulty-cb0de9`, validate script syntax and relevant evaluation tests, and commit.

- [ ] **Step 7: Reconcile uncommitted feature-flag files**

  Compare `src/lib/featureFlags/` from `claude/musing-kilby-b211bd` with the committed feature-flag implementation. Merge unique behavior and tests, or document exact equivalence before omitting duplicate files.

- [ ] **Step 8: Preserve local-only settings**

  Create named stashes for `.claude/settings.local.json` changes in `great-cartwright-6851d8` and `lucid-aryabhata-77971e`; do not stage or publish them.

- [ ] **Step 9: Clean originating worktrees non-destructively**

  After each patch is represented by an integration commit, create a named stash containing the original dirty state. Verify `git status --porcelain` is empty in all seven worktrees.

### Task 4: Resolve integration-wide behavior and verification

**Files:**
- Modify: only files required to resolve cross-bundle test, type, lint, build, or localization failures.
- Test: affected focused suites plus the complete repository gates.

**Interfaces:**
- Consumes: all integrated commits from Tasks 2 and 3.
- Produces: one coherent, production-buildable Watheq branch.

- [ ] **Step 1: Run focused regression suites**

  Execute each focused suite named in Tasks 2 and 3. Diagnose and fix every failure at its source.

- [ ] **Step 2: Run lint**

  Run `npm run lint`. Expected: exit 0 with zero errors.

- [ ] **Step 3: Run TypeScript checks**

  Run `npm run type:check`. Expected: both application and Netlify TypeScript checks exit 0.

- [ ] **Step 4: Run the complete test suite**

  Run `npm run test`. Expected: zero failed test files and zero failed tests.

- [ ] **Step 5: Run production build and localization validation**

  Run `npm run build` and `npm run i18n:validate` separately. Expected: both exit 0.

- [ ] **Step 6: Check patch hygiene**

  Run `git diff --check origin/main...HEAD`. Expected: no whitespace errors.

### Task 5: Publish and merge the integrated result

**Files:**
- No additional source files unless required by final verification.

**Interfaces:**
- Consumes: verified `codex/integrate-unpublished-work`.
- Produces: pushed integration branch, GitHub PR, merged `main`, and a final clean-worktree audit.

- [ ] **Step 1: Push the integration branch**

  Run `git push -u origin codex/integrate-unpublished-work`.

- [ ] **Step 2: Open the integration PR**

  Create a draft PR targeting `main` with the recovered bundles, conflict decisions, and verification evidence.

- [ ] **Step 3: Merge after checks are green**

  Mark the PR ready and squash-merge it after required checks succeed; update local `main` from `origin/main`.

- [ ] **Step 4: Audit publication and worktree cleanliness**

  Verify all six published branches exist on GitHub, no intended local commit is absent from every remote ref, all seven source worktrees are clean, and each preserved local-only patch has a named stash.
