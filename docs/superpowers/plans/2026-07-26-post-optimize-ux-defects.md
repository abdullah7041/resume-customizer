# Post-Optimize UX Defects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the five reported post-optimize UX defects with truthful score verification, working explainability data, visible/resilient variant saves, unclipped responsive layout, and light preview/PDF output.

**Architecture:** Keep the existing Optimize score model and verification functions as the single source of score truth. Repair the parent-handler lifecycle and cache-key contract at their existing seams, use a local confirmation state plus the existing app window-event/toast seam for Job Variants, and enforce light theme at template roots, preview CSS, and the cloned client-export boundary.

**Tech Stack:** React 19, TypeScript, Zustand persist, Vitest, Testing Library, Tailwind CSS v4, CSS media queries, html-to-image, jsPDF, Netlify Functions for the unchanged server PDF path.

## Global Constraints

- Do not add dependencies.
- Do not change backend scoring, API contracts, schemas, `optimizationMetrics.afterScore`, or the `Math.max(0, ...)` improvement clamp.
- Keep the server PDF path, DOCX export, unfinished `hiddenMatches` payload, and draggable template selector out of scope.
- Use `@/` imports for `src/` imports and never introduce `any`.
- Preserve RTL behavior; use logical properties for any new positioning.
- Run focused tests first, then `npm run test -- --changed`, `npm run type:check`, and `npm run lint` sequentially. Do not run `quality:parallel` in-agent.
- Work only in `C:\Users\NoteBook Pc\.codex\worktrees\post-optimize-ux` on `codex/fix-post-optimize-ux`; preserve unrelated changes in the user's `main` checkout.

---

### Task 1: Restore post-optimize verification and prove score projection

**Files:**
- Modify: `src/components/sections/OptimizeSection.tsx:730-760`
- Test: `src/lib/optimize/__tests__/scoreModel.test.ts` or the existing score-model suite
- Verify: `src/__tests__/optimize-verify-integrity.test.jsx`, `src/__tests__/bug-score-display.test.tsx`

**Interfaces:**
- Consumes: `propOnOptimize`, `verifyOptimizedResume`, `useResumeStore.getState()`, `setOptimizationMetrics`, `LAST_JOB_KEY`.
- Produces: the prop-driven optimize path resets verification before awaiting the parent handler and calls verification after new cards are written; `buildScorePresentation` regression coverage proves `verified_potential` and applied-card projection behavior.

- [ ] **Step 1: Add the failing score-model regression test.**

Use a signature-matching `verifiedPotential` and actionable cards with a baseline score. Assert zero applied cards produce `displayState: 'verified_potential'` and a non-null `verifiedAllSuggestionsScore`; assert one applied card with `improvement: 0` produces a non-null `arrowTarget`.

```ts
it('uses a verified potential for zero-applied cards and projects applied cards from its delta', () => {
  const optimizations = [
    { sectionId: 'summary-0', sectionType: 'summary', original: 'before', optimized: 'after', applied: false },
  ] as const;
  const resumeText = 'Original resume text';
  const jobDescription = 'Target job description';
  const signature = verificationSignature(optimizations, resumeText, jobDescription);

  const potential = buildScorePresentation({
    optimizations,
    baselineScore: 60,
    improvement: 0,
    verifiedPotential: { score: 72, outcome: 'improved', signature },
    resumeText,
    jobDescription,
  });

  expect(potential.displayState).toBe('verified_potential');
  expect(potential.verifiedAllSuggestionsScore).toBe(72);

  const applied = buildScorePresentation({
    optimizations: [{ ...optimizations[0], applied: true }],
    baselineScore: 60,
    improvement: 0,
    verifiedPotential: { score: 72, outcome: 'improved', signature },
    resumeText,
    jobDescription,
  });

  expect(applied.arrowTarget).not.toBeNull();
});
```

- [ ] **Step 2: Run the score-model test and confirm it fails for the missing behavior.**

