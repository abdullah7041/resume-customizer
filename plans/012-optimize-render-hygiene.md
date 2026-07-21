# Plan 012: Stop whole-store re-renders in OptimizeSection and the remaining whole-store subscribers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- src/components/sections/OptimizeSection.tsx src/components/sections/optimize/JobGroupCard.tsx src/components/sections/TemplatesSection.tsx src/components/ui/FormattingPanel.tsx src/components/ui/ManualDataEditor.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

`OptimizeSection.tsx` (1655 lines — the app's central interactive surface) subscribes to the **entire** Zustand store with no selector, has **zero** `useCallback`, and renders the optimization queue through an unmemoized `JobGroupCard`. Consequence: every store write anywhere in the app (template selection, display options, variant switches) re-renders the whole section, and **every keystroke** in a card's refine-instruction textarea re-renders every card in the queue (the instruction is parent state passed to all cards). Three more heavy components subscribe whole-store the same way. The fix is the standard trio — per-field selectors, stable handlers, memoized list items — plus scoping the refine-instruction prop to the card being refined. All three parts are needed together: memoizing the card without stabilizing its props is a no-op.

## Current state

- `src/components/sections/OptimizeSection.tsx`:
  - `:230-246` — the whole-store subscription (verified):

    ```tsx
    const {
      originalResume,
      parsedResumeText,
      optimizations: storeOptimizations,
      setOptimizations,
      applyOptimization,
      revertOptimization,
      refineOptimization,
      keywordSuggestions,
      optimizationMetrics,
      setOptimizationMetrics,
      resetOptimizationMetrics,
      getCachedAnalysis,
      setCachedAnalysis,
      baselineMatchScore,
      variantRestoreNonce,
    } = useResumeStore();
    ```

  - `:271` — `const [refineInstruction, setRefineInstruction] = useState('');` (parent state, updated per keystroke; sibling refine state `refiningCardId`/`refineLoadingId`/`refineError` at `:270-273`).
  - `:1575-1598` — the queue render (verified): `filteredQueueGroups.map((group) => <JobGroupCard key={group.id} ... refineInstruction={refineInstruction} ... onToggleCard={toggleCard} onToggleCompare={handleToggleCompare} onApply={handleApplyOptimization} onRevert={revertOptimization} onApplyGroup={handleApplyQueueGroup} onCopy={onCopy} onStartRefine={handleStartRefine} onRefineInstructionChange={setRefineInstruction} onSubmitRefine={handleRefineBullet} />)`. None of the local handlers are `useCallback`-wrapped (grep confirms 0 `useCallback` in the file).
- `src/components/sections/optimize/JobGroupCard.tsx:53` — `export function JobGroupCard({ group, viewMode, expandedCards, compareMode, refiningCardId, refineInstruction, ... })` — plain function export, no `React.memo`.
- Remaining whole-store subscribers (verified):
  - `src/components/sections/TemplatesSection.tsx:~176-180` — destructures `getActiveResume`, `setSelectedTemplate: setStoreTemplate`, `displayOptions`, and more from `useResumeStore()`.
  - `src/components/ui/FormattingPanel.tsx:106` — `const { displayOptions, setDisplayOptions } = useResumeStore();`
  - `src/components/ui/ManualDataEditor.tsx:~52-56` — `originalResume, setOriginalResume, displayOptions, setDisplayOptions` from `useResumeStore()`.
- Repo selector convention (exemplar, verified): `src/components/Layout/MainContent.tsx:333` — `const hasParsedResume = useResumeStore((state) => Boolean(state.originalResume));`. There is currently **no** `useShallow` usage in `src/` — introduce it from `zustand/shallow` (zustand v5 is installed) only where a component needs an object of several fields; prefer plain per-field selectors otherwise.
- Zustand store: `src/lib/stores/resumeStore.ts`. Store **actions** (e.g. `applyOptimization`, `setOptimizations`) are stable references in zustand — selecting them individually never causes re-renders.
- Tests: `src/__tests__/` contains `OptimizeSection.test.jsx` (behavioral RTL) — the regression guard.

## Commands you will need

| Purpose   | Command                                                    | Expected on success |
|-----------|------------------------------------------------------------|---------------------|
| Focused tests | `npx vitest run src/__tests__/OptimizeSection.test.jsx` (adjust path via `git ls-files "*OptimizeSection.test*"`) | all pass |
| Related tests | `npx vitest run src/__tests__/` (scoped: TemplatesSection/Formatting/ManualDataEditor tests if present) | all pass |
| Typecheck | `npm run type:check`                                       | exit 0              |
| Lint      | `npm run lint`                                             | exit 0 (react-hooks rules validate deps arrays) |

## Scope

**In scope**:
- `src/components/sections/OptimizeSection.tsx`
- `src/components/sections/optimize/JobGroupCard.tsx`
- `src/components/sections/TemplatesSection.tsx`
- `src/components/ui/FormattingPanel.tsx`
- `src/components/ui/ManualDataEditor.tsx`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `src/lib/stores/resumeStore.ts` — no store shape changes; selectors only on the consumer side.
- Splitting/decomposing OptimizeSection (god-component finding, separate candidate) — this plan is render hygiene only.
- Any behavior, copy, or markup change.

## Git workflow

- Branch: `advisor/012-optimize-render-hygiene`
- Suggested commit: `perf(optimize): store selectors, stable handlers, memoized queue cards`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Convert OptimizeSection's subscription to selectors

Replace the `:230-246` destructure with individual selectors, one per field, following the MainContent exemplar:

```tsx
const originalResume = useResumeStore((s) => s.originalResume);
const parsedResumeText = useResumeStore((s) => s.parsedResumeText);
// ... one line per field, keeping the local alias names
//     (storeOptimizations for s.optimizations, etc.)
```

All 15 fields from the excerpt. Do not skip any — a missed field becomes an undefined-variable compile error, which is the safety net.

**Verify**: `npm run type:check` → exit 0; focused OptimizeSection tests pass.

### Step 2: Stabilize every handler passed to JobGroupCard

Wrap in `useCallback` (with correct dep arrays — let `npm run lint`'s react-hooks rule arbitrate): `toggleCard`, `handleToggleCompare`, `handleApplyOptimization`, `handleApplyQueueGroup`, `handleStartRefine`, `handleRefineBullet`, and `onCopy` if defined locally (if it's a prop, leave it — note it in the report). `revertOptimization` and `setRefineInstruction` are already stable (store action / setState) — pass as-is.

**Verify**: `npm run lint` → exit 0 (no react-hooks/exhaustive-deps warnings on the new callbacks); focused tests pass.

### Step 3: Scope the refine props to the active card

Currently `refineInstruction` (and `refineError`) go to every card, so each keystroke re-renders all of them even after memoization. In the `.map`, compute per group whether it contains the refining card, and pass neutral values otherwise:

```tsx
{filteredQueueGroups.map((group) => {
  const isRefiningHere = group.cards.some((c) => c.id === refiningCardId); // adapt to the real group shape
  return (
    <JobGroupCard
      ...
      refiningCardId={isRefiningHere ? refiningCardId : null}
      refineInstruction={isRefiningHere ? refineInstruction : ''}
      refineError={isRefiningHere ? refineError : null}
      refineLoadingId={isRefiningHere ? refineLoadingId : null}
      ...
    />
  );
})}
```

Read `JobGroupCard`'s prop usage first to confirm the group→cards shape (`group.cards` vs other field name) and that null/empty neutral values are safe (they are what a non-refining card already receives when nothing is being refined).

**Verify**: focused tests pass; manually reason: typing in a refine box must not change props of other groups.

### Step 4: Memoize JobGroupCard

In `JobGroupCard.tsx`, wrap the export: `export const JobGroupCard = React.memo(function JobGroupCard({ ... }) { ... });` — keep the named function for devtools. Check its remaining props for per-render-fresh references from the parent (`expandedCards` is a `Set` — confirm the parent only creates a new Set on actual toggle, which is standard `setState(new Set(...))`; that's fine since it changes exactly when it should).

**Verify**: `npm run type:check` && focused tests → pass.

### Step 5: Convert the three remaining whole-store subscribers

Same selector treatment as Step 1 for `TemplatesSection.tsx` (`:~176-180`), `FormattingPanel.tsx` (`:106`), `ManualDataEditor.tsx` (`:~52-56`). Small destructures → per-field selectors; no `useShallow` needed at these sites.

**Verify**: `npx vitest run src/__tests__/` (or the specific test files for these components found via `git ls-files "*.test.*" | grep -iE "templates|formatting|manualdata"`) → pass.

### Step 6: Full gate

**Verify**: `npm run lint` → exit 0; `npm run type:check` → exit 0; `npm run test` → all pass.

## Test plan

No new tests required — this is a behavior-preserving perf change guarded by the existing behavioral suites. Optional (nice-to-have, skip if the harness fights you): one render-count test using a probe component and `useResumeStore.setState` on an unrelated field, asserting JobGroupCard didn't re-render.

## Done criteria

- [ ] `grep -n "useResumeStore()" src/components/sections/OptimizeSection.tsx src/components/sections/TemplatesSection.tsx src/components/ui/FormattingPanel.tsx src/components/ui/ManualDataEditor.tsx` returns **no matches** (all selector-based)
- [ ] `grep -c "useCallback" src/components/sections/OptimizeSection.tsx` ≥ 6
- [ ] `grep -n "React.memo\|memo(" src/components/sections/optimize/JobGroupCard.tsx` shows the memoized export
- [ ] `npm run lint`, `npm run type:check`, `npm run test` all exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `:230-246` destructure has gained/lost fields vs the excerpt (drift) — re-derive the full list from the live code, and STOP only if any field's usage is unclear.
- A test fails after Step 3 in a way that suggests refine props ARE consumed by non-refining cards (the neutral-value assumption would be false).
- Fixing a react-hooks/exhaustive-deps warning would require restructuring an effect's logic (not just adding deps) — report which.

## Maintenance notes

- Reviewers: scrutinize the `useCallback` dep arrays — a stale-closure bug here is the main risk (lint's exhaustive-deps is the arbiter; no eslint-disable comments allowed).
- Future contributors adding props to `JobGroupCard` must keep them referentially stable or the memo silently degrades; a comment on the memoized export saying so is worth adding.
- The god-component decomposition of OptimizeSection/MainContent (candidates list) becomes easier after this — selectors document exactly which state each region consumes.
