# Handoff: resume parsing fixes + gold-set eval

Pick this up in Claude Code on the real machine. Everything below was authored in a
remote sandbox whose mount intermittently corrupted files after edits, so the FIRST
job is to confirm the on-disk files are clean before trusting them.

## What changed this session

Three parser fixes, plus a measurement harness so the next change is scored, not guessed.

1. **Two-column extraction** — `src/lib/utils/resumeText.ts`. `collectPdfPageText` now detects a vertical gutter and reads each column fully before the next, instead of merging left+right rows. Conservative: rejects false splits from right-aligned date columns. New helpers: `detectColumnSplit`, `isValidColumnSplit`, `verticalRange`.
2. **Soft-wrap merge** — same file. Wrapped bullet/paragraph lines rejoin the previous line (no-bullet + previous line filled to margin + one line-height gap). Fixes bullets fragmenting into multiple bullets and words like "Power BI" splitting. New helpers: `buildLinesFromItems` (now returns `LineInfo`), `mergeWrappedLines`, `renderLines`. Item height captured from the text transform.
3. **Basics parse prompt** — `netlify/lib/ai-contracts/contracts/index.js`, `buildParseResumeMessages`. Added explicit rules to extract `basics.location` (from the pipe-delimited contact line), `basics.summary` (incl. non-standard headings like "Core Identity & Value Proposition"), and `basics.profiles`/`url`. These were being dropped.

Tests: `src/__tests__/resumeText.extraction.test.ts` gained 6 cases (two-column, right-aligned-date no-split, 3 wrap-merge, hyphen join).

Eval harness:
- `eval/score.mjs` — pure field-level scorer.
- `scripts/parse-eval.mjs` — runs each fixture through the real `parse_resume` contract.
- `eval/fixtures/` — `abdullah-bi-analyst` (real) + 3 synthetic scaffolds (two-column, Arabic, bilingual).
- `eval/README.md`, `package.json` script `eval:parse`.

## Step 1 — confirm the files are intact (do this first)

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json OK')"
node --check scripts/parse-eval.mjs && node --check eval/score.mjs
for f in eval/fixtures/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "OK $f"; done
git diff --stat
```

If any file is truncated or NUL-padded, restore it from the diff/history — the sandbox
mount corrupted a few mid-session, but the Edit/Write operations themselves were correct.

## Step 2 — quality gate

```bash
npm run quality:parallel
```

I could NOT run lint/tsc/vitest in the sandbox (Windows-built `node_modules`, missing
Linux native bindings). Confirm all green here. Pay attention to:
- `resumeText.ts` type-checks (new `LineInfo`/`PdfTextItem` interfaces, no `any`).
- The 6 new extraction tests pass.

## Step 3 — eval harness

```bash
npm run eval:parse -- --selftest      # expect: selftest PASSED (good=100%, broken=6%)
OPENROUTER_API_KEY=... npm run eval:parse
```

Record the per-fixture scorecard as the baseline. Save each parser output to
`eval/fixtures/<name>.actual.json` so the set can be re-scored offline without spending tokens.

## Step 4 — fix anything below threshold

For any fixture under 0.80: state the diagnosis before writing a fix (per CLAUDE.md). Check
in order: is the fixture `text` correct → is it an extraction bug → is it a prompt/schema
bug. The Abdullah fixture is the regression guard — it must score high on
location + summary + work, since that's what was broken.

Also QA live at localhost:8888 with the real Abdullah PDF: confirm `basics.location` and
`basics.summary` populate and bullets aren't fragmented.

## Step 5 — extra work (prioritized)

1. **Arabic dates in the scorer.** `dateMatch` in `eval/score.mjs` only reads Latin numerals, so the Arabic fixture omits date asserts. Map Arabic-Indic digits (٠-٩ → 0-9) and treat "الآن"/"حتى الآن" as present, then add `startDate`/`endDate` to `arabic-data-analyst.json`.
2. **Arabic contract routing.** There is a separate `parse_arabic_resume` contract with its own schema. Decide whether Arabic/bilingual CVs should route there in production. If yes: add an optional `fixture.contract` field to `parse-eval.mjs` and normalize that schema before scoring. If the app already parses Arabic through `parse_resume`, leave as is and just record the score.
3. **Real fixtures.** Replace the 3 `"synthetic": true` scaffolds with real CVs and hand-verify their `expected`. Synthetic data tests the layout, not real-world mess.
4. **Scanned-PDF fixture.** Add one image-only CV to exercise the OCR fallback (`meta.parseQuality.ocrFallback`). Expect lower scores — that's the documented Arabic-OCR ceiling, not a bug.
5. **Gating.** `eval:parse` costs tokens, so don't run it per-commit. Consider nightly CI, or run it manually before parser changes. The extraction unit tests are free — those can go in pre-commit.

## Acceptance

- `npm run quality:parallel` green.
- `npm run eval:parse -- --selftest` passes.
- `npm run eval:parse` produces a scorecard; baseline recorded and `*.actual.json` cached.
- Abdullah fixture ≥ 0.85, with location + summary + all 3 work entries correct.
