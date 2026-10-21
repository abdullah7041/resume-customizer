# Task 2: Arabic PDF fidelity diagnosis

2026-10-05. Read-only production investigation; QA probes only. **No demonstrated portable production fix. Gate remains open.**

## Boundary and current evidence

Read Task 2 of the approved plan and the 2026-10-04 Arabic fidelity report, plus its saved independent-results.json and Arabic PDFium text. Earlier Chromium/font/tagging/bidi experiments were not repeated. Their results describe those saved bytes, not a newly tested deployed renderer.

Current code path: TemplatesSection serializes the selected DOM template and styles, submits authenticated HTML to generate-pdf.ts, which hardens a Puppeteer page, supplies direction and print CSS, waits for fonts and calls page.pdf. Chromium owns glyph shaping, ordering, ToUnicode and ActualText. The image recovery path uses html-to-image and jsPDF.addImage; it cannot restore searchable text. Browser Print shares the native print engine family and is not an independent correction. Neither model prompting nor persistence is involved in this failure.

Installed CDP PrintToPDFRequest exposes tagged PDF/document outline options but no source-text-to-glyph mapping override. Earlier tagging probes failed. No portable TTF/OTF/WOFF font assets were found in the repository. Local Windows font availability is not evidence for Netlify Linux. Installed application PDF packages are jsPDF, jspdf-autotable and pdfjs-dist; the latter extracts PDF, it does not replace the HTML print renderer.

## New installed-dependency experiment

QA script `jspdf-probe.mjs` generated `jspdf-native.pdf` (74,071 bytes) using the already installed jsPDF and local Windows Arial solely as an explicit nonportable diagnostic fixture. Three source lines: name, qualitative bullet, mixed Arabic/SQL/25%/2024. `jspdf-independent.py` extracted the same bytes with installed pypdf and PDFium and rendered `jspdf-native.png`; the image was visually inspected.

- Visible name is joined and readable. The sentence punctuation and mixed phrase layout still need bidi work.
- PDFjs returns Arabic Presentation Forms, e.g. `ﻧﻮﺭﺓ ﺍﻟﻤﺜﺎﻝ`; the bullet starts with its terminal period. It does not return the exact source strings.
- PDFium returns `المثال نورة` and reversed word order in the qualitative bullet. Mixed text returns `المثال نورة SQL 25% 2024`.
- pypdf returns presentation forms; the mixed line retains only `SQL 25% 2024` in its reported result.
- Exact sources and extractor item arrays are saved in `jspdf-native-results.json`; independent strings are in `jspdf-independent-results.json`.

This rejects a stock jsPDF text-renderer substitution as the minimum fix. Installed jsPDF source explains why: preProcessText shapes Arabic, and pdfEscape16 maps the resulting shaped character code to `font.metadata.toUnicode[t]` (dist/jspdf.es.js:21848). A ToUnicode edit alone cannot fix the independently observed reading-order failure; simple normalization in our checker would not repair reader copy/search. A presentation glyph can also represent multiple logical codepoints, so a single-codepoint remap is not a complete ligature solution.

## Exact blocker and next feasible option

The current native API provides no per-glyph logical Unicode or ordering control, and the only installed alternate writer demonstrably fails independent extraction. There is no evidence-backed small production edit under the current constraints. Do not ship string reversal, invisible duplicate text, a checker normalization bypass, a hardcoded Windows font path, or a custom PDF stream patcher.

The next feasible engineering experiment is a **separate, bounded text-renderer prototype**, starting with these same three lines, using a redistributable Arabic font and a renderer that preserves logical Unicode-to-shaped-glyph clusters, ligatures, and bidi positions. jsPDF could be the existing writer, but its default shaping/ToUnicode path needs explicit cluster-aware handling; that is a new renderer path, not a font switch. Font provenance/embedding approval and any additional shaping dependency require separate authorization. Until that experiment passes unchanged PDFjs and PDFium/pypdf checks on the actual bytes, do not port resume templates or replace native PDF generation. Failure to pass this tiny fixture should terminate that approach early.

