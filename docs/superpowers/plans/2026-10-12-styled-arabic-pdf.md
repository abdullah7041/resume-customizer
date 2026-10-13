# Styled Arabic PDF Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task by task, with one fresh final reviewer.

**Goal:** Resolve styled Arabic extraction and prepare PR #146 for production merge.
**Architecture:** Extend the existing Unicode-aware renderer with inline bidi layout and bounded captured styles. Route Arabic styled exports through it using the existing reviewed snapshot, endpoint and checker.
**Tech Stack:** Existing fontkit, jsPDF, PDF.js, React and Netlify; explicitly approved bidi-js 1.1.0 for styled layout.
**Spec:** ../specs/2026-10-12-styled-arabic-pdf-design.md

## Global Constraints

- Preserve original source strings, digit scripts, safe links, candidate review/stale checks and hidden/private exclusions.
- No additional dependencies beyond approved bidi-js, migrations, provider calls, main merge or production publication.
- Keep existing plain recovery, auth/rate limits, font hash and twenty-page limit.

## Review Focus

- ActualText scope at inline run/font boundaries must preserve complete source without duplicate extraction.
- Arabic marks, lam-alif and numeric punctuation must retain original scalars and visual positioning.
- Styled capture must bind the same reviewed snapshot and omit hidden/private content.
- Long paragraphs, title/heading orphans, page boundaries and safe links must remain usable.
- Invalid presentation data must never inject PDF operators or exceed layout bounds.

### Task 1: Inline styled encoder

Files: netlify/lib/text-pdf.ts, src/types/text-pdf.ts, netlify/lib/__tests__/text-pdf.test.ts.
Interface: generateTextPdf(blocks, approved font bytes, optional presentation, optional margins) returns bounded PDF bytes; calls without presentation remain compatible.
- [x] Add saved-byte RED regressions for correct RTL placement, bracket outlines, inline shaping, complete source and links.
- [x] Implement bounded styles, inline wrapping/bidi placement and complete-line ActualText using the existing encoder.
- [ ] Verify complete saved bytes in three readers, font rollover, pages and visual output.
- [ ] Run focused tests/types and commit scoped files.

### Task 2: Snapshot, endpoint and client

Files: textPdfSnapshot.ts and tests; generate-pdf.ts and tests; TemplatesSection.tsx and export tests.
Interface: format styled plus validated captured blocks through the same authenticated endpoint; stale attempts never save.
- [x] Add RED capture/handler/client regressions preserving visible facts and excluding hidden data.
- [x] Capture bounded presentation attributes and connect Arabic styled requests to the encoder.
- [ ] Run focused function/client tests, types and touched lint; commit scoped files.

### Task 3: Release qualification

- [x] Extend the real four-template/language matrix for styled bytes, full source, links and visual checks.
- [ ] Complete independent three-reader audits and inspect page images.
- [ ] Run lint, types, full tests, build and i18n separately; resolve failures.
- [ ] Obtain fresh code review, fix important findings with regression tests, push PR branch.
- [ ] Verify CI/security/Netlify and actual hosted bytes; rewrite PR description and mark ready only when required gates pass.
