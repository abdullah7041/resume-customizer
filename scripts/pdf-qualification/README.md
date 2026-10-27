# Historical Arabic PDF reader regression

This harness preserves the synthetic saved-byte fixtures and reader behavior investigated after PR #146. On 2026-10-27 the owner requested that the Arabic character-order issue be considered resolved. The historical failure receipts and exact comparison rules remain unchanged; closing the issue by owner acceptance does not represent a new renderer change or reader pass. Selectable PDF export now supports signed-out users.

## Reproduce

Run from the repository root using a separately prepared reader directory containing `python/` and `node_modules/`. Reuse the existing isolated readers; the application dependencies and lockfile are unchanged.

Required reader pins: PDF.js **6.4.299**, pypdf **6.21.1**, pypdfium2 **5.14.0**, native PDFium **156.0.8076.0**, build **8076**. Set `PDF_QUALIFICATION_READERS` to that directory. Python and Node must be available.

```powershell
$env:PDF_QUALIFICATION_READERS = 'C:/absolute/path/to/isolated/readers'
python -X utf8 scripts/pdf-qualification/audit.py --selfcheck
python -X utf8 scripts/pdf-qualification/audit.py scripts/pdf-qualification/fixtures/cases.json
```

The selfcheck must exit **0**: the correct-source PDF passes, wrong-source and wrong-hash PDFs fail, and NFC equivalence cannot promote an exact-source mismatch. The fixture audit currently exits **1**. Four Arabic/mixed cases fail; the English `SQL` control passes. Expected empty link/search lists on minimal controls do not constitute coverage.

The audit compares original Unicode after removing only whitespace, executes literal native searches, checks actual returned match text, enforces manifest hashes, loads identical saved bytes in every reader, retains raw extraction and checks expected links. NFC and bounding boxes are diagnostics. It does not certify appearance, native GUI selection or clipboard, Print, Word, hosted rendering or arbitrary ATS systems.

## Fixtures and observed failure

All five PDFs are synthetic controls retained from the investigation. `fixtures/cases.json` records their original expected text and SHA-256. `fixtures/expected-failure.json` is a compact receipt from the pinned-reader audit.

- `سَّل`: native extraction changes original mark ordering.
- `ع[SQL]`: native punctuation reconstruction breaks literal `[SQL]` search.
- `اسم foo`: native extraction puts the Latin run before the Arabic run.
- `SQL`: English positive control.
- The original saved mixed-language résumé: pypdf 6.21.1 and PDF.js preserve its complete source, while PDFium fails order and literal `[SQL]`, `عن بعد`, `السَّلَامُ` searches. The three expected links pass. Its 68,656 bytes retain SHA-256 `218ea37a3451efcb73df3642ed89c8648bde258dc1af413f46bd50aa59c6f7e8`.

The older pypdf 6.10 punctuation result is superseded for these bytes by the current 6.21.1 result; the native failure remains. Provider success, a readable screenshot, the application PDF.js badge and green CI do not qualify the defect as fixed.

## Criteria for any future qualification claim

1. Demonstrate a supported producer construction that passes the reduced cases and the exact résumé paragraph in all three readers, retaining original source, glyph positions and useful searches.
2. Preserve `generate-pdf` validation, font integrity, links, reviewed snapshot identity and stale-save protection when integrating any correction. Qualify renderer changes in isolation before application integration.
3. Pass both paragraph directions, inline styles/links, wrapping, multipage, every production template, actual Brave search/selection/clipboard, and guest and authenticated saved download bytes.
4. Run the appropriate application checks and report exact reader/runtime versions and saved-byte hashes. Only then describe the Arabic PDF defect as fixed.

No reversed source/replacement strings, hidden duplicate text, fake selection geometry, source normalization, weaker assertions or raster substitutions. Older evidence remains available in Git history: the [hosted failure receipt](https://github.com/abdullah7041/resume-customizer/blob/abf7a3a420e5f0a1100a927a98b758cc09cd3765/docs/superpowers/reports/2026-10-15-styled-arabic-hosted-failure.json) and [repair-status report](https://github.com/abdullah7041/resume-customizer/blob/abf7a3a420e5f0a1100a927a98b758cc09cd3765/docs/superpowers/reports/2026-10-12-styled-arabic-fix-status.md). Rejected probes are not production implementations.
