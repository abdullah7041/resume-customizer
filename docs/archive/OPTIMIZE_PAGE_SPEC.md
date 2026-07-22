> **Status: completed work order (archived 2026-07-21).** This described a one-shot redesign task, since shipped; line numbers within are stale. It is not a living spec of the page.

# Optimize page spec: score hardening + review-queue redesign

Copy into repo root as `OPTIMIZE_PAGE_SPEC.md`. Two passes, shipped separately. Run Pass 1 first, confirm with a real optimize run, then start Pass 2.

Codex settings for both: model `gpt-5.5`, reasoning `medium`. `/effort high` allowed only for the verify-flow step in Pass 1.

Files: `src/components/sections/OptimizeSection.tsx` (verify flow ~line 739-793, score card ~1262-1307, metrics memo ~360-425), `netlify/lib/score-utils.ts`, `netlify/functions/ai-match.ts`, `netlify/functions/optimize.ts`, `netlify/functions/optimize-stream.ts`, `src/locales/{en,ar}/sections/optimize.json`, `src/lib/stores/resumeStore.ts` (read-only reference for work entries).

---

## PASS 1: Score pipeline hardening (small diff, ship first)

The bug: auto-verify re-analyzes the optimized resume and stored `score: 1`, displayed as "Optimized Score 1%" with a "+-77%" chip. Root cause is unguarded score handling, traced already:

**1a. Fraction guard in `normalizeScore()`** (`netlify/lib/score-utils.ts`)
- If `0 < value < 1` (strictly), treat as fraction scale: multiply by 100, log `[score-utils] rescaled fraction score <raw> -> <scaled>`.
- Exactly 1 stays 1 (ambiguous, prompt fix below handles it).
- Add unit tests: 0.79 -> 79, 79 -> 79, 0 -> 0, 1 -> 1, 150 -> 100, negative -> 0, NaN -> throws.

**1b. Prompt hardening**: in the match/verify prompt (processMatchOnly path) and optimize prompt, state the score fields are integers 0-100, never decimals or fractions. Do NOT touch the anti-inflation anchors (80+/60-79/<60).

**1c. Verify-flow guards** (`OptimizeSection.tsx` auto-verify block):
- Before calling the API: if `optimizedText.length < Math.max(200, resumeText.length * 0.5)`, skip verify, log `[OptimizeSection] verify skipped: optimized text too short (<n> chars)`. This catches formatResumeToText producing garbage.
- After: if `verifiedScore < beforeScore - 25`, do NOT store it as the displayed score. Set an anomaly state instead. Log the raw score and text length so the real cause shows up in console.
- Anomaly UI: score card shows "Couldn't verify the new score" + a Retry button (re-runs verify once). Never silently display an implausible number, and never fabricate a replacement. Honest states only: Projected -> Verified -> or Couldn't-verify.

**1d. Score card states** (~line 1262):
- Before verify returns: `Projected ~84%` in gray with a small spinner while `isAutoVerifying`.
- Verified: `84% ✓` with a "Verified by re-analysis" label (tooltip: "We re-scored your optimized resume against this job description").
- Delta chip: compute sign properly. Positive: green up `+6%`. Zero: neutral "no change". Negative within plausible range: red down `-3%` (honest, no hardcoded `+`). The current template renders `+-77%`.

**1e. Verify must not charge credits.** Check whether the ai-match call consumes user credits; the Match section charges 2. If it does, add a `mode: 'verify'` flag the server accepts to skip `consumeCredits`, allowed once per optimization run (client enforces once; server logs mode). The user already paid 5 credits for optimize; verification is part of that purchase.

**Pass 1 gate**: `npm run lint`, `npm run type:check`, `npm run test -- --changed`. New score-utils tests must pass. Zero errors.

**Manual check**: run a real optimize; confirm projected -> verified transition; simulate failure (offline) -> anomaly state with retry.

---

## PASS 2: Review-queue redesign

### Layout

