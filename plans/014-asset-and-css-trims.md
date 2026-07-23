# Plan 014: Gate parked mascot CSS out of the shipped bundle; right-size character images

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- src/App.tsx src/index.css src/features/hr-super-saud/ src/components/shared/CharacterResultsCompanion.tsx src/assets/character/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED (visual surface; mitigated because the mascot is currently OFF in production)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

Two asset-weight items on always- or commonly-shipped surfaces:

**A.** The HR mascot ("HR Super Saud") is a **parked** feature — hard-disabled for launch by decision 2026-07-06 — yet its overlay component is statically imported in `App.tsx` and ~53 `hr-super-saud` CSS references (4 keyframes + a large rule block, ~250 lines) sit in `src/index.css` (3349 lines), which every visitor downloads. Moving the CSS next to the feature and lazy-importing the overlay makes "disabled" actually mean "ships nothing", while keeping the flip-to-re-enable affordance the decision comment promises.

**B.** The character results companion (#122) renders one of six webp illustrations of up to **561KB** (`male-tier-3.webp`), and its `<img>` has no intrinsic dimensions → layout shift when it loads. Add `width`/`height`, and (tooling permitting) re-encode the oversized tiers.

## Current state

- `src/App.tsx` (verified):
  - `:14-15` — static imports: `import { HRSuperSaudOverlay } from "@/features/hr-super-saud/HRSuperSaudOverlay";` and `HRSuperSaudProvider` from the same feature dir.
  - `:36-37` — `// Launch flag: mascot hidden for launch (decision 2026-07-06). Flip to true to re-enable.` / `const ENABLE_HR_MASCOT = false;`
  - `:215-217` — `{ENABLE_HR_MASCOT && !isStaticPage && hrOverlayEnabled && (<HRSuperSaudOverlay isOnboardingActive={run} forceMinimized={!hasResume} />)}` inside `<HRSuperSaudProvider>` (the Provider itself wraps the app at all times and **stays** — `CharacterResultsCompanion` registers with it via the provider's event wiring; only the overlay is dead).
- `src/index.css` — `grep -n "hr-super-saud" src/index.css` → 53 matches, first at `:1954` (`@keyframes hr-super-saud-enter`), keyframes through `~:1992`, `.hr-super-saud-*` rule blocks from `~:2003` onward (incl. `.dark .hr-super-saud-controls` variants at `~:2107`). Extract the exact contiguous ranges by reading around each grep hit — do not assume one contiguous block.
- `src/components/shared/CharacterResultsCompanion.tsx` (verified `:118-127`): the `<img>` has `loading="lazy"`, `decoding="async"`, `draggable={false}`, `onError={markAssetFailed}` — but **no `width`/`height`**. Images imported statically at `:4-9` (Vite emits URL refs — no JS bundle bloat).
- `src/assets/character/` sizes (verified): `female-tier-1` 276K, `female-tier-2` 300K, `female-tier-3` 305K, `male-tier-1` 342K, `male-tier-2` 72K, `male-tier-3` **561K**.
- Convention: feature-scoped code lives under `src/features/hr-super-saud/`; CSS is plain (Tailwind v4 + hand-written index.css); reduced-motion gating is global (do not re-implement it).

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Build     | `npm run build:vite`        | exit 0              |
| Tests     | `npm run test`              | all pass            |
| Typecheck | `npm run type:check`        | exit 0              |
| Lint      | `npm run lint`              | exit 0              |

## Scope

**In scope**:
- `src/App.tsx` (overlay import → lazy)
- `src/index.css` (remove hr-super-saud blocks)
- `src/features/hr-super-saud/hr-super-saud.css` (create — receives the moved CSS)
- `src/features/hr-super-saud/HRSuperSaudOverlay.tsx` (add the CSS import)
- `src/components/shared/CharacterResultsCompanion.tsx` (img dimensions)
- `src/assets/character/*.webp` (re-encode only — Step B2, optional)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `HRSuperSaudProvider`, `useHRSuperSaud`, `emitHRSuperSaudEvent` — live wiring used by CharacterResultsCompanion. Deleting or lazy-loading the Provider breaks the companion.
- The `ENABLE_HR_MASCOT` flag value — it stays `false`; this plan changes what `false` costs, not the decision.
- `character-results__*` CSS — that's the live companion's styling, not the mascot's.
- Deleting any mascot source file — the feature is parked, not abandoned.

## Git workflow

- Branch: `advisor/014-asset-css-trims`
- Suggested commit: `perf: move mascot CSS into its feature, lazy-load overlay; size character images`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step A1: Move the mascot CSS into the feature

Create `src/features/hr-super-saud/hr-super-saud.css`. Cut every `hr-super-saud` block from `src/index.css` (locate all 53 references via `grep -n "hr-super-saud" src/index.css`; move whole rule blocks/keyframes, including `.dark` variants) and paste them verbatim into the new file. Add `import './hr-super-saud.css';` at the top of `HRSuperSaudOverlay.tsx`.

**Verify**: `grep -c "hr-super-saud" src/index.css` → 0; `grep -c "hr-super-saud" src/features/hr-super-saud/hr-super-saud.css` → 53 (or the moved count); `npm run build:vite` → exit 0.

### Step A2: Lazy-load the overlay

In `App.tsx`: replace the static overlay import with `const HRSuperSaudOverlay = lazy(() => import("@/features/hr-super-saud/HRSuperSaudOverlay").then(m => ({ default: m.HRSuperSaudOverlay })));` and wrap the render site (`:215-217`) in the same `<Suspense fallback={null}>` pattern other lazied components in App.tsx already use (several exist — match one). Keep the Provider import static.

**Verify**: `npm run build:vite` → exit 0, then confirm exclusion: `grep -rl "hr-super-saud-enter" dist/assets/` → the matching chunk must NOT be referenced in `dist/index.html` (with the flag false the dynamic import is never executed; if the bundler tree-shakes the whole branch, zero matches is also success).

### Step B1: Intrinsic dimensions on the companion image

Get each webp's pixel dimensions: `node -e "const f=process.argv[1];const b=require('fs').readFileSync(f);/* webp VP8X/VP8 parse */" ` is fiddly — instead use PowerShell: `Add-Type -AssemblyName System.Drawing; [System.Drawing.Image]::FromFile("$pwd\src\assets\character\male-tier-1.webp")` may not decode webp on this box. Simplest reliable route: `npx image-size src/assets/character/male-tier-1.webp` (the `image-size` CLI decodes webp headers without native deps). If all six share one aspect ratio, add `width`/`height` attributes (the intrinsic values) to the `<img>` in `CharacterResultsCompanion.tsx:118-127` — the CSS class already controls display size; intrinsic attrs only fix CLS. If ratios differ per tier, derive per-image dims from the imported source map (small lookup object next to the imports).

**Verify**: `npm run type:check` → 0; `npm run test` → the companion's test (`CharacterResultsCompanion.test.tsx`) passes.

### Step B2 (optional — skip cleanly if tooling unavailable): Re-encode oversized tiers

If `npx sharp-cli --version` works without native-build errors: re-encode the three >300K images to their display resolution (measure the rendered box in the component's CSS; target ≤2× that in pixels, quality ~80): `npx sharp-cli -i src/assets/character/male-tier-3.webp -o src/assets/character/male-tier-3.webp resize <W> --format webp --quality 80` (adjust per file). Commit only if visual spot-check (open the file) shows no obvious degradation. If sharp-cli fails to install/run → SKIP this step, note it in the report and in the plan's status row ("B2 skipped: tooling"), and leave the files untouched.

**Verify**: `ls -la src/assets/character/` → resized files smaller; `npm run test` still green.

### Step C: Full gate

**Verify**: `npm run lint`, `npm run type:check`, `npm run test`, `npm run build:vite` → all exit 0.

## Test plan

No new tests. Existing `CharacterResultsCompanion.test.tsx` guards the img markup change (update its snapshot-free assertions only if they enumerate attributes). The A2 build inspection is the shipping-weight proof.

## Done criteria

- [ ] `grep -c "hr-super-saud" src/index.css` → 0
- [ ] `src/features/hr-super-saud/hr-super-saud.css` exists and `HRSuperSaudOverlay.tsx` imports it
- [ ] `grep -n "lazy(" src/App.tsx` includes the overlay
- [ ] Companion `<img>` has `width` and `height` attributes
- [ ] `npm run lint`, `npm run type:check`, `npm run test`, `npm run build:vite` all exit 0
- [ ] `plans/README.md` status row updated (noting whether B2 ran)

## STOP conditions

Stop and report back (do not improvise) if:

- Any `hr-super-saud` class is referenced by a component OTHER than files under `src/features/hr-super-saud/` (grep `hr-super-saud` across `src/` first) — the "only the overlay consumes this CSS" assumption would be false.
- The overlay renders differently when the maintainer flips `ENABLE_HR_MASCOT = true` locally (if you can cheaply verify via `npm run dev`, do; otherwise state it was not visually verified — do NOT claim it was).
- `image-size`/`sharp-cli` require network installs that fail — skip B2 per its own instructions; STOP only if B1 also has no working route to dimensions.

## Maintenance notes

- When the mascot is un-parked (`ENABLE_HR_MASCOT = true`), the overlay + CSS load on demand — the flip-to-re-enable affordance is preserved; whoever flips it should visually QA the overlay once since the CSS moved files.
- Future character tiers: add images at display resolution from the start; the 561K tier-3 was ~5× oversized.
- If the mascot is ever formally abandoned, the whole `src/features/hr-super-saud/` dir + its CSS file delete cleanly now (single location).
