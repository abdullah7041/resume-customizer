# Text PDF recovery: local readiness evidence (2026-10-10)

**Status:** The candidate-reviewed plain Text PDF path is locally implemented on `codex/candidate-evidence-pilot`. Its exact saved production-capture bytes pass full-source comparisons in PDF.js 5.7.284, pypdf 6.10.0 and pypdfium2 5.13.0. This is a local renderer/endpoint result. Authenticated hosted download, actual browser copy/search/select and owner review remain open, so the engineering milestone is not closed.

## Production capture and readers

The existing `candidate-trust-flow.test.tsx` renders each of the four real template components from fictional resumes, clones the visible preview, captures ordered text/link blocks, and sends those blocks through the production text branch of `generate-pdf`. The expected string is every captured run joined in DOM order. The harness checks it against the visible snapshot, checks the raw candidate facts and two-job association, then compares the complete saved PDF.js extraction with only whitespace removed. The independent script hashes those **same saved bytes** and compares full pypdf and PDFium extraction with the same whitespace-only rule. It asserts all safe annotation URLs, 1–20 pages, nonempty valid on-page character boxes, all 16 cases and more than 255 encoded pieces in each multipage case. It never rewrites a source fact or suppresses a reader mismatch.

The full audit receipts and fictional PDF/PNG files are retained outside Git at `.superpowers/sdd/2026-10-10-logical-text-pdf/evidence/production-capture/manifest.json` and `independent-readers.json`. These hashes identify that saved local run; regenerating a PDF can change its metadata and hash. Every row below passed all three source comparisons, link and geometry assertions.

| Case | Pages | Encoded pieces | Saved PDF SHA-256 |
| --- | ---: | ---: | --- |
| English / modern professional | 1 | 25 | `2e45cb9b8dd743a4f2ad33b5766aba0987fc0a7875f84ceec9eda3162e4e09e7` |
| Arabic / modern professional | 2 | 96 | `421e0bad0200eedcc034cea07dbf85caa3cfe307c52b562555113a63d7437f23` |
| Mixed / modern professional | 1 | 81 | `2ab9df1d9f0d7d070e003c8e81b02d0b40ddd5072aef3084895e9fa165c422a0` |
| Multipage / modern professional | 10 | 363 | `b0f707d232ee54c8582ab712d53fc9554b5faba245c98b9bf4b8889b32fba1eb` |
| English / technical engineer | 1 | 24 | `557d19d79f07213b2a59bc84d85f67411a4530afb21fa563e271aebf234b08a9` |
| Arabic / technical engineer | 2 | 95 | `3b6e44cd8e056745eda1ebaf1be93d3e4b106396b5fde2cf722c80f2de7d15b8` |
| Mixed / technical engineer | 1 | 80 | `b75fd4e1c8271d0fa5177cb54c6d9df88053a9759877755e1d71816c9e9acb6a` |
| Multipage / technical engineer | 10 | 362 | `568d174d0227caabaed2819026f8894c08e955c6bbd52e8ea5782199a1e3292c` |
| English / ATS optimized | 1 | 24 | `eecd62342bbf27981ccf6cf0ddbb0e303f05531aebd4b4f81d43297c88241d3b` |
| Arabic / ATS optimized | 2 | 96 | `0a28f67325bd2ed53f6b35c175c30433e4665ab92e7cb6f771ab7c7146b2b365` |
| Mixed / ATS optimized | 1 | 81 | `79404512ac64438cd2848aec2889824e6bc91463738835736ffbfa8b7cf53789` |
| Multipage / ATS optimized | 10 | 363 | `4d3c273dbda66da4782e815f0a7ec78b60d1750671c908d44f41730485dba171` |
| English / executive professional | 1 | 24 | `44a7a9d980968cd46c6a678a22c2a268c22b412fb84a4c77eb11f756c89dbfd9` |
| Arabic / executive professional | 2 | 97 | `601d18ff681cd29feb5d1e5a97209c75aeeb131c58a75a231b38099cf63e4ddf` |
| Mixed / executive professional | 1 | 80 | `06aa67ba0341858e4b729574eacf71f1db129f23920eaa84d1054ec7ba9bc6fd` |
| Multipage / executive professional | 10 | 362 | `c295d051a642ae4010820be53e08a442025621518d52e6b12988d9435759458f` |