**1. Sticky score header** (replaces today's score summary + score breakdown position):
- Left: `78% -> 84% ✓ verified` (states from Pass 1).
- Middle: progress `13/15 applied` with a thin bar.
- Right: primary `Continue` button (to Export step).
- Expander inside header: the 4 category tiles (Hard Skills 4/5 etc.); their long explanation texts sit behind per-tile expanders, `text-start`, never center-aligned.
- The big `Optimize resume with AI (5 credits)` CTA shows only in the pre-generation empty state. After cards exist it becomes a small secondary "Re-run" action in the header.

**2. Strategy block**, one collapsible card under the header, closed by default, holding the three current panels with each fact appearing once:
- Keywords: add / keep / remove chips (current Keyword Focus content).
- Gap analysis: the severity cards. Where a gap is "add keyword X", link/reference the keyword chip; don't restate it.
- Title suggestions: the position-title list with its one-click bulk Apply kept working.

**3. The queue**, grouped, in this order: Headline card, Summary card, one card per work entry, Skills, Certifications, Projects.
- Work entry card title: `position · company · dates` from the resume data (via the store's work entries), e.g. `Senior Data Analyst · Bank X · 2021-2024`. Fallback when mapping fails: current `Experience N`.
- Inside each job card: one row per bullet suggestion with status icon (applied ✓ / pending ○), first words of the original bullet, expand -> existing original/optimized diff with Apply / Refine / Revert (reuse current diff components).
- Card-level "apply all in this job" action.
- Filter row above queue: All / Pending / Applied (replaces the section chip row).

**4. Parsing alerts** (contact/profile-link warning): collapse to a small badge with count; expanded only on click. Not an open banner above the workspace.

### Mobile (390px)
Header stacks (score row, progress row, Continue full-width), queue cards full-width, diffs stack vertically (original above optimized), touch targets >=44px.

### Arabic RTL
Every new string in BOTH `src/locales/en/sections/optimize.json` and `ar/sections/optimize.json`, real Arabic. `text-start`/`text-end` only. Chevrons and the progress bar direction mirror; arrows get `rtl:rotate-180`. Verify the diff view reads correctly in Arabic.

### Code structure
Extract render pieces from OptimizeSection.tsx into `ScoreHeader`, `StrategyBlock`, `JobGroupCard` (under `src/components/sections/optimize/`), state stays in OptimizeSection. No new dependencies. House rules: no `any`, `@/` imports, `watheq:` keys, `[OptimizeSection]` logs, license headers untouched.

**Pass 2 gate**: same three commands. Manual: EN + AR, 390px, an older saved session still renders, strategy bulk-apply works, per-job apply-all works.

---

## Codex prompts

**Pass 1, plan:**
```
Read OPTIMIZE_PAGE_SPEC.md (PASS 1 only) and AGENTS.md. Plan only, no code: exact changes to
score-utils, the verify flow guards in OptimizeSection, score card states, the no-credit verify
mode, and the test list. Flag conflicts with the codebase.
```
Check the plan mentions: fraction guard boundaries (0<x<1 strict), anomaly state instead of clamping, credits skipped for verify. Then:
```
Implement PASS 1 as planned. Steps, committing each: (1) score-utils + tests, (2) prompt integer
constraint, (3) verify guards + anomaly state, (4) score card states + delta chip, (5) verify
credit skip, (6) npm run lint, npm run type:check, npm run test -- --changed, fix everything.
```

**Pass 2, plan:**
```
Read OPTIMIZE_PAGE_SPEC.md (PASS 2) and AGENTS.md. Plan only: component extraction map for
OptimizeSection, the sectionId-to-work-entry mapping with its fallback, Strategy block content
sources, locale key list for en and ar, test plan. Flag anything that breaks existing tests.
```
Check it mentions: fallback to "Experience N", both locale files, reuse of existing diff components. Then:
```
Implement PASS 2 as planned. Steps, committing each: (1) ScoreHeader + header states,
(2) StrategyBlock merge, (3) JobGroupCard queue + mapping, (4) filters + parsing-alert badge,
(5) en + ar locales, (6) mobile + RTL pass, (7) full gate: lint, type:check, test -- --changed.
```
