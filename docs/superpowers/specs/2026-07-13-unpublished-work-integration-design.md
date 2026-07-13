# Unpublished Work Integration Design

## Objective

Publish the five confirmed local-only branches, recover every meaningful change from the seven dirty worktrees, reconcile overlapping implementations on top of current `origin/main`, verify the combined application, and publish one integration branch without losing user work.

## Integration Topology

`codex/integrate-unpublished-work` is based on current `origin/main`. Source branches remain intact on GitHub as immutable recovery points. Their changes are applied to the integration branch in dependency order rather than merged wholesale, because several branches are based on obsolete histories and contain overlapping commits.

The integration order is:

1. Vetted hardening bundle, which already contains the two Optimize score/review commits.
2. Clarification E2-E4 persistence, Truth Check propagation, and analytics.
3. Resume extraction/evaluation work, reconciled against the newer parser currently on `main`.
4. Feature-flag system, reconciled with the uncommitted feature-flag directory.
5. Dirty worktree bundles: hard-stop suppression, source-span evidence, ATS explainability, job variants, and optimize quality evaluation.

## Dirty Worktree Policy

Each dirty worktree is captured before integration. Product code, tests, localization, documentation, and evaluation assets are ported to the integration branch. `.claude/settings.local.json` is local machine configuration: it is preserved in a named stash and excluded from published source.

After a dirty bundle is committed on the integration branch, the originating worktree is cleaned only by a non-destructive operation: either its tracked patch is preserved in the integration commit and then stashed, or its local-only settings are stashed directly. No user change is discarded.

## Conflict Resolution

Conflicts are resolved against the current behavior on `main`, retaining both feature intents when they are compatible. The current parser contracts, scoring anti-inflation rules, no-fabrication requirements, Arabic/English parity, and `applied: true` optimization semantics remain authoritative.

Overlapping `OptimizeSection`, `MainContent`, types, locale, and feature-flag files are integrated at the behavior level. Tests from every source bundle are retained and updated only when the current public contract has intentionally changed.

## Verification

Each recovered bundle receives its focused Vitest coverage before the next bundle is added. The completed integration must pass, separately:

- `npm run lint`
- `npm run type:check`
- `npm run test`
- `npm run build`
- `npm run i18n:validate`
- `git diff --check origin/main...HEAD`

Completion also requires remote verification of the five source branches and the integration branch, plus a final audit proving every registered worktree is clean or has only an explicitly preserved named stash.

