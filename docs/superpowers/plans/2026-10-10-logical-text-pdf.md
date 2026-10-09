# Logical Text PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a candidate-reviewed, selectable Text PDF recovery path for Arabic/mixed exports without changing source facts or bypassing export safeguards.

**Architecture:** Collect ordered blocks from the exact captured visible preview. A discriminated request goes through the existing authenticated/rate-limited PDF endpoint to a jsPDF/fontkit vector renderer, with the demonstrated plain layout. Candidate review and the unchanged PDF text check gate its download.

**Tech Stack:** Existing React/TypeScript/jsPDF 4.2.1/Vitest/Netlify; approved @pdf-lib/fontkit 1.1.1 and DejaVu Sans 2.37 with license notices.

**Spec:** [Approved logical text PDF design](../specs/2026-10-10-logical-text-pdf-design.md).

## Global Constraints

- Work only in the existing `candidate-evidence-pilot/resume-customizer` checkout and `codex/candidate-evidence-pilot` branch. Preserve the unrelated untracked October 6 handoff and the shared node_modules junction target.
- Only the named shaping package/font scope is approved; no additional PDF/bidi dependency or external tool. Install production dependencies in this worktree's own module directory.
- One shared left margin; mixed runs may occupy separate rows. Original source strings remain immutable. No hidden/duplicate factual text, scalar deletion, string-reversal shortcut or weaker checker.
- Keep authentication, rate limiting, composed-snapshot preflight, stale-request protection, explicit candidate review, recovery and no-download-on-unverified behavior.
- Server output maximum: 20 pages. Request maximum: 1,000 blocks, 10,000 UTF-16 code units per run and 100,000 across all runs; at most 1,000 runs per block. Reject invalid/empty requests and unsafe link schemes. The server owns layout dimensions/font sizes; accept no client PDF operators or coordinates.
- No persistence, AI call, sensitive logging, main merge, production publication or participant collection. Owner walkthrough results are not independent HR data.

## Review Focus

- Diacritics, ligatures and alternating scripts must preserve source scalars and readable shaping, or explicitly fail closed.
- Hidden/private DOM text and stale previews must never enter a downloadable PDF.
- Long words, font-bank rollover and page boundaries must not drop/duplicate a field or attach a bullet to a different employer.
- Multiple contact links must retain safe targets without duplicating displayed text or accepting javascript/data/file URLs.
- Font-loading errors, rejected payloads, rate limits and source-check failures must keep a usable recovery path and must not trigger a checked download.

## Task 1: Validated text PDF renderer

**Files:** Create `src/types/text-pdf.ts`, `netlify/lib/text-pdf.ts`, `netlify/lib/__tests__/text-pdf.test.ts`, `netlify/assets/fonts/DejaVuSans.ttf`, `netlify/assets/fonts/LICENSE.txt`; modify `package.json`, `package-lock.json` and `netlify.toml` only for the approved dependency/asset bundle.

**Interfaces:** `TextPdfRun = { text: string; href?: string }`; `TextPdfBlock = { kind: 'title' | 'heading' | 'body' | 'bullet'; runs: TextPdfRun[] }`. Export `validateTextPdfBlocks(value: unknown): TextPdfBlock[]` and `generateTextPdf(blocks: TextPdfBlock[], fontBytes: Uint8Array): Uint8Array` from the renderer. Validation throws a bounded error without input text. The caller maps unsupported data to recovery.

- [ ] Write a failing saved-byte test that generates the original five fixtures, reads them with installed PDF.js and compares the complete source in order with whitespace-only normalization. Add diacritics/lam-alef, Arabic/Latin digits, percentages, phone prefixes, dates, URLs and alternating-script fixtures; source scalar assertions must reject a mismatched or missing glyph.
- [ ] Add rejection tests for empty/malformed blocks, payload limits, unsafe links and invalid font bytes. Add a real multipage case with numbered job bullets and more than 255 encoded pieces; assert all source text and safe annotation targets survive without omissions or duplicates.
- [ ] Run `npm test -- netlify/lib/__tests__/text-pdf.test.ts --no-file-parallelism`; establish the red result before implementation.
- [ ] Verify the existing junction's resolved target, unlink only the local junction without touching its target, and install the approved package into an independent local node_modules directory. Copy the approved font bytes and required license notices; verify the font hash from the feasibility report. Configure only this function's asset bundle.
- [ ] Implement validation and the smallest renderer using jsPDF's font-serialization hook and public fontkit paths. Use truthful Type3 bounds/advances, ToUnicode, original-source ActualText, enabled Arabic shaping and disjoint lam-alef pieces. Cache pieces and allocate another 8-bit font bank when full. Use fixed server A4 layout (595.28 × 841.89 pt, 43.2 pt side margins, 54 pt top/bottom, 11 pt body and 16 pt title); preserve source boundaries when wrapping and avoid orphaned headings.
- [ ] Reuse and verify jsPDF's existing bidi facilities where suitable; derive logical direction runs without mutating the source string. Shape each wrapped row independently. Reject unsupported clusters/scripts; do not silently lose marks or unsupported characters. Attach safe links to their actual rendered spans.
- [ ] Run the focused test and `npm run type:check`. Audit the same generated bytes locally with PDFium/pypdf and inspect both reader renders. If any supported fixture fails, fix the renderer before wiring it into the app. Check character/word/line selection geometry; report composite-run limits rather than declaring it exact by assumption.
- [ ] Commit only this task's files; review against the approved spec before Task 2.

