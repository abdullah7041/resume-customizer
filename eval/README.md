# Parser gold set

Measures the resume parser field-by-field instead of eyeballing one CV. Each fixture
is a labeled resume: the extracted text plus the values a correct parse must produce.

## Run

```bash
npm run eval:parse                 # run every fixture through the real parse_resume contract
npm run eval:parse -- --selftest   # validate the scorer offline (no API key)
EVAL_THRESHOLD=0.85 npm run eval:parse
```

Needs `OPENROUTER_API_KEY` (read from env or `.env`). Exit code is non-zero if any
fixture scores below the threshold (default 0.80), so it can gate a release.

Offline: if `OPENROUTER_API_KEY` is missing but `eval/fixtures/<name>.actual.json`
exists, that cached parser output is scored instead. Cache a run by saving the parsed
JSON next to the fixture.

## Add a fixture

Create `eval/fixtures/<name>.json`:

```json
{
  "name": "two-column-marketing",
  "lang": "en",
  "layout": "two-column",
  "text": "<the extracted text the parser receives>",
  "expected": { ... }
}
```

Get `text` the same way the app does: drop the PDF/DOCX into the upload flow and copy
the extracted text, or run it through `extractPlainTextFromArrayBuffer`. Score the
TEXT the parser actually sees, not the raw file.

### `expected` fields (all optional — only assert what matters)

- `basics.name` — string, normalized equality.
- `basics.labelContains` — array of substrings that must appear in `basics.label`.
- `basics.location` — `{ "city": "...", "country": "..." }`, matched as substrings against the parsed location.
- `basics.summaryContains` — array of substrings; summary must be non-empty and contain them.
- `basics.profiles` — array of networks (e.g. `["linkedin","github","portfolio"]`); scored as recall against profile networks/urls and `basics.url`.
- `work` — array of `{ name, position, startDate, endDate, minHighlights }`. Matched by company name; dates match on shared year or "present"; `minHighlights` checks the bullet count.
- `education` — array of `{ institution }`; recall.
- `skillsKeywords` — array of skill keywords; recall across all `skills[].keywords`.
- `languages` — array; recall.
- `certificatesContains` — array of substrings; recall across certificate names.

## Coverage to aim for

One fixture per failure mode, so a change that fixes one layout and breaks another
shows up as a number:

- single-column (done: `abdullah-bi-analyst`)
- two-column / sidebar (done: `two-column-designer`)
- two-column worst case, lines interleaved across columns (done: `interleaved-columns-accountant`)
- right-aligned date column, dates detached from entries (done: `right-aligned-dates-engineer`)
- decorative/Canva template: emoji headers, skill bars as unicode dots (done: `canva-decorative-marketer`)
- Arabic-only (done: `arabic-data-analyst`)
- Arabic with Hijri dates + Arabic-Indic digits + embedded English tools (done: `arabic-hijri-mixed-hr`)
- bilingual Arabic/English (done: `bilingual-software-engineer`)
- a scanned PDF (OCR path) — still missing

## What it does NOT cover

Text extraction (PDF → text) is tested separately in
`src/__tests__/resumeText.extraction.test.ts`. This harness starts from text and
measures the AI parse only. Date-format normalization is lenient (year-level), so a
wrong month won't fail a date.