Run: `npm run test -- --run src/lib/optimize/__tests__/scoreModel.test.ts` (use the actual existing score-model filename if different).

Expected: the new assertion fails because `buildScorePresentation` currently receives a signature mismatch or does not project the applied subset with the supplied fixture. If the test passes immediately, correct the fixture so its signature matches the exact actionable card input instead of weakening the assertion.

- [ ] **Step 3: Implement the minimal parent-handler lifecycle repair.**

Replace only the `if (propOnOptimize)` block at the start of `handleGenerateActual` with:

```ts
if (propOnOptimize) {
  setVerifyAnomaly(null);
  setVerifyRetryUsed(false);
  setOptimizationMetrics({ verifiedPotential: null, verifiedApplied: null });

  const result = await propOnOptimize('auto', options);
  if (options?.freePreview) markFreePreviewUsed();

  const jobDescription = typeof window !== 'undefined'
    ? getCompatibleStorageItem(LAST_JOB_KEY) || ''
    : '';
  if (jobDescription.trim()) {
    const state = useResumeStore.getState();
    const beforeScore = state.baselineMatchScore
      ?? state.optimizationMetrics.beforeScore
      ?? resultsSummaryData.beforeScore;
    await verifyOptimizedResume(jobDescription, beforeScore, options);
  }
  return result;
}
```

Keep the reset before the `await`. Do not alter `verifyOptimizedResume`, `retryVerifyOptimizedResume`, `resolveAppliedSubsetScore`, `afterScore`, or `netlify/lib/score-utils.ts`.

- [ ] **Step 4: Run the focused score tests and confirm they pass.**

Run: `npm run test -- --run src/lib/optimize/__tests__ src/__tests__/optimize-verify-integrity.test.jsx src/__tests__/bug-score-display.test.tsx`.

Expected: all selected suites pass with the new score behavior and the existing source-grep guard still confirms `afterScore` is untouched.

- [ ] **Step 5: Commit the restored lifecycle separately.**

```bash
git add src/components/sections/OptimizeSection.tsx src/lib/optimize/__tests__
git commit -m "fix: restore post-optimize score verification"
```

This is commit 1 of the required two-commit score sequence.

### Task 2: Remove the now-unreachable OptimizeSection duplicate body

**Files:**
- Modify: `src/components/sections/OptimizeSection.tsx:756-1064` and imports/state used only by that body
- Verify: `src/__tests__/optimize-verify-integrity.test.jsx`, relevant OptimizeSection tests

**Interfaces:**
- Consumes: the restored `propOnOptimize` path and the existing standalone optimize path.
- Produces: one reachable verification lifecycle without dead duplicate generation code.

- [ ] **Step 1: Identify the exact duplicate range and its exclusive symbols.**

Compare the current `handleGenerateActual` body with the restored path. Remove only the block that was below the old prop-path early return, up to the existing `catch`, and remove imports/state variables only if `rtk rg` proves they have no remaining callers.

- [ ] **Step 2: Run the integrity test before editing to establish the current source contract.**

Run: `npm run test -- --run src/__tests__/optimize-verify-integrity.test.jsx`.

Expected: PASS on the existing integrity contract before the dead-code deletion.

- [ ] **Step 3: Delete the unreachable duplicate body without changing reachable verification helpers.**

Keep `verifyOptimizedResume`, `retryVerifyOptimizedResume`, and `resolveAppliedSubsetScore`. Do not remove any state used by the retry/applied-subset UI or the standalone non-prop generation path.

- [ ] **Step 4: Run the focused OptimizeSection suites.**

Run: `npm run test -- --run src/__tests__/OptimizeSection.test.jsx src/__tests__/optimize-zero-noise.test.jsx src/__tests__/recommendation-cards.test.jsx src/__tests__/optimize-verify-integrity.test.jsx`.

Expected: PASS with no dead-code source-contract regression.

