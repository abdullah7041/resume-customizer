# Styled PDF integrity repair — 2026-10-11

Owner-approved repair to the implemented Text PDF plan. The previous actual mixed styled download (`Nora_Example_Software-Engineer (5).pdf`, SHA256 `fb42970e7e7d62684e7a99012f930aafe906f95da67e99f6a24e7b9a5c31ddda`) contained 21 NUL characters from Open Sans CID zero. Its English name passed the sampled app check because the Arabic summary was not checked.

## Changes

- Serverless Chromium receives the existing hash-verified DejaVu Sans asset after packaged font extraction and before launch. This keeps Open Sans and the existing Latin layout; no network exception or new dependency. Read, integrity, directory and write errors fail before launch. Local native browser selection is unchanged.
- Both styled and reviewed Text PDF exports use the complete cleaned visible preview rather than sampled resume fields. Every visible block is checked, including summary, all bullets, education, skills and displayed links. NUL/replacement characters or changed digit scripts fail closed. Layout whitespace, NFC, template capitalization and bidi formatting controls are normalized; other source scalars remain intact.
- The badge records complete block presence. Global reading order and link annotations have separate full-source production matrix tests; it does not certify arbitrary ATS systems.

## Evidence

| Gate | Receipt |
|---|---|
| Font preparation | Five RED regressions; 54 focused function tests GREEN; real bundled asset bytes/order, pooled reuse, local exclusion and four failure boundaries. |
| Client export/checker | Five RED regressions; 112 focused tests GREEN, including candidate review, hidden/private exclusions, stale responses, summary/all-section omissions and exact digit scripts. |
| Current production Text PDF matrix | All 16 English/Arabic/mixed/multipage cases across four templates regenerated through the authenticated endpoint fixture and accepted by the stronger checker. Full source, order and link assertions also pass. No historical capture was overwritten. |
| Independent saved-byte readers | All 16 retained complete production captures freshly re-read in PDF.js 5.7.284, pypdf 6.10.0 and pypdfium2 5.13.0, with exact source except layout whitespace. The stronger checker accepts each full preview and rejects the actual corrupt styled download even with only an English-name expectation. |
| Static validation | Both task touched-file lint and frontend/function types pass. The controller's source-wide lint excludes ignored `.superpowers` QA scripts; the ordinary invocation's historical scratch-script diagnostics are retained separately. |
| Review | Fresh task reviews approve both spec and code quality. Final integration review and current remote CI/preview receipts are recorded in the repair ledger. |

## Deployed receipt

Application head `8232fcbf1a8f8bda2fbe759d825f96d88d98c56e`: [CI 38157985783](https://github.com/abdullah7041/resume-customizer/actions/runs/38157985783) passes lint, frontend/function types and all 227 test files: 2,457 tests passed, three skipped, 103.87 seconds. GitGuardian, Netlify headers/redirects and preview checks pass. The visible preview drawer confirms deploy `6acbc0e5e0c1ac0008c95d65` for that head. The subsequent receipt-only documentation commit changes no application or test code.

Using the existing authorized Brave session, Riyadh English reaches **Selectable text checked**. Qiddiya with an English name and the exact mixed summary that formerly escaped the sampled check now correctly reaches **unverified**. Explicit plain-content review shows every displayed fact/link; **Download Text PDF** then reaches **Text PDF — selectable text checked** with the stronger complete-preview gate. Screenshot: `.superpowers/sdd/2026-10-11-styled-pdf-integrity/hosted-text-pdf-checked.jpg`. Original summary, name, English UI and Riyadh template were restored; credits stay 18/20. No feedback, paid AI call or outreach was submitted.

Ignored receipts and scripts: `.superpowers/sdd/2026-10-11-styled-pdf-integrity/`. Prior [same-byte source evidence](2026-10-10-text-pdf-readiness.md) remains historical and was preserved.

## Remaining qualification

The deployed renderer succeeds, establishing delivery and successful execution of its font-preparation boundary. The mixed styled file still fails the complete text gate; native Arabic glyph/extraction fidelity is not qualified. It remains explicitly unverified with candidate-reviewed Text PDF recovery, whose deployed check passes.

Independent hosted-file bytes and native clipboard/Print/Word layout remain unverified. Documented English/unverified-styled/Text PDF download observers return no path, and no new matching PDF appears in Downloads. The page asset capability sees the endpoint but cannot bundle its unsupported response kind. No alternate browser/credential access was used. No tool installation, protected browser route, production publication or participant outreach was used. The owner's personal recruiter walkthrough remains distinct from empirical HR results. PR #146 stays draft; main is unchanged.
