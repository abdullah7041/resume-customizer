# Styled PDF integrity repair

Approved by the owner with “Go ahead and fix it” after the font and shared-check proposal. This is a bounded repair to the implemented Text PDF plan.

## Global Constraints

- Work only in the existing isolated candidate-evidence-pilot checkout and codex/candidate-evidence-pilot branch. Preserve unrelated changes and historical PDF evidence.
- Reuse the approved bundled DejaVu Sans font and installed libraries. No dependency, external tool, configuration installation, network exception, string reversal, hidden factual layer, or production release.
- Keep authentication, rate limiting, immutable composed preview, stale-request protection, explicit candidate review, recovery and no-download-on-unverified behavior.
- Preserve source scalars, numbers and links. A passing text check is evidence for the checked output, never a universal ATS claim.

## Task 1: Provision the styled renderer's Arabic font

Read generate-pdf.ts and its runtime/security/budget callers/tests before choosing the smallest fix. The hosted Chromium default Open Sans font has no Arabic coverage. Current mixed styled PDF uses CID zero for 21 Arabic characters; the approved DejaVu Sans asset covers these characters. Installed @sparticuz/chromium has no chromium.font API.

Provision the existing bundled font for native serverless Chromium before browser launch, using its existing fontconfig font directories and Node filesystem APIs. Confirm the actual packaged fonts.conf/source directory behavior. Keep local development behavior, pooled browser reuse, render budget, security interception and asset packaging intact. Font failures must not silently produce a successful missing-glyph PDF. Do not widen the network sandbox or force a new font on Latin text. Prefer a few changes in generate-pdf.ts to a new service/helper.

Use TDD for the native runtime selection/font preparation boundary. Cover that the asset is available before launch, repeated exports retain it, local native browser remains unaffected, and failure does not yield PDF success. Run focused function tests, touched-file lint, and type check. Commit only task files and write the report with RED/GREEN evidence.

## Task 2: Check the complete visible preview

Read every expectedPdfText/comparePdfText/checkPdfBlob caller, textPdfSnapshot.ts and focused tests. Replace the sampled source-field list in the shared checker with complete visible strings from the exact cleaned captured preview. Reuse captureTextPdfBlocks/cloneVisiblePdfPreview rather than adding a second visibility walker or enumerating resume fields. Keep the public call interface compatible where practical. Include summary, every bullet, education, skills, visible contact/link labels and composed details without requiring hidden/private/non-exported text. Reject extraction containing NUL or replacement characters, even when the sampled names still match. Preserve exact digit scripts; whitespace, NFC, case applied by templates and bidi formatting controls may be normalized. Do not remove meaningful punctuation, reverse strings or normalize changed factual digits into a passing result.

Use TDD for the reproduced Arabic-only summary corruption behind an English name, lost non-first bullets/education/skills, invalid extraction characters, exact numeral scripts, and cleaned hidden/private exclusions. Check both styled and Text PDF call paths continue to hold unverified output and preserve candidate review/stale protection. Run focused shared/checker and export tests, touched-file lint and type check. Commit only task files and write the report with RED/GREEN evidence.

Include the existing captured production Text PDF matrix in the stronger check: extend its assertions to call expectedPdfText(resume, snapshot) and comparePdfText(audit.text, expected), alongside its existing full scalar/order/link tests. Its PDF.js extraction inserts layout whitespace around script changes, punctuation and combining marks; the accepted renderer contract allows layout whitespace only. Whitespace normalization must therefore handle those boundaries without discarding non-whitespace scalars or weakening digit-script checks. Run that focused matrix without overwriting historical retained artifacts.

## Acceptance

Fresh independent task reviews and one final review of this repair. Regenerate English, Arabic and mixed styled fixtures; inspect the same bytes with PDF.js, PDFium and pypdf. Preserve any remaining native bidi extraction differences as an explicit unverified recovery state; never weaken the checker to qualify them. Recheck the reviewed Text PDF path against the stronger checker. Update the readiness receipt with exact evidence and limits. Push the existing draft PR branch and verify its current CI and preview; do not merge or release main. Native Word/Print/clipboard checks remain unverified unless actually observable through supported tools.
