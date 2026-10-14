# Styled Arabic PDF repair status

PR: https://github.com/abdullah7041/resume-customizer/pull/146

Repair continued on 2026-10-13 in the attached `candidate-evidence-pilot/resume-customizer` worktree, branch `codex/candidate-evidence-pilot`, starting head `6aece19254b0da379da3ad42d0c6a5eb01c4efdb`. Application repair `6e4b6e116a9d7b1a6b4563d7c603c120d9e3e747` is committed and pushed. Main and unrelated untracked documents are preserved. CI and deployment pass; authenticated hosted-file qualification is still blocked, so this receipt does not declare production readiness.

## Final implementation

Arabic content uses the existing fontkit/jsPDF encoder through the authenticated `generate-pdf` endpoint. Capture binds source blocks, inline emphasis, colors, chip gaps, spacing and margins to the same reviewed snapshot. Stale attempts cannot save. The approved DejaVu font, request/page bounds, safe links and complete-preview checker remain enforced. Latin Chromium exports and explicit Text PDF recovery remain available.

The explicitly approved `bidi-js@1.1.0` supplies styled embedding levels, visual positions and mirrored outlines. Neutral RTL characters receive individual positions, including nested brackets. Each complete directional run is shaped before styles and links are applied, preserving joining, ligatures, marks and original advances. Outline bold/italic and color changes retain a complete script text object. Optional Latin ligatures are disabled so an inner character's emphasis or link cannot disappear. Zero-advance linked marks use the containing cluster's visible bounds.

PDF.js otherwise coalesces Type3 script runs with a generic font name and reverses short mixed LTR source. Distinct styled script font banks and proper font descriptors prevent that merge. Each direction is reserved for the entire line, preserving Arabic source at bank boundaries. Per-glyph Latin encoding prevents PDFium merging unrelated rows; individual Arabic-digit objects preserve numeric order in pypdf.

PDFium needs narrowly generated U+200E direction hints in complete-line ActualText around mirrored punctuation. Visible glyph mappings retain the original scalars. Hints surround complete Latin tokens, preserving literal URLs, identifiers and dates, or precede mirrored punctuation within an Arabic token. Raw extractions and every expected hint position are retained. Qualification is **content preserved with bidi formatting marks**, not character-identical clipboard output. No blanket invisible-character removal, hidden duplicate text, raster substitute or weaker application checker is introduced. Literal searches including Arabic delimiters can depend on these marks; ordinary phrases and complete Latin-token searches pass.

## Current evidence

- Final encoder: 54 saved-byte/validation tests pass, including drawn bracket outlines, nested punctuation positions, joined Arabic/diacritic style boundaries, mixed LTR order, inner-ligature links and positive mark-link rectangles.
- Final endpoint: 29 tests pass, including authenticated bounded styled requests and malformed presentation/geometry rejection. Client/capture files pass 105 tests.
- A combined Windows run hit cold-import and large-reader timing limits, with a following mock contaminated by the timed-out import. Fresh isolated endpoint and encoder runs pass. The existing large plain-reader fixture retains exact assertions with a 90-second reader allowance; generation of its 310 rows was measured at 9.6 seconds. Full CI subsequently passes on the application head.
- [CI 38521106557](https://github.com/abdullah7041/resume-customizer/actions/runs/38521106557) passes normal lint, frontend/function types and 227 test files: 2,482 tests passed, three skipped, 116.84 seconds. GitGuardian passes on the same head. Local source lint excludes ignored historical `.superpowers` QA scripts; CI does not contain those files. Final local build and translations pass.
- [Netlify deploy 6acf1de5543aa2d9a1373642](https://app.netlify.com/projects/resume-optimizing/deploys/6acf1de5543aa2d9a1373642) reports ready, deploy-preview context, and the exact application commit_ref. Preview/header/redirect checks pass. Its immutable URL returns HTTP 200, the application root, nosniff and DENY headers. This verifies deployment identity and public delivery, not an authenticated PDF response.
- All 16 English/Arabic/mixed/multipage production-template captures pass PDF.js complete source/order/link assertions and the unchanged checker. Final retained run: 93.85 seconds. Multipage files have seven pages.
- All 26 same-file native audits pass pypdf with original source except layout whitespace and PDFium with exactly the recorded generated hints. They also retain links, valid scalars, bounded pages/character boxes and native query receipts. Queries include `(2020)`, `[SQL]`, `عن بعد`, a complete parenthesized URL, `id(x)`, `ABC123`, Arabic marks and digit scripts. The tracked reader receipt contains file hashes and results; raw text/hint positions are retained locally.
- Fresh scoped independent review confirms the final layout, joining, source, style/link and descriptor corrections, with no remaining code blocker identified.
- Neither bidi-js nor its existing transitive require-from-string package appears in npm audit findings. Existing repository audit findings are outside this dependency change; this is not a blanket security claim.

## Remaining release work

Check actual authenticated hosted exports and available native copy/search interactions before marking the PR ready. The browser connection recovered temporarily on 2026-10-13, but on 2026-10-14 both session setup and one inventory retry return `Unable to load browser request-header policy`. Supported troubleshooting guidance provides no repair for that loader failure. No security-policy bypass, alternative browser credential extraction or weaker release claim was attempted. The owner has been asked to reconnect the Brave/Codex connection; independent CI and public deployment qualification are complete. Main merge remains a separate action.

## Rejected prototype and tooling

The approved Typst prototype failed complete Arabic extraction in PDF.js, pypdf and PDFium across RTL/LTR, tagged/untagged, PDF/A-3u and ligature configurations. It is rejected and absent from the app's manifests; its isolated ignored receipts remain available.

Owned raw receipts and retained PDFs: `.superpowers/sdd/2026-10-12-styled-arabic/`. The worktree has no CodeGraph index. Context7 has no matching bidi-js index, so its [official README](https://github.com/lojjic/bidi-js) was used. Fontkit feature overrides were verified against Context7's [upstream API documentation](https://github.com/foliojs/fontkit#fontlayoutstring-features---). The installed PDF.js evaluator supplied the exact font-coalescing condition. Direction-mark comparison follows [Unicode UAX #9](https://www.unicode.org/reports/tr9/). React Doctor is not installed; no unauthorized tool installation occurred. Narrow PowerShell reads replaced unsupported or truncated RTK reads.