The complete captures cover the visible name, role, city, email, `+966500000001`, website/GitHub targets, summary quote `"SQL 25% 2024"`, Arabic-Indic `٢٥٪ ٢٠٢٤`, lam-alef and supported marks, both employers/roles/dates/bullets, university, degree, area and skills. The long case uses 275 distinct numbered project bullets; its second employer remains after them. Source resume fields omitted by a template are recorded as projections in the manifest, not inserted into the PDF. The checks apply to the exact **visible captured content**. The separate named ATS ingestion gate is open.

PDF.js and PDFium page images were inspected side by side for English modern, Arabic technical, mixed executive and the first/last multipage pages. Both showed the same visible facts, connected Arabic words, page continuity and no clipping on the inspected pages. The plain recovery layout intentionally places some Arabic punctuation and numerals on separate rows. It is visibly different from the styled resume; candidate review of the plain preview remains required. Valid character boxes are a geometry sanity check only: they do not establish word/line hit areas or actual copy/search/select interaction.

## Unsupported content and open gates

Combined Arabic mark clusters that the shaper cannot map truthfully and unsupported scripts/compatibility ligatures still fail closed with `pdf/text-unsupported`; source strings are not normalized into a pass. The saved regression for ASCII `-` followed by optional whitespace and Arabic-Indic or Eastern Arabic numerals likewise returns 422 because PDFium substitutes U+FFFE. This includes negative values and ASCII-hyphen ranges/dates with those numeral sets. The UI warns before export and retains other recovery choices. Decimal/group separators, Eastern numerals, parentheses and plus signs are represented in focused saved-byte tests; the complete fictional resume audit above establishes the production-captured combinations shown in its manifest.

The authorized browser inventory/retry failed to load its request-header policy and also timed out on Statsig. No bypass, credential request or alternate browser path was used. Therefore actual browser selection, copying and search for Arabic words, lam-alef, mixed text and phone prefix remain **unverified**. The authenticated deployed preview/download must be exercised and its delivered bytes audited before claiming hosted delivery. Styled PDF, native Print, Word/LibreOffice interaction, named ATS parsing and the owner's personal recruiter walkthrough are separate outcomes; no formal HR participant result exists. Branch review, push, CI/GitGuardian/Netlify and exact preview SHA are controlled in the final handoff, not claimed by this local report. Main merge and release remain the owner's decision.

## Checks

Focused production capture: `WRITE_TEXT_PDF_ARTIFACTS=1 npm test -- src/__tests__/candidate-trust-flow.test.tsx netlify/lib/__tests__/text-pdf.test.ts --no-file-parallelism --reporter=dot -t 'captured production Text PDF|logical text PDF|text PDF request'` — exit 0, 37 passed/9 skipped. Independent same-byte reader audit — exit 0, 16/16 cases and all asserted flags. `npm run lint -- --ignore-pattern '.superpowers/**'` — exit 0, no tracked-code diagnostics. `npm run type:check`, `npm run build` and `npm run i18n:validate` — each exited 0; the build retained existing CSS, `node:zlib` and dynamic-import warnings. The earlier unadjusted `npm run lint` exited nonzero because it traversed ignored `.superpowers` QA scripts (108 errors, four warnings); that raw receipt is retained.

The first full serial `npm test -- --no-file-parallelism` exited 1 with 2,441 passed, two failed and two skipped. One failure was a redundant quote-sensitive static auth test, removed after the real handler auth test passed. The other was an intermittent adaptive-clarification option reset outside the PDF path; its isolated and 91-test file reruns passed. The [Task 3 report](../../../.superpowers/sdd/2026-10-10-logical-text-pdf/task-3-report.md) retains the failure and focused-check details.

**Verification addendum, 2026-10-11 (Riyadh):** The justified final serial rerun exited 0: 227/227 files passed, 2,442 tests passed and two skipped in 749.82 seconds. It emitted Node's `DEP0205` warning about deprecated `module.register()`. The passing rerun closes the local test gate; it does not establish hosted/manual acceptance or resolve the clarification reset review question.
