# Logical text PDF recovery — proposed design

Status: approved by the owner on 2026-10-10, including the package and font scope; not implemented. User intent: finish Arabic/mixed export engineering while preserving source facts and candidate review. The small feasibility gate now passes; [evidence and limits](../reports/2026-10-10-arabic-pdf-feasibility.md) identify exactly what passed.

## Choice and tradeoff

Add a clearly labeled **Text PDF** recovery choice for exports whose styled PDF fails the text check. Use the demonstrated plain layout, one shared left margin, and separate rows for Arabic/Latin runs when needed. Keep the full candidate-reviewed visible content and links, but show a plain preview before download. This is a different delivery layout; it does not qualify the styled PDF or native browser Print.

Alternatives considered: continue native Chromium CMap/font experiments (existing failures give no justified quick fix); use a different PDF library (the latest pdf-lib prototype passed the small source gate but needs a second dependency and private APIs); reuse installed jsPDF with a shaping package (recommended: public glyph paths and the demonstrated encoding). No additional PDF container, bidi package, hidden text layer or custom patcher is proposed.

## Flow and boundaries

1. Keep TemplatesSection's existing export preflight and exact composed resume/preview snapshot. Collect text blocks from that captured, cleaned visible DOM in document order, preserving headings, job/date associations, bullets, displayed text and safe link targets. Do not read mutable stores after capture or silently add fields absent from that reviewed snapshot.
2. Show the plain recovery preview for candidate review. Preserve every source scalar apart from documented layout whitespace; do not translate, summarize, reorder facts, infer qualifications or include unselected private answers. Any changed snapshot invalidates that preview.
3. Extend the existing authenticated `generate-pdf` endpoint with a discriminated text-layout request. Validate block types, finite numeric layout values, safe URLs, maximum text size and the existing 20-page client limit. Keep authentication, rate limiting and current native-renderer behavior. Structured strings are encoded as PDF hex values, never injected as PDF operators. No external asset request, database write, AI call or sensitive-content logging is introduced.
4. Server-side text rendering reuses installed jsPDF and adds pinned **@pdf-lib/fontkit 1.1.1**, the version tested in isolation. Bundle DejaVu Sans with its required license notice and a verified hash. Use regular/bold assets only after their separate fixture validation. Package installation must occur in this worktree's own modules, preserving its current shared junction target.
5. Shape direction runs with fontkit; reuse a suitable existing bidi implementation only after verifying its Unicode behavior against mixed fixtures. Original logical strings remain immutable. Word wrapping happens at source boundaries and shapes each output row independently. Unsupported scripts/clusters, missing glyphs or failed source-cluster assertions fail closed with the existing recovery message.
6. Emit visible Type3 glyph paths, truthful bounds/advances, ToUnicode and original-source ActualText as demonstrated. Keep Arabic joining/lam-alef shaping. Cache repeated glyphs and create another font bank before exceeding the 8-bit code range; never drop overflow text. Maintain all rendered factual sections and safe clickable links through pagination.
7. Return the same PDF response contract. Keep `isCurrentExport`, `checkPdfBlob`, timeout and recovery handling. A passing check means text was checked, not universal ATS compatibility. Do not auto-download an unverified output or silently substitute this layout for styled PDF.

Frontend boundary: TemplatesSection and its focused tests, plus the shared text-block collector/preview. API/validation boundary: generate-pdf's optional text-layout branch and focused endpoint tests. Rendering boundary: one focused text-PDF helper and bundled font assets/notices. Persistence boundary: none; use the existing approved-snapshot identity without new stored state.

## Required acceptance before enabling recovery

- The original five fixtures pass unchanged in PDF.js, PDFium and pypdf from the same bytes; only whitespace differences are permitted. Inspect both PDF.js and PDFium renders for connected shaping, complete text and no clipping/duplication.
- Extend to English, Arabic diacritics and lam-alef combinations, Arabic/Latin digits, punctuation, percentages, dates, phone prefixes, email/URLs, alternating scripts and long text. Every supported case must preserve original scalars, run order and exact factual associations. Any unsupported case must produce an explicit recovery state rather than a misleading checked result.
- Generate a complete reviewed English, Arabic and mixed resume, plus a multipage case with numbered bullets and more than 255 unique encoded pieces. Compare every displayed field and link against the exact captured source. Check page margins, section/job boundaries and selectable character/word/line geometry, including manual copy/search/select in a browser PDF reader.
- Confirm stale requests cannot publish or download, unsupported inputs retain recovery, font-loading failures do not erase content, and existing authentication/rate-limit behavior remains. Do not weaken the existing fidelity comparison.
- Run focused exporter/endpoint/component tests and types after changes, then separate lint/types/serial tests, build and translation validation for the cross-cutting release candidate. Verify the exact preview SHA and actual authenticated output. Keep main merge/production release separately authorized.

## Definition of completion

Close this engineering milestone only when the plain recovery path passes the extended fixtures, full-resume checks and authenticated preview output checks above. A tiny prototype or green CI cannot close it. Styled Arabic PDF and actual native Print remain explicitly unverified until separately demonstrated. Named ATS ingestion is an observed compatibility test if an authorized environment becomes available, not a precondition for claiming that the tested readers preserved text.

Owner testing is a separate personal walkthrough using the [worksheet](../../hr-pilot/owner-test.md). Formal HR recruitment/results are deferred at the owner's request; no participant data or outreach is introduced by this renderer change.
