# Task 1 — actual Arabic PDF fidelity diagnosis

Date: 2026-10-04 (Asia/Riyadh). Checkout: `candidate-evidence-pilot`, baseline `4c422ab`.

## Result

English facts and sampled multipage order pass fresh production-renderer checks. Arabic and mixed logical text fidelity remains **unverified/failing in tested extractors**, with visible Arabic text retained. No Arabic string reversal, checker weakening, font substitution, runtime flag or PDF workaround was shipped. The browser-print contact URL fix was independently reproduced in this isolated checkout.

## Data flow and root-cause evidence

`TemplateRenderer` + registry templates and current built CSS → existing fictional trust fixtures → production `generate-pdf` handler (only auth/rate-limit mocked) → installed Edge 154.0.4258.53 native PDF → actual bytes → pdfjs `getTextContent` + installed pypdf and bundled PDFium. Network subresources were blocked by the actual renderer sandbox; no model/network-provider calls, real personal data, database changes, installations or cloud writes.

Fresh English/Arabic/mixed/multipage outputs: 1/1/1/4 pages, 72099/117116/87537/117157 bytes. Repeated bytes match earlier fixtures because static PDF generation is deterministic; artifacts were freshly regenerated from this checkout, not copied from the old active checkout. The harness writes to its established ignored task-9 artifact path; this task also copied those newly generated PDF/HTML outputs into its own ignored `pdf-fidelity` directory.

Arabic actual embedded fonts include `TimesNewRomanPS-BoldMT`/`TimesNewRomanPSMT` (fallback for Georgia) with present `/ToUnicode` streams. Their glyph mappings include Arabic Presentation Forms. pdfjs emits visual-order RTL glyph chunks (e.g. `ل`, `ﺎ`, `ﺜ`, `ﻤ`, `ﻟ`, `ا`); joining them does not reconstruct `نورة المثال`.

The diagnosis is **not missing Unicode metadata alone**: Arabic page content has 162 `/ActualText` spans containing base Arabic codepoints and 42 `/ReversedChars` marked sequences. Installed pypdf returns presentation-form text with reversed word order. Independent bundled PDFium consumes base-codepoint ActualText but still returns inconsistent logical order (`المثال نورة`, `ةسدنهم`, and reversed substantive words). Arabic name, employer, qualitative bullet, and metric cannot be certified as logical searchable/copyable text in these tested paths. PDFium can extract email/phone/personal/GitHub URL facts. English fixture facts pass pdfjs; multipage labels 1, 10, 45 remain ordered in pdfjs. Existing checker correctly keeps Arabic/mixed PDFs unverified.

The same failure occurs in a minimal two-paragraph Arabic document with no app renderer or stylesheet, narrowing it to native PDF emission/extraction interoperability. QA-only Arial, Segoe UI, Tahoma, zero letter spacing/normal kerning, plaintext bidi, and Puppeteer `tagged: true`/`false` probes do not yield logical Arabic text in pdfjs. These did not become production changes. Windows fonts are not assumed available in Netlify Linux.

Skia source confirms native PDF emission can write ActualText when glyph and source-codepoint mapping differs: [SkPDFDevice.cpp](https://skia.googlesource.com/skia.git/+/717da7f78dffe3ed8930274fb74a650e7ddae4d9/src/pdf/SkPDFDevice.cpp). This supports interpretation of observed bytes; it does not prove every PDF reader reconstructs reading order.

## Visual samples

Fresh pages rendered with bundled PDFium: Arabic page 1, mixed page 1, multipage page 4 inspected. Sampled Arabic names/bullets remain legible; final page retains detail 45, second employer and education with side margins and no horizontal clipping. Existing presentation limitations remain: English headings on Arabic resume, crowded adjacent contact URLs, date/punctuation bidi and English punctuation in an RTL mixed document. These samples do not certify every glyph, complete reading order, arbitrary templates or browser/ATS behavior.

## Reused browser-print fix

Read-only inspection of the active old checkout showed only the previously approved URL retention changes in `src/services/exportPdf.js` and its tests. Those two changes were copied into this isolated checkout: preserve personal/profile URLs in canonical header and both print variants, deduplicate visible contacts, preserve legacy LinkedIn and escaped inert URL text. No old files were edited or staged. Actual native browser Save as PDF was **not rerun in this task**; the old report remains earlier evidence and must not be presented as current verification. New scoped tests cover both HTML variants independently.

## Verification and runnable evidence

- `npm test -- src/services/exportPdf.test.js src/__tests__/MainContent.test.jsx --no-file-parallelism`: 2 files / 100 tests passed, exit 0.
- `WRITE_TRUST_ARTIFACTS=1 npm test -- src/__tests__/candidate-trust-flow.test.tsx --no-file-parallelism`: 1 file / 7 tests passed, including fresh actual production-handler PDFs/DOCX, exit 0. This intentionally asserts Arabic state remains unverified; it is not a logical-fidelity pass.
- `npx eslint src/services/exportPdf.js src/services/exportPdf.test.js`: exit 0.
- `git diff --check`: exit 0 at time run (parent's simultaneous owned changes not reviewed).
- Current production CSS from parent's initial successful build was used. Parent owns final type/full gate/build verification.

QA directory: `.superpowers/sdd/2026-10-04-candidate-evidence-pilot/pdf-fidelity/`: actual PDF/HTML files, pdfjs items/font mappings JSON, independent-results JSON and PDFium extracted text, PNG visual samples, minimal font/tagging probes, `independent.py` and `inspect.mjs`. Bundled Python runs `independent.py`; repository Node runs `inspect.mjs <pdf-path>`. `pdftoppm` is installed, but adjacent Poppler binary directory contains only `pdfinfo.exe` and `pdftoppm.exe`, **no pdftotext.exe**; bundled pypdf/PDFium substituted without installation. CodeGraph is absent in the chosen checkout; scoped RTK/direct PowerShell reads used. `RTK.md` absent there.

## Outstanding release gate

Exact Arabic substantive text search/copy/select and full mixed reading order remain unverified. Actual deployed Netlify Linux Chromium, native manual reader copy/search, arbitrary browsers/ATS, and additional templates remain unverified. A portable rendering/extraction correction with actual bytes and reader checks is still required before calling Arabic PDF text fidelity complete. The candidate evidence report/pilot tests cannot establish HR screening reliability or fix this export limitation.