- [ ] **Step 5: Commit the cleanup separately.**

```bash
git add src/components/sections/OptimizeSection.tsx
git commit -m "refactor: remove unreachable optimize generation path"
```

This is commit 2 of the required two-commit score sequence. The manual E2E checkpoint from the spec belongs between these commits when a live browser/provider environment is available; record it as manual verification if it cannot be run in this agent session.

### Task 3: Repair the ATS explainability cache contract

**Files:**
- Modify: `src/lib/stores/resumeStore.ts:99-103`
- Modify: `src/components/Layout/MainContent.tsx:1192`
- Test: `src/lib/stores/resumeStore.test.ts` or `src/__tests__/matchAnalysisCache.test.ts`

**Interfaces:**
- Consumes: `generateCacheKey`, `setCachedAnalysis`, `getCachedAnalysis`, `showOptimized`.
- Produces: original match analysis written with the original discriminator is retrievable by the Optimize reader after whitespace normalization and optimized-view toggling.

- [ ] **Step 1: Add a failing cache regression test.**

Use the real store actions. Set `showOptimized: true`, write a cached analysis with whitespace-padded resume/JD values and `forceIsOptimized: false`, then read using trimmed-equivalent values and the same explicit original discriminator. Assert the explainability fields survive.

```ts
it('retrieves original match analysis from the optimize reader after trimming and view changes', () => {
  const store = useResumeStore.getState();
  useResumeStore.setState({ showOptimized: true });
  store.setCachedAnalysis('  Resume text  ', '  Job description  ', {
    score: 64,
    matchedKeywords: ['React'],
    missingKeywords: ['Docker'],
    strategicRealityCheck: { summary: 'Evidence is mixed.' },
  }, false);

  expect(useResumeStore.getState().getCachedAnalysis('Resume text', 'Job description', false))
    .toMatchObject({ score: 64, matchedKeywords: ['React'], missingKeywords: ['Docker'] });
});
```

Adapt the `strategicRealityCheck` fixture to the repository's exact `CachedAnalysis` type if required; keep the assertion on the fields used by `AtsExplainabilityPanel`.

- [ ] **Step 2: Run the cache test and confirm the pre-fix failure.**

Run: `npm run test -- --run src/lib/stores/resumeStore.test.ts`.

Expected: FAIL because the current hash includes leading/trailing whitespace or the writer uses the current optimized-view discriminator.

- [ ] **Step 3: Normalize cache-key inputs and align the Match writer.**

In `generateCacheKey`, hash `(resumeText || '').trim()` and `(jobDescription || '').trim()` while retaining the `orig`/`opt` suffix. In the Match flow's `setCachedAnalysis` call, pass `false` as the fourth argument.

- [ ] **Step 4: Run the cache-focused suites.**

Run: `npm run test -- --run src/lib/stores/resumeStore.test.ts src/__tests__/matchAnalysisCache.test.ts src/__tests__/score-drift-bug.test.jsx`.

Expected: PASS, including existing cache expiry and score-drift coverage.

- [ ] **Step 5: Commit the cache repair.**

```bash
git add src/lib/stores/resumeStore.ts src/components/Layout/MainContent.tsx src/lib/stores/resumeStore.test.ts src/__tests__/matchAnalysisCache.test.ts
git commit -m "fix: align optimize explainability cache keys"
```

### Task 4: Make Job Variants saves visible, bounded, and failure-aware

**Files:**
- Modify: `src/components/sections/JobVariantsBar.tsx`
- Modify: `src/lib/stores/resumeStore.ts`
- Modify: `src/types/templates.ts`
- Modify: `src/components/Layout/MainContent.tsx` for the storage-error toast listener
- Modify: `src/locales/en/sections/optimize.json`
- Modify: `src/locales/ar/sections/optimize.json`
- Test: `src/components/sections/JobVariantsBar.test.tsx`
- Test: `src/lib/stores/jobVariants.test.ts`

