> **Status: completed work order (archived 2026-07-21).** This described a one-shot redesign task, since shipped; line numbers within are stale. It is not a living spec of the page.

# Match page redesign spec: verdict-first funnel

Files involved: `src/components/sections/MatchSection.tsx` (918 lines), `src/components/sections/SaveJobToPipelineCard.tsx`, `netlify/functions/ai-match.ts`, `netlify/lib/gemini-client.js` (processMatchOnly), `src/locales/{en,ar}/sections/match.json`, `src/types/analysis.ts`.

## Concept

One screen answers 3 questions without scrolling: what's my score, what's blocking me, what do I do next. Primary action: **Optimize resume** (the paid funnel step). Everything else is on demand.

## Layout after analysis

**1. Verdict band** (top, full content width):
- Score + verdict left: `75` + "Strong Match" (keep the ring or use a compact number, either is fine, but smaller than today).
- Top 3 gaps as short chips, taken from the reality-check gap titles (e.g. "Google Sheets", "L&O domain", "Student outcomes").
- Primary CTA: `⚡ Optimize resume` with credit cost. Nothing else competes with it visually.
- Secondary, quiet: `Save job ▾` (expands the pipeline form inline) and `Score breakdown` link.
- The green "Analyzing OPTIMIZED resume... expect ~75" alert becomes one caption line inside the band, not a banner.

**2. Job description**: before analysis, the JD input is centered and uses the full content width (the current dead left column dies). After analysis, JD collapses to one row: `Data Analyst · N words · [View/edit] [Clear]`, expandable.

**3. Detail sections** below the band, all collapsed by default (accordion):
- **Why this score**: 3-5 short bullets, left-aligned (`text-start`).
- **Gaps & evidence**: the reality-check cards, one card per gap. Each gap's suggestion lives inside its card. The standalone "Suggestions" list is deleted; it repeats the missing keywords and gap advice verbatim today. Gap info appears exactly once on the page.
- **Keywords**: missing chips first (red), found chips after (green).
- **Full analysis** (expander): the complete AI narrative for users who want everything.

**4. Parsing alerts** (contact / experience location): they belong to the Resume step, not Match. Collapse to a small badge count that expands; do not show two open banners above the match content.

## Data bugs (must fix)

1. Raw `null` rendering in Employment type / Seniority / Sector selects. Nullish values map to an empty option labeled via i18n ("Not specified" / "غير محدد"). Never render the string "null".
2. "Unknown company" appears as a value; use an empty input with placeholder instead.
3. Long paragraphs are center-aligned; all body text `text-start`.
4. Same gap repeated in 3 places (analysis paragraph, reality check, suggestions); single source after this spec.

## Prompt-level trim (ai-match)

- Add `summary_bullets: string[]` (3-5 items, each <=120 chars) to the match response schema. The verdict "Why this score" section renders these.
- Cap the narrative analysis at ~80 words. It now lives only inside "Full analysis".
- Each gap returns once, with its recommendation folded in; no separate suggestions array duplicating missing keywords.
- **Do not touch the anti-inflation scoring rules** (80+ hireable / 60-79 competitive / <60 gaps). They are enforced in processMatchOnly on purpose. Scores stay genuine calculations.
- Update the Zod schema, `src/types/analysis.ts`, and `netlify/functions/__tests__/ai-integration.test.ts`.
- **Backward compatibility is required**: saved analyses in user data have no `summary_bullets`. When absent, fall back to rendering the clamped narrative. Old saved jobs must still render without errors.

## Mobile

- 390px viewport: score, verdict, gap chips, and the Optimize CTA all visible without scrolling.
- Verdict band stacks vertically, CTA full width, accordion touch targets >=44px.

## Arabic / RTL

- Every new string gets keys in BOTH `src/locales/en/sections/match.json` and `src/locales/ar/sections/match.json`. Real Arabic, not transliteration.
- Verify in ar: chips wrap correctly, accordion chevrons mirror, alignment uses `text-start`/`text-end` (never `text-left`/`text-right`), arrows get `rtl:rotate-180`.

## House rules (from AGENTS.md / CLAUDE.md)

- No `any`; new types in `src/types/`.
- `@/` alias imports, `watheq:` storage keys, `[MatchSection]` log prefix.
- Error objects carry `status`, `code`, `message`.
- Keep license headers untouched.
- Split MatchSection.tsx render into smaller components (VerdictBand, detail sections) but keep the state logic where it is; no new dependencies.

## Quality gate (all must pass, fix everything, then stop)

```bash
npm run lint
npm run type:check
npm run test -- --changed
```