Acceptance before production integration: exact logical name and substantive bullet, punctuation, mixed-language fact order and digits; visible connected shaping; no duplicate/invisible text; then all existing English/Arabic/mixed/multipage fixtures, actual reader search/copy/select and Netlify Linux execution. Existing DOCX/recovery and unverified messaging stay in place. No current result establishes arbitrary ATS behavior.

## Reproduction and tooling

From checkout root: `node .superpowers/sdd/2026-10-05-review-fixes-and-completion/jspdf-probe.mjs`, followed by bundled Python running the adjacent `jspdf-independent.py`. Probe intentionally names Windows Arial and is diagnostic only. Scripts and outputs remain in the new ignored QA directory; prior evidence was not overwritten. No production edits, installs, cloud writes or external requests.

CodeGraph is absent in this checkout. RTK was used for compatible reads/searches; direct PowerShell supplied exact context ranges, directory enumeration and UTF-8 QA file writes because compact RTK output omits needed context. A mistaken .mjs backend lookup was corrected to the existing .ts path. No claim depends on that failed lookup.

## Follow-up: bounded logical-mapping prototype

A second QA-only experiment now tests the proposed mapping directly, before any font/dependency request. `jspdf-logical-map.mjs` verifies that shaping each of the original three source lines and normalizing its shaped forms recovers the exact source; all clusters in these particular lines are one codepoint. After normal jsPDF text generation it changes 30 entries of `p.internal.getFont().metadata.toUnicode` from shaped presentation forms to their original base codepoints, leaving glyph IDs, widths, positions and text operators unchanged. This uses existing in-memory font metadata; it does not parse or rewrite a PDF, duplicate text, reverse strings, or change the extraction checker.

Actual `jspdf-logical-map.pdf` is 74,071 bytes. The independent script asserts **pixel-identical rendering** to stock jsPDF at the same PDFium render scale. Results:

- PDFjs now returns exact `نورة المثال`. This proves the one-codepoint mapping improvement.
- PDFjs still returns `.أعددت تقارير داخلية دون قياس للنتيجة` and `SQL 25% 2024 نورة المثال`: terminal punctuation and mixed ordering remain incorrect.
- PDFium extraction is unchanged: `المثال نورة`, reversed bullet word order, and `المثال نورة SQL 25% 2024`.
- pypdf improves to base codepoints for the first two lines but still returns only `SQL 25% 2024` for the mixed line.

Specific installed API ceiling: `toUnicodeCmap()` in jspdf.es.js:21863-21885 serializes every mapped value with `("0000" + map[code].toString(16)).slice(-4)`. It cannot express a sequence of UTF-16 code units for one glyph through this metadata hook. jsPDF's own `processArabic('لا')` produces one `ﻻ` glyph whose logical source has two codepoints. Consequently simply assigning a string or larger number to the map is truncated and cannot preserve lam-alef, let alone arbitrary clusters. The shaping event yields transformed text rather than an original-source cluster map. Fixing the serializer/cluster handling would require a plugin-owned font serializer or library modification, and **still would not solve the independent reading-order failure already demonstrated without ligatures**.

The bounded experiment therefore fails the gate and stops here. No font/dependency authorization is warranted merely to repeat this implementation; font availability is not the immediate blocker. The previous proposed renderer experiment has now been partially executed and rejected for stock jsPDF plus its metadata hook. A specific alternative must first demonstrate both logical cluster serialization and reader-consistent ordering on this tiny fixture; no production integration or additional generic architecture is proposed in this task.

Reproduce with `node .superpowers/sdd/2026-10-05-review-fixes-and-completion/jspdf-logical-map.mjs`, then bundled Python on adjacent `jspdf-logical-map-independent.py`. JSON results and PNG are adjacent. Original three source strings remain unchanged. No installs, production edits or prior-artifact writes occurred.
