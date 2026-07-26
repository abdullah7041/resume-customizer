# Post-Optimize UX Defects Design

Date: 2026-07-26
Status: Approved for implementation

## Goal

Repair the five reported post-optimize UX defects while preserving the existing score-truthfulness, anti-inflation, RTL, export, and persistence boundaries:

1. Restore genuine post-optimize score verification.
2. Feed the ATS explainability panel from the existing cached match analysis.
3. Make Job Variants saves visibly confirmable and resilient.
4. Prevent companion and Job Variants content from clipping at desktop and mobile widths.
5. Force resume previews and client-side PDF fallback exports to remain light/white.

## Scope and boundaries

The implementation stays in the frontend, Zustand store, local persistence, CSS, templates, and client export fallback. It does not change backend scoring, API contracts, schemas, the `afterScore` field, the score-utils improvement clamp, server PDF generation, DOCX color behavior, or the unfinished `hiddenMatches` server payload. The draggable template selector remains out of scope.

Existing unrelated changes in the user's main checkout are preserved by working on `codex/fix-post-optimize-ux` in the isolated worktree at `C:\Users\NoteBook Pc\.codex\worktrees\post-optimize-ux`.

## Design

### 1. Score verification lifecycle

`OptimizeSection.handleGenerateActual` will keep the parent-provided optimize path inside the verification lifecycle. Before awaiting `propOnOptimize`, it clears anomaly/retry state and merges `{ verifiedPotential: null, verifiedApplied: null }` into the store. After the parent handler has synchronously written the new cards, it reads the shared job description and the current baseline score, then calls `verifyOptimizedResume`. The verifier already reads fresh cards with `useResumeStore.getState()`, so it does not depend on a stale render closure.

The existing score model remains authoritative. With zero cards applied, a valid improved verification produces `verified_potential` and the existing “Potential with all suggestions … Verified” line. With applied cards, the verified delta supplies the projection when the generation estimate is zero. No code will change the `Math.max(0, ...)` clamp or `optimizationMetrics.afterScore`.

The newly reachable duplicate body below the prop path will be removed only after the restored path has been verified. `verifyOptimizedResume`, `retryVerifyOptimizedResume`, and `resolveAppliedSubsetScore` remain. This work is intentionally split into two commits: restore and verify first; dead-code removal second.

### 2. ATS explainability cache contract

`generateCacheKey` will normalize resume text and job description with `trim()` before hashing, while retaining the original/optimized discriminator. The Match flow will write its authoritative original-resume analysis with `forceIsOptimized: false`, matching the Optimize reader's explicit original-resume lookup even when the optimized view is active. The existing explainability panel and data source remain unchanged.

Regression coverage will write a whitespace-padded match result through the Match-side path and read it through the Optimize-side contract with `showOptimized: true`, asserting that the cached analysis is found.

### 3. Job Variants feedback and persistence

`JobVariantsBar` will use local `justSaved` state. After `updateVariant` succeeds, the action will show a temporary “Saved”/check treatment for approximately two seconds, then return to “Save changes”. The shared compatible-storage helper will be used for variant job-description reads and writes. The subtitle fallback will match the English and Arabic locale strings and clarify that changes apply to the selected variant; the button remains available only for an active variant.

The unused `renameVariant` action and type will be deleted. Variant snapshots will be capped at ten entries, matching the analysis-cache limit. The persistence layer will catch storage quota failures and emit the app's existing window event/toast seam so a failed save is visible instead of silently appearing to do nothing. The in-memory update remains local; only the persistence failure is surfaced.

Tests will cover the existing save/open/delete behavior, the missing active-variant update path, visible save confirmation, the ten-variant cap, and the storage-failure notification contract where the existing test seams permit it.

### 4. Responsive layout

The Optimize companion grid will use shrinkable `minmax(0, ...)` columns with a 16rem secondary column at desktop/tablet widths. Its toggle will wrap, shrink within its parent, and allow button labels to wrap/truncate. The existing overflow clipping remains unless these constraints prove insufficient because it supports the tier-glow effect. The existing sub-640px single-column collapse remains.

The Job Variants header will be allowed to wrap at narrow widths, and chip labels will use the available width instead of an unnecessarily tight fixed maximum. No fixed positioning is introduced, and any new positioning uses logical properties for RTL safety. Manual browser checks will cover 375, 640, 768, 1024, and 1280px, including both companion mounts.

### 5. Light preview and export

Each of the four allow-listed template roots will receive inline `backgroundColor: '#ffffff'`, `color: '#111827'`, and `colorScheme: 'light'` alongside the existing classes. A `[data-resume-preview]` CSS rule will declare a light color scheme and white background outside the print media block.

The client PDF fallback will clone the preview before mutation, run `forceLightThemeForPdf` on the captured clone, and pass `backgroundColor: '#ffffff'` to `toCanvas`. The server PDF path and DOCX export remain unchanged. Tests will assert that the fallback source contains the light-theme mutation and white canvas option, in addition to the existing server-path assertions.

## Verification

Implementation follows red-green-refactor for each behavior: add a focused regression test, confirm it fails for the expected missing behavior, implement the smallest fix, then rerun the focused suite. The required focused suites are:

- `src/lib/optimize/__tests__/`
- `src/components/sections/JobVariantsBar.test.tsx`
- `src/lib/stores/jobVariants.test.ts`
- `src/__tests__/TemplatesSection.test.jsx`
- `src/__tests__/matchAnalysisCache.test.ts`
- `src/__tests__/optimize-verify-integrity.test.jsx`
- `src/__tests__/bug-score-display.test.tsx`

The sequential repository legs are `npm run test -- --changed`, `npm run type:check`, and `npm run lint`; `quality:parallel` is not run in-agent. Manual E2E must confirm genuine verification, applied-score projection, verification reset, explainability in both view modes, variant save feedback/reload, responsive layout, and force-dark preview plus fallback PDF whiteness. The known isolated `extract-resume-json` provider timeout remains a pre-existing flake if encountered.

## Self-review

- No placeholders or unresolved choices remain; the attached implementation brief supplies the exact seam-level behavior.
- The score lifecycle, cache key, persistence, responsive, and export boundaries are consistent with one another.
- The design is limited to the five requested defects and explicitly preserves the brief's out-of-scope items.
