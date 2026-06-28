---
name: fix-light-dark-mode
description: Use when light mode shows dark/black surfaces or washed-out colors, an element doesn't change when toggling theme, a color edit has no visible effect, or before writing any new component's colors. Watheq is dark-first (Saudi emerald) so light mode is where colors leak.
---

# Fix Light / Dark Mode (Watheq)

## Overview

Watheq is **dark-first**. Light is the default (no class); `.dark` on `<html>` activates `dark:` utilities and the `.dark` CSS-var overrides. **Any color written without a `dark:` prefix AND without a flipping `var(--token)` applies in BOTH themes.** That is the entire bug: a dark color hardcoded with no light counterpart stays dark in light mode → "light doesn't give light colors."

**Core rule:** every color must *flip*. Either use a token that already flips, or pair a **light base** with a `dark:` override. Never leave a bare dark value.

## The two token systems (know which owns the element)

| System | Defined in | Drives | Toggle |
|---|---|---|---|
| **Design tokens** (`--bg`, `--surface*`, `--ink*`, `--panel-*`, `--glass-border`, `--focus-ring`) | `src/styles/theme.css` | custom classes `.card`, `.neu-card`, `.workspace-panel`, `glass.*`, and any `var(--...)` utility | `:root.dark, .dark` |
| **shadcn tokens** (`--color-background`, `--color-foreground`, `--color-card`…) | `src/index.css` | Tailwind utilities `bg-background`, `text-foreground`, `border-border` | `.dark` |

Both flip automatically. **If an element uses one of these, you almost never edit the component — fix the variable in theme.css / index.css.** The bug is only in elements using *raw* Tailwind colors (below).

## Diagnose (3 steps)

1. **Reproduce in light.** Toggle the theme, or in DevTools remove the `dark` class from `<html>`. Find the element that stays dark / low-contrast.
2. **Read its className.** Find the offending property: `bg-`, `border-`, `ring-`, `text-`, `shadow-`, gradient stops.
3. **Classify it:**
   - Uses `var(--...)`, `glass.*`, `.neu-card`, `.card`, `bg-background` → flips already. If still wrong, the **variable** is wrong → edit theme.css / index.css.
   - **Bare dark utility with no `dark:` and no token** → THE BUG. Fix it (next section).

## The dark-only tells (each MUST flip)

These applied without a `dark:` partner are the offenders. Grep for them:

`bg-black/N` · `bg-white/N` (as a surface) · `border-white/N` · `ring-white/N` · `text-white` · `bg-gray-900` / `bg-slate-900` / `bg-zinc-900` · `from-*-900` / `to-*-900` gradients · gradient text ending `to-white` · `bg-[#0xxxxx]` (dark hex)

## Fix — first option that fits, in order

Default to **tokens/helpers** — they are the design system's source of truth (`src/lib/styles/glass.ts`) and need no color guessing. Reach for hand-tuned `dark:` pairs only when no token fits.

1. **Surface / panel / card** → use the helper. It auto-flips via CSS vars:
   ```tsx
   import { glass } from '@/lib/styles/glass';
   className={glass.elevated}   // 'neu-card shadow-2xl'  (also: glass.card, glass.subtle, glass.input)
   ```
   Or the raw token: `bg-[color:var(--surface-glass)] border-[color:var(--glass-border)]`.

2. **Inline utility that must stay inline** → **light base + `dark:` for the dark value.** Base is the LIGHT color, never the dark one:
   ```diff
   - "bg-black/40 border border-white/10"
   + "bg-[color:var(--surface-glass)] border border-[color:var(--glass-border)] dark:bg-black/40 dark:border-white/10"
   ```

3. **Text / icon** → `text-[color:var(--ink)]` (or `text-gray-900 dark:text-white`); muted → `var(--ink-muted)`. Gradient text: replace the `to-white` stop with a light-readable color under `dark:` (`from-emerald-700 to-emerald-500 dark:from-emerald-200 dark:to-white`).

### Token cheat sheet (no guessing hex/opacity)

| Need | Use |
|---|---|
| Surface / card bg | `glass.card` · `bg-[color:var(--surface-glass)]` |
| Control / input bg | `glass.input` · `bg-[color:var(--surface-control)]` |
| Border | `border-[color:var(--glass-border)]` |
| Primary text | `text-[color:var(--ink)]` |
| Muted text | `text-[color:var(--ink-muted)]` |
| Focus ring | `var(--focus-ring)` |
| Badge / button | `glass.badge.*` · `glass.button.*` |

## Reference examples in repo

- **Good (copy this):** `src/components/modals/ClarificationModal.tsx` — uses `glass.*` + token text.
- **Bad (the classic break):** `src/components/ui/Vision2030Modal.tsx`, `Vision2030CalculationModal.tsx`, `Vision2030Summary.tsx`, `Vision2030/SectorBreakdown.tsx` — dark-only `bg-black/40`, `bg-gray-900`, `border-white/10`.

## Verify (don't claim it's fixed without this)

1. Guard test (fails on bare dark-only colors): `npm run test -- light-mode-contrast`
2. `npm run quality:parallel`
3. Actually toggle the theme and look — light panel must be light, text readable both ways.

## Common mistakes (from real attempts)

- **Reaching for `dark:` pairs first and guessing `bg-white/80`, `from-gray-100`.** Guessed values drift off-palette. Use a token/helper; it's the source of truth.
- **Adding a `dark:` override but leaving the base dark.** The base (no-prefix) value must be the LIGHT one — that's what renders in light mode.
- **Missing gradient text endpoints and icon colors** — `to-white` text and `text-white/60` icons vanish on light; easy to overlook.
- **Editing the component when it uses `.neu-card` / `.card` / `var(--...)`.** Those flip already — fix the variable in `theme.css` / `index.css`, not the JSX.
