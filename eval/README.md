# AI gold sets

Two harnesses live here: the parser gold set (`fixtures/`, `score.mjs`) and the
match-scoring gold set (`match-fixtures/`, `match-score.mjs`).

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

# Match-scoring gold set

Guards the anti-inflation scoring rubric in `ai_match_reality_check` (the production
match path in `processMatchOnly`). A prompt change that re-adds score anchors or
weakens evidence-based scoring shows up as the weak/keyword-stuffing fixtures
drifting above their bands.

## Run

```bash
npm run eval:match                 # run every fixture through the real ai_match_reality_check contract
npm run eval:match -- --selftest   # validate the scorer offline (no API key)
EVAL_THRESHOLD=0.85 npm run eval:match
```

Same key/threshold/offline-cache behavior as the parser eval, with caches at
`eval/match-fixtures/<name>.actual.json`.

## Add a fixture

Create `eval/match-fixtures/<name>.json`:

```json
{
  "name": "…",
  "description": "what scoring behavior this fixture pins down",
  "language": "en",
  "resumeText": "…",
  "jobDescription": "…",
  "expected": {
    "scoreBand": [38, 72],
    "mustCredit": ["React", "TypeScript"],
    "mustFlagMissing": ["Kubernetes", "GraphQL"],
    "mustNotCredit": ["AWS"],
    "proseLanguage": "ar"
  }
}
```

### `expected` fields

- `scoreBand` (required) — `[lo, hi]` the overall score must fall in. Weight 3.
  Partial credit decays with distance outside the band (0 at 15 points out).
  Keep bands generous (~25-35 wide): the eval catches gross rubric regressions,
  not ±5 model noise.
- `mustFlagMissing` (optional) — terms that must appear in `missingKeywords` or a
  category's `missing`/`gaps` (case-insensitive, substring both ways). Weight 2.
- `mustCredit` (optional) — terms that must appear in `strongMatches` or a
  category's `matched`. Weight 2.
- `mustNotCredit` (optional) — listed-only or unsupported terms that must not
  appear as strengths. Any match is a hard fixture failure.
- `proseLanguage` (optional) — currently `"ar"`; requires Arabic script in the
  reasoning and every summary bullet while allowing embedded Latin technical terms.
- All `mustCredit`, `mustFlagMissing`, `mustNotCredit`, language, and structure
  checks are hard gates. Category weights remain useful diagnostics, but cannot
  hide a failed requirement behind the overall threshold.
- Structure invariants (always checked, weight 1): integer score 0-100, all four
  `categoryScores` present with integer score within `0..max`, 3-5 summary bullets
  ≤120 chars, non-empty reasoning. NOTE: flash emits each category on its own
  0-100 scale (`max: 100`), not the 40/30/15/15 prompt weights — the frontend only
  uses the score/max ratio, so the scorer asserts score-within-max, not a max value.

## Coverage

- strong match, quantified evidence (`strong-match-bi-analyst`, band 65-92)
- partial match, real gaps (`partial-match-frontend-to-fullstack`, band 38-72)
- weak match floor (`weak-match-retail-to-swe`, band 0-38)
- keyword stuffing with no work evidence — the anti-inflation guard
  (`keyword-stuffing-no-evidence`, band 5-60)
- career changer with transferable evidence (`career-changer-teacher-to-analyst`, band 25-68)
- Arabic resume + Arabic JD (`arabic-accountant-partial`, band 30-68). Note: the
  reality-check prompt keeps *technical* keywords English inside otherwise-Arabic
  keyword strings (e.g. `"SAP (وحدة FI/CO)"`) — the scorer's two-way substring
  match handles this; keep `mustCredit`/`mustFlagMissing` terms in English.

## What it does NOT cover

Answer *quality* of reasoning/summary bullets/strategicRealityCheck prose (that
would need an LLM judge like the optimize eval), and the `ai_match` fallback
contract (same prompt rubric, exercised only when the reality-check contract fails).
The optimize contract's own `match_score` is guarded separately: `eval:optimize`
fixtures carry `expected.matchScoreBand` and its report has a deterministic "band"
violation column (see `scripts/benchmark-fixtures/README.md`).
