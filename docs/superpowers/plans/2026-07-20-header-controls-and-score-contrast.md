# Header Controls and Optimize Score Contrast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Optimize score projection readable in light mode and expose theme and language controls directly in desktop and mobile header bars without menu duplicates.

**Architecture:** Keep theme and language state in their existing hooks/components. Add a compact rendering option to `LanguageSwitcher`, compose the existing controls directly into the responsive Header action rows, and remove menu copies. Restrict the contrast repair to `ScoreDiffBreakdown` semantic Tailwind classes so score behavior and global tokens do not change.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest, Testing Library, react-i18next.

## Global Constraints

- Do not add dependencies.
- Do not change score calculations, Optimize copy, or analytics.
- Preserve English/Arabic switching, RTL layout, dark mode, account-menu portal positioning, credits, authentication, and marketing navigation behavior.
- Keep mobile interactive targets at least 44 by 44 pixels.
- Do not stage or modify `.claude/settings.local.json`.

## File Map

- `src/components/ui/LanguageSwitcher.tsx`: support full desktop and compact icon-sized mobile presentation through one control implementation.
- `src/components/Layout/Header.tsx`: place both controls in desktop/mobile header rows and remove account/mobile-menu duplicates.
- `src/components/ScoreDiffBreakdown.tsx`: add paired light/dark semantic colors to the projection and expanded rows.
- `src/__tests__/LanguageSwitcher.test.tsx`: cover compact accessibility and visual contract.
- `src/__tests__/Header.feedback.test.tsx`: cover direct header placement and absence from opened menus.
- `src/__tests__/ScoreDiffBreakdown.test.tsx`: cover light/dark contrast class contract.

---

### Task 1: Compact Language Control

**Files:**
- Create: `src/__tests__/LanguageSwitcher.test.tsx`
- Modify: `src/components/ui/LanguageSwitcher.tsx`

**Interfaces:**
- Consumes: `useDirection(): { currentLanguage: string; toggleLanguage(): void }` and `useTranslation()`.
- Produces: `LanguageSwitcher({ compact?: boolean }): JSX.Element`; `compact` defaults to `false`.

- [ ] **Step 1: Write the failing compact-mode test**

```tsx
render(<LanguageSwitcher compact />);
const button = screen.getByRole('button', { name: 'Language' });
expect(button).toHaveClass('h-11', 'w-11', 'min-h-[44px]', 'min-w-[44px]');
expect(screen.getByText('العربية')).toHaveClass('sr-only');
```