**Interfaces:**
- Consumes: `updateVariant`, `saveCurrentAsVariant`, `getCompatibleStorageItem`, the existing `pushToast` callback and window-event pattern.
- Produces: `handleUpdateActive` visibly confirms a successful update; variant snapshots are limited to ten; storage quota failures dispatch a typed `watheq:storage-error` event consumed by MainContent; `renameVariant` no longer exists.

- [ ] **Step 1: Add failing component/store tests.**

Add a JobVariantsBar test that saves a variant, changes the active variant's store snapshot, clicks “Save changes”, and asserts the button changes to “Saved” while the store snapshot updates. Add a store test that saving 11 variants retains only the newest 10 and a test that the unused rename action/type is absent only after the implementation (do not test implementation details before the deletion).

```ts
it('confirms saving changes to the active variant', () => {
  const store = useResumeStore.getState();
  store.setOptimizations([sampleOpt]);
  const id = store.saveCurrentAsVariant('Variant A', 'JD A');
  store.setOptimizations([{ ...sampleOpt, optimized: 'updated', applied: false }]);

  render(<JobVariantsBar />);
  fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

  expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument();
  expect(useResumeStore.getState().jobVariants.find((variant) => variant.id === id)
    ?.snapshot.optimizations[0].optimized).toBe('updated');
});
```

- [ ] **Step 2: Run the new tests and confirm they fail.**

Run: `npm run test -- --run src/components/sections/JobVariantsBar.test.tsx src/lib/stores/jobVariants.test.ts`.

Expected: the component still says “Save changes” and the store retains all 11 variants.

- [ ] **Step 3: Implement the visible save state and compatible storage access.**

Add `justSaved` state and a two-second timeout using the existing window/global timer style. After `updateVariant(activeVariantId, readJobDescription())`, set `justSaved(true)` and schedule it back to `false`. Swap `Save` for `Check` and use the fallback copy from the locale JSON. Replace the raw `window.localStorage.setItem` in `handleOpen` with `setCompatibleStorageItem` and keep `getCompatibleStorageItem` for reads.

Use a wrapping header layout at narrow widths and remove the fixed `max-w-[16rem]` chip cap; retain `min-w-0` and truncation only where it prevents a chip from exceeding its available parent.

- [ ] **Step 4: Cap variants and remove the unused rename action.**

In both `saveCurrentAsVariant` and the state update that appends a new variant, retain only the newest ten entries. Delete `renameVariant` from the store implementation and `ResumeState` type. Do not change snapshot cloning or active-variant selection.

- [ ] **Step 5: Add the persistence failure event and toast consumer.**

Wrap the `resume-storage` persist adapter's `setItem` call in `try/catch`. On a quota/storage failure, keep the in-memory state but dispatch:

```ts
new CustomEvent('watheq:storage-error', {
  detail: { key: 'resume-storage', code: 'quota_exceeded' },
});
```

Add a MainContent effect that listens for this event and calls `pushToast` with a localized warning explaining that the variant could not be saved locally. Remove the listener on cleanup. Use a typed `CustomEvent` detail and no `any`.

- [ ] **Step 6: Align English and Arabic fallback copy.**

Make the hardcoded subtitle fallback match the existing locale values, including that the saved suggestions, applied changes, and scores belong to the selected job variant. Keep both locale files in sync with their current translations.

- [ ] **Step 7: Run the focused variant suites.**

Run: `npm run test -- --run src/components/sections/JobVariantsBar.test.tsx src/lib/stores/jobVariants.test.ts src/__tests__/MainContent.test.jsx`.

Expected: PASS, including visible update feedback, deep-clone behavior, deletion, cap, and MainContent toast listener coverage.

- [ ] **Step 8: Commit the variant repair.**

