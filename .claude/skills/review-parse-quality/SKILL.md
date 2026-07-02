---
name: Review-Parse-Quality
description: Audit a parsed resume (JSON Resume shape) against parsing best practices before it is rendered to a template. Use when comparing a Watheq-generated resume PDF against the source resume, when the user reports wrong output (missing summary, company/location shown as a bullet, one bullet split into several, project text rendered bold, skills split mid-token), or after any change to netlify/lib/parse-quality.js or src/lib/utils/resumeText.ts. Catches deterministic-fallback degradation that the AI parse path would not produce.
---

# Review Parse Quality

**Purpose**: Check a parsed resume object against a fixed set of best-practice rules, find which stage produced a defect, and point at the exact fix. This is a review pass, not a parser. It complements `/debug-resume-parsing` (which triages extraction/AI failures); this skill audits the *structured output* for silent quality loss.

## Key insight

Two paths produce the parsed object:

1. **AI parse** (`callOpenRouter('lite', ...)` with the `parse_resume` contract) — the prompt already maps non-standard headings and keeps one bullet per array item.
2. **Deterministic fallback** (`parse-quality.js`: `buildDeterministicBaseline` / `recoverSectionsFromRawText`) — runs when the AI parse fails, truncates, times out, or drops sections.

Most "looks wrong vs the source" defects come from path 2. If you see the symptoms below, first confirm whether the AI parse ran (`meta.parseQuality.aiParseFailed`, `extractionSource` ending `+deterministic`). A deterministic result is expected to be conservative, not mangled — the rules below define "not mangled".

## Best-practice rules (from OpenResume-style heuristics + this codebase)

Reflow physical PDF lines into logical lines before structuring. A wrapped bullet is one bullet. A section heading may be non-standard. Company/location is a field, not an achievement. A project title is a short label, not a paragraph. Sources:
- OpenResume parser heuristics — https://www.open-resume.com/resume-parser
- ATS bullet/line-break parsing failures — https://hireflow.net/blog/why-resume-parsing-breaks-bullet-points
- PDF-to-text structure loss — https://www.jobshinobi.com/blog/resume-scanner-for-pdf-parsing-problems

## Audit checklist

Run each check against the parsed object. Each maps to a concrete location.

1. **Summary present when the source has one.**
   - Fail: `basics.summary` empty while the raw text has a profile paragraph — including under a non-standard heading (`Core Identity`, `Value Proposition`, `Professional Summary`, `About`, `Objective`).
   - Fix: `HEADING_PATTERNS.summary` + `HEADING_KEYWORDS[summary]` must match the heading; `buildDeterministicBaseline` must set `basics.summary` from `sections.summary`; `recoverSectionsFromRawText` must `fill("summary")`.

2. **Company / location is not a bullet.**
   - Fail: a `work[i].highlights[0]` that is really the employer/location line (e.g. `"Al Ghalia (Saudi Arabia)"`); `work[i].name` empty.
   - Fix: in `parseWorkBlocks`, the first short non-sentence line after a `title + date` header maps to `name` (+ `location` from a trailing `(...)`), not a highlight.

3. **One logical bullet is one array item.**
   - Fail: a highlight that ends mid-clause and continues in the next highlight (`"...15+ interactive Power"` / `"BI dashboards, ..."`), or a skill split mid-token (`"Data-"` / `"Driven Decision Making"`).
   - Fix: line reflow happens upstream in `src/lib/utils/resumeText.ts` (`mergeWrappedLines`, de-hyphenation). If splits survive, the wrap heuristic (`WRAP_GAP_FACTOR`, right-margin fill) missed this layout. Do not paper over it in `parse-quality.js`.

4. **Project name is a short title, not a paragraph.**
   - Fail: `projects[i].name` is a full sentence (templates render `name` bold, so the whole paragraph shows bold), and a leading `•` survives in `name`.
   - Fix: `buildDeterministicBaseline` strips the leading bullet marker and splits `"Title: description"` into `name` + `description`. No colon → keep the line as `name` (schema requires non-empty `name`).

5. **No fabrication.** Every recovered value is a literal substring of the raw text. `recoverSectionsFromRawText` only fills empty fields, never overwrites AI-populated ones.

6. **Schema-safe.** `netlify/lib/resume-schemas.ts` requires non-empty `work[].name`? no — but `projects[].name`, `skills[].name`, `certificates[].name`, and `basics.name` are `min(1)`. Never emit an empty required name.

## Procedure

1. Get the parsed object and the raw text (`meta.parseQuality`, the stored `plainText`, or re-run `buildDeterministicBaseline(rawText)`).
2. Walk the 6 checks. For each failure, name the `file:function` and the specific input line that broke it — a finding needs evidence, not a guess.
3. Propose the smallest fix at the correct stage (reflow defects belong in `resumeText.ts`, structuring defects in `parse-quality.js`). Do not fix a reflow bug inside the structurer.
4. Add or extend a regression case in `netlify/lib/__tests__/parse-quality.test.js` using the exact failing lines.
5. Verify: `npm run test -- parse-quality` and `npm run type:check`. Do not mark done until zero failures.

## Non-goals

- Not for extraction failures (unreadable file, OCR, mojibake) — use `/debug-resume-parsing`.
- Not for AI scoring/optimization output — different contract.
- Does not change the AI `parse_resume` prompt unless a defect is proven to originate there (rare; the prompt already handles headings and per-bullet arrays).