Mock `useDirection` with `currentLanguage: 'en'` and a `toggleLanguage` spy, then click the button and assert the spy is called once. Add a second test proving the default label is visible and the default button does not use the compact width class.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test -- src/__tests__/LanguageSwitcher.test.tsx`

Expected: FAIL because `LanguageSwitcher` does not accept `compact` and does not render compact classes.

- [ ] **Step 3: Implement the minimal compact API**

```tsx
interface LanguageSwitcherProps {
  compact?: boolean;
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  // existing hooks
  return (
    <button className={cn(baseClasses, compact ? 'h-11 w-11 min-h-[44px] min-w-[44px] justify-center p-0' : 'gap-2 px-3 py-2')}>
      <Globe className="h-4 w-4 text-gray-600 dark:text-gray-300" />
      <span className={compact ? 'sr-only' : undefined}>{currentLanguage === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  );
}
```

Import `cn` from `@/lib/utils/cn`; retain the existing click handler, accessible name, colors, press scale, and focus behavior.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test -- src/__tests__/LanguageSwitcher.test.tsx`

Expected: both tests PASS.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- src/components/ui/LanguageSwitcher.tsx src/__tests__/LanguageSwitcher.test.tsx
git commit -m "feat(header): add compact language control"
```

---

### Task 2: Direct Header Controls and Menu Deduplication

**Files:**
- Modify: `src/__tests__/Header.feedback.test.tsx`
- Modify: `src/components/Layout/Header.tsx`

**Interfaces:**
- Consumes: `LanguageSwitcher({ compact?: boolean })` from Task 1 and existing `[theme, toggleTheme]` from `useTheme()`.
- Produces: exactly one responsive theme control and one responsive language control visible in each header layout; neither opened menu contains either control.

- [ ] **Step 1: Write failing header placement tests**

Update the language mock so it exposes its mode:

```tsx
LanguageSwitcher: ({ compact = false }: { compact?: boolean }) => (
  <button type="button" aria-label="Language" data-compact={String(compact)}>Language</button>
),
```

For a signed-in render, assert the document contains one full and one compact language control. Open the account menu and assert:

```tsx
expect(within(screen.getByRole('menu')).queryByRole('button', { name: 'Language' })).not.toBeInTheDocument();
expect(within(screen.getByRole('menu')).queryByRole('button', { name: 'Toggle theme' })).not.toBeInTheDocument();
```

Open the mobile navigation dialog in a separate render and make the same two negative assertions with `within(dialog)`. Assert the direct compact language and theme buttons remain outside the dialog.

- [ ] **Step 2: Run the Header test and verify RED**

Run: `npm run test -- src/__tests__/Header.feedback.test.tsx`

Expected: FAIL because language/theme still appear inside menus and signed-in language is not yet in the desktop bar.

- [ ] **Step 3: Implement direct controls and remove duplicates**

In the signed-in desktop action row, render `<LanguageSwitcher />` immediately after the existing theme button. Delete the language section and theme menu item from the account-menu portal.

In the mobile header action row, render the existing 44-pixel theme button and `<LanguageSwitcher compact />` before the hamburger. Keep the credits control accessible and use responsive flex sizing plus a narrow signed-in brand treatment so the controls do not overlap at 320 to 430 pixels. Delete the theme button from the mobile panel header and delete its language section from mobile panel content. Keep the close button and all account/navigation actions unchanged.

- [ ] **Step 4: Run Header and Arabic workspace tests and verify GREEN**

Run: `npm run test -- src/__tests__/Header.feedback.test.tsx src/__tests__/arabic-workspace-localization.test.tsx`

Expected: all tests PASS; account portal and Arabic localization assertions remain intact.

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- src/components/Layout/Header.tsx src/__tests__/Header.feedback.test.tsx
git commit -m "fix(header): move theme and language out of menus"
```

---

### Task 3: Light-Mode Score Projection Contrast

**Files:**
- Modify: `src/__tests__/ScoreDiffBreakdown.test.tsx`
- Modify: `src/components/ScoreDiffBreakdown.tsx`

**Interfaces:**
- Consumes: existing `ScorePresentation`, `OptimizationResult[]`, and translations.
- Produces: the same DOM/content behavior with explicit readable light-mode and preserved dark-mode colors.

- [ ] **Step 1: Write the failing contrast regression test**

Render the default breakdown and assert the outer card and title have paired theme classes:

```tsx
const title = screen.getByRole('heading', { name: 'sections.optimize.scoreDiff.title' });
expect(title).toHaveClass('text-slate-900', 'dark:text-white');
expect(title.closest('[data-score-diff]')).toHaveClass('bg-white/80', 'dark:bg-white/[0.03]');
```

Expand the card and assert a section label uses `text-slate-800 dark:text-gray-200` and an explanatory row uses a readable light slate with its dark override.

- [ ] **Step 2: Run the ScoreDiff test and verify RED**

Run: `npm run test -- src/__tests__/ScoreDiffBreakdown.test.tsx`

Expected: FAIL because the current component uses `text-white`, pale accents, and translucent white surfaces without light-mode overrides.

- [ ] **Step 3: Implement semantic paired colors**

Add `data-score-diff` to the outer card. Use `bg-white/80 border-slate-200/80 text-slate-700` defaults and retain current dark values behind `dark:` variants. Change headings and numeric scores to dark slate in light mode; use darker emerald/amber badge, target, status, and link colors in light mode; use slate-600/700 for supporting copy; and give expanded rows `bg-slate-50/80 dark:bg-white/[0.03]`. Do not change conditionals, translations, counts, score values, analytics, or layout.

- [ ] **Step 4: Run the ScoreDiff and light-mode guard tests and verify GREEN**

Run: `npm run test -- src/__tests__/ScoreDiffBreakdown.test.tsx src/__tests__/light-mode-contrast.test.ts`

Expected: all tests PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add -- src/components/ScoreDiffBreakdown.tsx src/__tests__/ScoreDiffBreakdown.test.tsx
git commit -m "fix(optimize): restore score projection contrast"
```

---

### Task 4: Integrated Verification, Review, and Publish

**Files:**
- Verify all files changed by Tasks 1 through 3.

**Interfaces:**
- Consumes: completed component and test changes.
- Produces: reviewed, committed, remotely verified `main`.

- [ ] **Step 1: Run focused automated checks**

```powershell
npm run test -- src/__tests__/LanguageSwitcher.test.tsx src/__tests__/Header.feedback.test.tsx src/__tests__/arabic-workspace-localization.test.tsx src/__tests__/ScoreDiffBreakdown.test.tsx src/__tests__/light-mode-contrast.test.ts
npx eslint src/components/ui/LanguageSwitcher.tsx src/components/Layout/Header.tsx src/components/ScoreDiffBreakdown.tsx src/__tests__/LanguageSwitcher.test.tsx src/__tests__/Header.feedback.test.tsx src/__tests__/ScoreDiffBreakdown.test.tsx
npm run type:check
git diff --check origin/main...HEAD
```

Expected: each command exits 0 with no failures or errors.

- [ ] **Step 2: Perform browser verification**

Run `npm run dev`, then check signed-in header and Optimize projection at desktop and 390-by-844 mobile sizes in English/light, English/dark, and Arabic/RTL. Verify readable projection text, direct theme/language controls, no menu duplicates, no overlap, 44-pixel touch targets, successful toggles, and no console errors.

- [ ] **Step 3: Review the complete diff**

Invoke the repository `code-review` skill against `origin/main...HEAD`. Fix actionable findings with a new failing regression test where applicable, then repeat focused verification.

- [ ] **Step 4: Push a non-force fast-forward to main**

```powershell
git fetch origin
git merge-base --is-ancestor origin/main HEAD
git push origin HEAD:main
git fetch origin main
```

Expected: the ancestry check exits 0, push succeeds without force, and `git rev-parse HEAD` equals `git rev-parse origin/main`. Confirm `.claude/settings.local.json` remains unstaged and unchanged by this work.