```bash
git add src/components/sections/JobVariantsBar.tsx src/lib/stores/resumeStore.ts src/types/templates.ts src/components/Layout/MainContent.tsx src/locales/en/sections/optimize.json src/locales/ar/sections/optimize.json src/components/sections/JobVariantsBar.test.tsx src/lib/stores/jobVariants.test.ts
git commit -m "fix: make job variant saves visible and bounded"
```

### Task 5: Stop companion and Job Variants clipping

**Files:**
- Modify: `src/index.css:.character-results--optimize`, `.character-results__toggle`, `.character-results__toggle button`
- Modify: `src/components/sections/JobVariantsBar.tsx` header/chip classes if Task 4's responsive check requires it
- Test: `src/__tests__/CharacterResultsCompanion.test.tsx` or a focused CSS contract test if the existing suite is source-contract based

**Interfaces:**
- Consumes: the existing in-flow companion mounts and HR Super Saud responsive ownership.
- Produces: readable companion toggles at desktop/tablet/mobile widths and readable Job Variants header/chips without fixed positioning.

- [ ] **Step 1: Add or extend the responsive contract test.**

Assert the CSS source includes `grid-template-columns: minmax(0, 1fr) minmax(0, 16rem)`, wrapping/shrink rules on the toggle, and no fixed positioning for the companion. Assert the Job Variants header can wrap and chips do not use the old fixed maximum.

- [ ] **Step 2: Run the responsive test and confirm it fails against the old declarations.**

Run: `npm run test -- --run src/__tests__/CharacterResultsCompanion.test.tsx src/components/sections/JobVariantsBar.test.tsx`.

Expected: FAIL on the old 14rem/min-content/no-wrap declarations or old chip class.

- [ ] **Step 3: Apply the smallest responsive CSS/class changes.**

Use:

```css
.character-results--optimize {
  grid-template-columns: minmax(0, 1fr) minmax(0, 16rem);
}

.character-results__toggle {
  flex-wrap: wrap;
  max-width: 100%;
  min-width: 0;
}

.character-results__toggle button {
  min-width: 0;
  overflow-wrap: anywhere;
}
```

Keep the existing `overflow: hidden` and sub-640px collapse unless browser measurement proves the tier glow cannot coexist with the new constraints. Make the Job Variants header `flex-wrap`/`min-w-0` aware and let chip labels use the available width.

- [ ] **Step 4: Run focused tests and inspect the source at all requested widths.**

Run: `npm run test -- --run src/__tests__/CharacterResultsCompanion.test.tsx src/components/sections/JobVariantsBar.test.tsx`.

Manual widths: 375, 640, 768, 1024, and 1280px, on both companion mounts. Confirm no `position: fixed` was introduced.

- [ ] **Step 5: Commit the layout repair.**

```bash
git add src/index.css src/components/sections/JobVariantsBar.tsx src/__tests__/CharacterResultsCompanion.test.tsx
git commit -m "fix: prevent post-optimize controls from clipping"
```

### Task 6: Force light resume preview and client PDF fallback

**Files:**
- Modify: `src/components/templates/ModernProfessional.tsx`
- Modify: `src/components/templates/ExecutiveProfessional.tsx`
- Modify: `src/components/templates/TechnicalEngineer.tsx`
- Modify: `src/components/templates/ATSOptimized.tsx`
- Modify: `src/index.css` outside the print media block
- Modify: `src/components/sections/TemplatesSection.tsx` fallback capture
- Test: `src/__tests__/TemplatesSection.test.jsx`

**Interfaces:**
- Consumes: `forceLightThemeForPdf`, `[data-resume-preview]`, `toCanvas`.
- Produces: all allow-listed template roots remain white/light in preview and fallback raster export under app dark mode or browser force-dark.

- [ ] **Step 1: Add failing source-contract assertions for the fallback.**

Extend `TemplatesSection.test.jsx` to read `TemplatesSection.tsx` and assert that the fallback path calls `forceLightThemeForPdf` on a clone/captured root and passes `backgroundColor: '#ffffff'` to `toCanvas`. Keep the existing server-path light-theme test.