## Task 2: Captured preview, candidate review and authenticated endpoint

**Files:** Create `src/lib/utils/textPdfSnapshot.ts`, `src/lib/utils/textPdfSnapshot.test.ts`; modify `src/components/sections/TemplatesSection.tsx`, `src/__tests__/TemplatesSection.test.jsx`, `netlify/functions/generate-pdf.ts`, `netlify/functions/__tests__/generate-pdf.runtime.test.ts`, `src/locales/en/sections/templates.json`, `src/locales/ar/sections/templates.json`.

**Interfaces:** Export `captureTextPdfBlocks(preview: HTMLElement): TextPdfBlock[]`. The captured DOM supplies ordered text runs and safe anchor targets. Request shape is `{ format: 'text', blocks: TextPdfBlock[], templateId: string, filename: string }`; the legacy HTML request and PDF response contract remain supported. Task 1 validates/renders blocks after existing authentication/rate-limit checks.

- [ ] Write collector tests for all four template DOM structures, nested inline spans, links, heading/bullet ordering and hidden/no-print/private exclusion. Compare all displayed facts against each exact captured snapshot; collection must not read mutable stores or include newly added invisible fields.
- [ ] Write component tests for explicit **Review Text PDF** → plain preview → **Download Text PDF**; no download before review/check. Include stale input changes during auth/render/text-check, unsupported response, empty blob, font failure, 429/503 and failed text verification. The reviewed snapshot must remain bound to the existing export ID.
- [ ] Add endpoint tests: text requests require the existing auth; malformed text mode returns 400; unsupported glyph/layout returns a bounded 422 `pdf/text-unsupported`; text mode does not launch Chromium or request remote assets; both modes still use the existing rate-limiter wrapper. Never log request text. Run focused tests to establish red failures.
- [ ] Implement the collector and recovery preview. Split only at actual DOM block/source boundaries; preserve inline text and link targets. Use a real accessible dialog with keyboard focus/return and a plain preview that describes the different layout. A changed snapshot dismisses/invalidates review.
- [ ] Implement the discriminated endpoint branch after auth and before native browser launch. Enforce Task 1 limits. Read only the bundled font and call Task 1; preserve the existing native-renderer sandbox/error behavior.
- [ ] Call the same authenticated endpoint with the reviewed blocks. Apply `isCurrentExport` before/after each async boundary and use the unchanged `checkPdfBlob` against the captured source. A checked Text PDF uses an explicit `-text.pdf` filename and honest text-checked status; failures leave the existing recovery options available. Do not silently replace styled export.
- [ ] Run collector/component/endpoint tests plus existing generate-pdf security/margins/budget tests, `npm run type:check`, lint on touched code and `npm run i18n:validate`. Review stale/private-data, authentication and recovery behavior. Commit only the task's files.

## Task 3: Preview output and delivery evidence

**Files:** Extend the existing `src/__tests__/candidate-trust-flow.test.tsx` harness where useful; create `docs/superpowers/reports/2026-10-10-text-pdf-readiness.md`. Update the owner handoff with actual results and limits, preserving historical receipts.

- [ ] Generate complete fictional English, Arabic, mixed and multipage Text PDFs using the production renderer/collector. Compare every captured field, job association, number, date, quote and safe link from the saved bytes in PDF.js, PDFium and pypdf. Inspect both renderers and document each unsupported fixture.
- [ ] Exercise real browser copy/search/select of the generated PDF, including Arabic words, lam-alef, mixed text and the phone prefix. Nonempty bounding boxes alone are insufficient. Fix any evidenced geometry regression or keep the affected path unqualified.
- [ ] Run separate `npm run lint`, `npm run type:check`, `npm test -- --no-file-parallelism`, `npm run build`, and `npm run i18n:validate`. Do not run quality:parallel in-agent or repeat a timed-out broad gate blindly. Obtain final branch review and address actionable findings.
- [ ] Push the authorized feature branch/draft PR. Check CI, GitGuardian, Netlify and exact preview SHA. With the existing authorized test session and fictional inputs, drive the actual recovery preview/download and inspect the delivered bytes across readers; local/mocked output is not hosted delivery.
- [ ] Record exact hashes, checks, reader versions, template/language/page coverage and limits in the readiness report. Keep Text PDF, styled/native Print, named ATS ingestion, owner validation and formal HR results separate. Main merge/release remains the owner's decision.

## Execution handoff

The existing approved workflow used subagent-driven development. Preserve that method after the owner reviews this written plan: fresh implementer and independent reviewer per task, then final branch review. No task is complete until its actual verification passes; unsupported inputs stay explicit rather than being normalized into success.
