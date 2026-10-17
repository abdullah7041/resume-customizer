# Arabic PDF feasibility result — 2026-10-10

## Result and boundary

A throwaway prototype now preserves all five original fixtures in PDF.js 5.7.284, PDFium 153.0.7999.0 (pypdfium2 5.13.0), and pypdf 6.10.0. Comparison permits whitespace changes only. Both PDFium and PDF.js renders were inspected and show connected Arabic, lam-alef variants, correct `SQL 25% 2024`, and the complete phone prefix. This advances the failed October 9 probe; it does not change the app or qualify production exports.

The tested layout is plain, with every run starting at the same left margin and mixed Arabic/Latin runs on separate rows. Five logical fields occupy six physical rows. A positional five-line comparison is therefore not a pass; the complete normalized source sequence is a pass in all three engines. Preserving this layout is part of the demonstrated result. Right-aligned or inline mixed layouts must not inherit the result.

## Same-byte evidence

- PDF: 34,560 bytes, SHA-256 `4ec4a0b32f2d925b6bc6b6750c92f82668037562955dee7242002cf29a667559`.
- Original sources: `نورة المثال`; `أعددت تقارير داخلية دون قياس للنتيجة.`; `نورة المثال SQL 25% 2024`; `لا لأ لإ لآ`; `+966500000001`.
- Generator: already installed jsPDF 4.2.1, plus the previously approved isolated @pdf-lib/fontkit 1.1.1 and DejaVu Sans 2.37 bytes. Font SHA-256: `7da195a74c55bef988d0d48f9508bd5d849425c1770dba5d7bfc6ce9ed848954`.
- Public fontkit glyph paths supply visible vector outlines. Quadratic curves become equivalent cubic curves. Arabic shaping remains enabled. Lam-alef glyphs are split into disjoint visible pieces with base Unicode scalar mappings; no hidden or duplicated factual text is added. Source-cluster assertions reject a mismatch.
- Type3 fonts carry ToUnicode mappings. Whole-run ActualText supplies the original logical source for PDFium. Latin runs use one visible composite glyph to avoid pypdf's RTL-to-LTR prefix loss. Bounds and advances describe the real drawing; there are no artificial zero-width fact glyphs.
- Geometry sanity check: 83 non-whitespace PDFium characters have nonempty on-page bounds. This is not verification of precise partial-word selection: ActualText distributes the run's box across its characters, and Latin runs are composite glyphs. Interactive selection still needs testing.

| Reader | Complete source in order, whitespace only | Physical rows |
| --- | --- | --- |
| PDF.js 5.7.284 | Pass | 6 |
| PDFium 153.0.7999.0 | Pass | 6 |
| pypdf 6.10.0 | Pass | 6 |

## What changed after rejected routes

Grouping glyphs preserved PDF.js word spaces. Disabling Arabic ligatures helped extraction but degraded shaping, so it was rejected. Whole-run ActualText addressed PDFium's bidi treatment. A separate pdf-lib prototype passed source extraction but used private embedding APIs; it is not the integration proposal. A jsPDF form variant exposed missing resource dictionaries and PDF.js row-boundary behavior; it was rejected. Large Latin composite advances confused PDFium ordering when text objects started at different horizontal positions. The final plain layout uses a common margin and 32-point baselines; it passes with measured glyph bounds.

The implementation uses jsPDF's existing font-serialization plugin hook and public fontkit paths, avoiding a new pdf-lib dependency and its private embedder. The production source and checker remain unchanged. No package was installed, font asset redistributed, endpoint changed, merge performed, or production deployment made.

## Reproduce locally

Ignored evidence is under `.superpowers/sdd/2026-10-09-arabic-fix/`. Run these from the isolated checkout using the existing Node runtime and bundled Python:

1. `node .superpowers/sdd/2026-10-09-arabic-fix/jspdf-vector.mjs`
2. `node .superpowers/sdd/2026-10-09-arabic-fix/jspdf-vector/extract.cjs`
3. Run `jspdf-vector/audit-probe.py` with the bundled Python containing pypdf and pypdfium2.
4. `node .superpowers/sdd/2026-10-09-arabic-fix/jspdf-vector/render-pdfjs.mjs`

The PDF, source manifest, extraction sidecars, acceptance JSON, two renders and geometry receipt are in `jspdf-vector/`. Regeneration changes PDF metadata and may change its hash; each audit checks its own saved bytes against its manifest. These ignored artifacts do not arrive in a fresh Git clone.

## Remaining engineering work

The tiny fixture has explicitly supplied directions, a single page, one regular font and fewer than 255 codes. It does not prove automatic Unicode run segmentation, diacritics/complex clusters, long-word wrapping, font-bank rollover, pagination, complete resume sections and links, styled templates, browser selection, deployed delivery, or ATS ingestion. Unsupported inputs must stay unverified; never reverse original strings, remove facts or weaken the checker to accept them.

The [proposed production design](../specs/2026-10-10-logical-text-pdf-design.md) makes a plain text PDF a separately labeled recovery choice while preserving the reviewed snapshot, authentication and existing checks. Adding the shaping dependency and production font needs explicit approval under AGENTS.md. Modern/native Print fidelity and named-system ATS results remain separate gates. The owner chose a [personal recruiter walkthrough](../../hr-pilot/owner-test.md); no independent HR participant results are claimed.