```js
it('forces the client PDF fallback capture to light theme with a white canvas', () => {
  expect(templatesSection).toMatch(/forceLightThemeForPdf\(.*(?:clone|previewElement)/s);
  expect(templatesSection).toContain("backgroundColor: '#ffffff'");
});
```

- [ ] **Step 2: Run the template test and confirm the new assertion fails.**

Run: `npm run test -- --run src/__tests__/TemplatesSection.test.jsx`.

Expected: FAIL because the fallback currently captures the live preview without calling `forceLightThemeForPdf` or passing a white background.

- [ ] **Step 3: Add light inline styles to the four template roots and preview CSS.**

Add to each root style object:

```tsx
backgroundColor: '#ffffff',
color: '#111827',
colorScheme: 'light',
```

Add outside `@media print`:

```css
[data-resume-preview] {
  color-scheme: light;
  background-color: #fff;
}
```

- [ ] **Step 4: Force light theme on the fallback clone and canvas.**

Clone `[data-resume-preview]` before fallback mutations, append/use the clone for capture, call `forceLightThemeForPdf(clone)`, and pass `backgroundColor: '#ffffff'` to `toCanvas`. Restore/remove the clone and any temporary hidden nodes in `finally`-safe cleanup so a failed fallback does not leave the live preview mutated.

- [ ] **Step 5: Run focused template/export tests.**

Run: `npm run test -- --run src/__tests__/TemplatesSection.test.jsx src/__tests__/primary-button-style.test.ts`.

Expected: PASS with the existing server light-theme assertions and the new fallback contract.

- [ ] **Step 6: Commit the light-theme repair.**

```bash
git add src/components/templates/ModernProfessional.tsx src/components/templates/ExecutiveProfessional.tsx src/components/templates/TechnicalEngineer.tsx src/components/templates/ATSOptimized.tsx src/index.css src/components/sections/TemplatesSection.tsx src/__tests__/TemplatesSection.test.jsx
git commit -m "fix: keep resume preview and fallback PDF light"
```

### Task 7: Full focused verification and handoff

**Files:**
- Verify: all files changed by Tasks 1–6

- [ ] **Step 1: Run the explicitly requested focused suites together.**

Run:

```bash
npm run test -- --run src/lib/optimize/__tests__ src/components/sections/JobVariantsBar.test.tsx src/lib/stores/jobVariants.test.ts src/__tests__/TemplatesSection.test.jsx src/__tests__/matchAnalysisCache.test.ts src/__tests__/optimize-verify-integrity.test.jsx src/__tests__/bug-score-display.test.tsx
```

Expected: zero failures. If the known `extract-resume-json` provider timeout appears only in a parallel broader run, report it as the documented pre-existing flake and verify it in isolation if needed.

- [ ] **Step 2: Run the changed-test gate.**

Run: `npm run test -- --changed`.

Expected: zero failures or an explicitly documented pre-existing failure.

- [ ] **Step 3: Run type-check.**

Run: `npm run type:check`.

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 4: Run lint.**

Run: `npm run lint`.

Expected: exit 0 with no lint errors.

- [ ] **Step 5: Run manual E2E where the environment permits.**

Use `npm run dev` on port 5173. Confirm: verified potential after optimize with zero applied cards; numeric arrow after applying cards; verified-score reset on rerun; ATS buckets with whitespace-padded JD and optimized view; visible variant save confirmation and reload survival; companion/variant readability at 375/640/768/1024/1280; white preview under dark/force-dark; and white fallback PDF after exercising the documented server-fallback path. Do not ship the temporary forced error used to exercise fallback.

- [ ] **Step 6: Check the final diff and worktree.**

Run: `git diff --check`, `git status --short --branch`, and `git log --oneline --decorate -8`.

Expected: only the design/plan docs and intentional implementation commits are present on `codex/fix-post-optimize-ux`; no unrelated files are changed.
