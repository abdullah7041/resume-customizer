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

Ignored receipts and scripts: `.superpowers/sdd/2026-10-11-styled-pdf-integrity/`. Prior [same-byte source evidence](2026-10-10-text-pdf-readiness.md) remains historical and was preserved.

## Remaining qualification

Native serverless glyph coverage requires observing the new deployed renderer; a Windows browser's system fonts and mocked preparation tests cannot establish it. Native bidi extraction differences may still be held for explicit Text PDF recovery. The controller verifies the current preview after push and records the exact deployed head and actual UI outcome separately.

Independent hosted-file bytes and native clipboard/Print/Word layout remain unverified until available through supported tools. No tool installation, credential extraction, protected browser route, production publication or participant outreach was used. The owner's personal recruiter walkthrough remains distinct from empirical HR results. PR #146 stays draft; main is unchanged.
