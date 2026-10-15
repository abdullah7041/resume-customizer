# Styled Arabic PDF repair

**Qualification update, 2026-10-15:** The saved hosted PDF fails independent extraction/search and the current PDFium retest no longer passes. The complete-line ActualText approach below remains implemented but is not qualified for release. See the [blocking receipt](../reports/2026-10-15-styled-arabic-hosted-failure.json) and [current status](../reports/2026-10-12-styled-arabic-fix-status.md).

The owner authorized completing the recommended encoder/layout repair and preparing PR #146 for production merge on 2026-10-12. Success means actual styled Arabic and mixed downloads preserve the reviewed visible facts, original Unicode/digit scripts, links and usable template styling. Repeating font/tag probes or declaring the plain recovery a styled fix does not satisfy the request.

## Design

Reuse the installed fontkit/jsPDF Type3 encoding boundary and approved DejaVu Sans asset. Compose direction runs on shared lines using the explicitly approved bidi-js dependency. Shape each complete directional run before applying source-mapped styles and links. Emit complete-line ActualText together with original-scalar ToUnicode mappings, reserving each line in one font bank. The plain recovery stays independently available. Styled capture records bounded presentation attributes from the same visible DOM snapshot, excluding private/hidden content. All four templates use this route when the captured content includes Arabic; existing Latin Chromium exports remain intact.

Use the existing authenticated generate-pdf endpoint with format `styled`, captured blocks and validated presentation data. The server owns page bounds, sanitization, font integrity, page count and source encoding. No network sandbox exceptions, provider calls, database migrations, main merge or production publication are needed. Candidate changes still cancel pending output. The existing checker remains strict.

## Acceptance

- English, Arabic, mixed and multipage source captures for all four templates pass PDF.js and pypdf with complete original source/order except layout whitespace. PDFium raw output matches narrowly recorded generated direction marks, with every other scalar, digit script and source order retained. Links remain intact.
- Shared lines have real RTL glyph positioning, wrapping, template heading/body style, visible bullets, margins and page continuity; no hidden duplicate text or raster-only substitute.
- Unsupported content remains explicit; encoder support may expand only with saved-byte regressions, including marks and Arabic numeric punctuation.
- Actual preview-deployed bytes and available copy/search interactions are checked before marking the PR ready. Local bytes do not certify hosted output.
- Focused RED/GREEN tests, frontend/function types, lint, full tests, build/i18n, independent review, CI/security/preview checks pass on the final head.

Prior local feasibility now passes correct RTL layout plus complete source in all three readers when ActualText covers the entire composed line. Evidence is retained in `.superpowers/sdd/2026-10-12-styled-arabic/`.

## Investigation update

The owner approved a Typst dependency prototype; its saved bytes fail extraction and it is rejected without integration. The owner separately approved bidi-js; version 1.1.0 replaces only the styled bidi calculation. Regressions cover actual bracket outlines, nested neutral-character positions, Arabic joining and mark boundaries across inline styles/links. Native clipboard and final hosted bytes still require qualification.

PDFium requires standard direction hints around some logical punctuation. The candidate emits only generated U+200E hints in ActualText, retaining original glyph mappings. Audits must preserve raw extraction, verify each expected hint position, and keep every other scalar, digit script and source order exact except layout whitespace. Qualification must say content preserved with bidi formatting marks; it must not claim character-identical native clipboard output. Native searches for complete Latin tokens and Arabic phrases have separate receipts. Literal searches containing Arabic paired delimiters may depend on direction marks. The complete-preview checker remains unchanged.

Application head `6e4b6e116a9d7b1a6b4563d7c603c120d9e3e747` passes full CI and exact-head Netlify deployment. The browser connection recovered temporarily, then its request-header-policy loader failed again on 2026-10-14. Authenticated hosted PDF/clipboard verification remains blocked. See [current repair status](../reports/2026-10-12-styled-arabic-fix-status.md). Main is unchanged and PR #146 remains draft during qualification.
