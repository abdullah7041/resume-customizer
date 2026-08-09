# Plan 021: Stop the server PDF fallback from crashing on a detached ArrayBuffer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d2fba38..HEAD -- netlify/lib/resumeText.js src/lib/utils/resumeText.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `d2fba38`, 2026-08-08

## Why this matters

The server-side PDF text extractor hands its `ArrayBuffer` straight to
`pdfjs.getDocument({ data })`, which **detaches** the buffer. If pdfjs then
throws, the catch block falls through to a raw-text fallback parser that reads
*that same, now-detached* buffer — and immediately throws
`TypeError: Cannot perform Construct on a detached ArrayBuffer`.

The net effect: the fallback parser, which exists precisely to recover text from
PDFs pdfjs cannot handle, **never runs**. Its failure is swallowed one level up,
so the extraction silently returns empty.

This matters because of *when* the server path runs. Per `CLAUDE.md`, the client
extracts text in the browser and only sends `kind: "file"` when client
extraction yields under 100 characters. So `netlify/lib/resumeText.js` is
reached exactly on the difficult PDFs — the ones most likely to make pdfjs
throw, and the ones the raw-text fallback was written for.

Downstream consequences, traced in `netlify/functions/extract-resume-json.ts`:

- **Signed-in users uploading a PDF** get silently routed to the OCR fallback
  (`extractScannedPdfText`, a per-page vision-model call) instead of the free
  local text recovery — turning a cheap deterministic parse into an expensive AI
  transcription.
- **Guests** get the `resume/unreadable-file` rejection, because guests have no
  OCR path.
- **Non-PDF uploads and environments without `OPENROUTER_API_KEY`** get a hard
  failure.

The identical bug was already found and fixed on the client copy, with a comment
naming this exact crash. The fix was never ported to the server copy.

## Current state

### The bug — `netlify/lib/resumeText.js:273-331`

```js
const extractPdfPlainText = async (arrayBuffer) => {
  const pdfjs = await loadPdfjs();
  if (pdfjs) {
    try {
      const document = await pdfjs.getDocument({
        data: arrayBuffer,
        disableWorker: true,
        cMapUrl: "https://unpkg.com/pdfjs-dist@5.4.394/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "https://unpkg.com/pdfjs-dist@5.4.394/standard_fonts/",
      }).promise;
```

…and at the end of the same function (`:320-331`):

```js
      console.warn("[resumeText] PDF.js extraction returned no text, trying fallback parser");
    } catch (error) {
      console.warn("[resumeText] PDF.js extraction failed:", summarizeErrorForLog(error));
      // fall back to manual parsing below
    }
  } else {
    console.warn("[resumeText] PDF.js library not available, using fallback parser");
  }

  const fallbackText = extractPdfTextFallback(arrayBuffer);
  console.log(`[resumeText] Fallback extraction: ${fallbackText.length} chars`);
  return fallbackText;
};
```

`extractPdfTextFallback` reaches the detached buffer through
`arrayBufferToLatin1` (`netlify/lib/resumeText.js:182-183`):

```js
const arrayBufferToLatin1 = (arrayBuffer) => {
  const view = new Uint8Array(arrayBuffer);
```

`new Uint8Array(detachedBuffer)` is what throws.

### The fix that already exists on the client — `src/lib/utils/resumeText.ts:550-568`

```ts
  if (pdfjs) {
    // pdfjs `getDocument({ data })` transfers ownership of the buffer and DETACHES it.
    // Hand it a private copy so the raw-text fallback below can still read the original
    // bytes when the primary path throws — otherwise `new Uint8Array(detachedBuffer)`
    // in extractPdfTextFallback crashes with "Cannot perform Construct on a detached
    // ArrayBuffer", turning a recoverable pdfjs failure into an empty extraction (→ 422).
    const pdfData = arrayBuffer.slice(0);
    try {
      const document = await pdfjs.getDocument({
        data: pdfData,
```

Note it also passes `isEvalSupported: false` and derives the CDN URLs from
`pdfjs.version` rather than hardcoding them.

### The stale hardcoded version

`netlify/lib/resumeText.js:280` and `:282` hardcode
`https://unpkg.com/pdfjs-dist@5.4.394/...` for cmaps and standard fonts, while
`package.json` installs `"pdfjs-dist": "^5.7.284"`. The client
(`src/lib/utils/resumeText.ts:565,567`) interpolates `${pdfjs.version}`
instead. Serving cmaps and font data from a different pdfjs build than the
library actually running is a real correctness hazard for CJK/Arabic glyph
mapping — which matters for a bilingual EN/AR product.

### Where the server module is reached

`netlify/functions/extract-resume-json.ts:3` imports it:

```ts
import { extractPlainTextFromArrayBuffer, inferMimeType, normalizeResumeText } from "../lib/resumeText.js";
```

and calls it at `:198`, inside the `kind === "file"` branch opened at `:173`.
The whole call is wrapped in a `try/catch` at `:207-209` that only warns:

```ts
      } catch (extractError) {
        console.warn("[extract-resume-json] Pre-extraction failed:", summarizeErrorForLog(extractError));
      }
```

That swallow is why the crash is invisible in production logs beyond one
warning.

### How pdfjs is loaded, and how tests can mock it

`netlify/lib/resumeText.js:65-76`:

```js
const loadPdfjs = async () => {
  if (pdfjsLibPromise !== undefined) {
    return pdfjsLibPromise;
  }
  pdfjsLibPromise = import("pdfjs-dist/legacy/build/pdf.mjs")
```

`vitest.config.ts` aliases exactly that specifier:

```
"pdfjs-dist/legacy/build/pdf.mjs": fileURLToPath(
  new URL("./src/test/__mocks__/pdfjs-dist.mjs", import.meta.url)
),
```

So the existing mock at `src/test/__mocks__/pdfjs-dist.mjs` applies to the
server module too. Note `pdfjsLibPromise` is **module-level memoised** — a test
that needs different pdfjs behaviour per case must `vi.resetModules()` and
re-import.

### Repo conventions

- Logging in this file is prefixed `[resumeText]`.
- `netlify/lib/resumeText.js` is plain JS (not TS) and uses ESM `import`.
- Tests for `netlify/lib/` live in `netlify/lib/__tests__/` and are picked up by
  the vitest glob `netlify/lib/__tests__/**/*.test.{js,ts}`. **This module has
  no test file today** — you will create the first one.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run type:check` | exit 0, no errors |
| New test file | `npx vitest run netlify/lib/__tests__/resumeText.test.js` | all pass |
| Client PDF tests (regression) | `npx vitest run src/__tests__/resumeText.test.js src/__tests__/resumeText.extraction.test.ts` | all pass |
| Lint | `npm run lint` | exit 0 |
| Full suite | `npm run test` | exit 0 (181 files) |

## Scope

**In scope:**
- `netlify/lib/resumeText.js`
- `netlify/lib/__tests__/resumeText.test.js` (create)
- `src/test/__mocks__/pdfjs-dist.mjs` — **only** if the existing mock cannot
  simulate a throwing `getDocument`; extend it additively without changing
  current behaviour for existing tests
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/utils/resumeText.ts` — the client copy is already correct. It is the
  reference, not the target.
- The **two-column / wrapped-line layout engine** that exists only on the client
  (`buildLinesFromItems`, `mergeWrappedLines`, and the column-detection
  constants around `src/lib/utils/resumeText.ts:112-141`). Porting it to the
  server is a much larger change with low value on this path — the server
  extractor only runs when the client already failed to get 100 characters, so
  layout quality is not the binding constraint there. Do not attempt it.
- `netlify/functions/extract-resume-json.ts` — its swallow-and-continue at
  `:207-209` is intentional graceful degradation. Fixing the extractor is
  enough; do not change the caller's error handling.
- `netlify/lib/ocr-extract.js` and the OCR fallback branch.
- Replacing the unpkg CDN with a self-hosted or bundled asset. That is a
  separate deployment decision (see Maintenance notes).

## Git workflow

- Branch: `advisor/021-server-pdf-detached-buffer`
- Conventional commits, matching `git log` style.
  Suggested: `fix(parse): copy the PDF buffer before pdfjs detaches it`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Give pdfjs a private copy of the buffer

In `netlify/lib/resumeText.js`, inside `extractPdfPlainText`, take a copy before
the `try` and pass the copy to `getDocument`, mirroring
`src/lib/utils/resumeText.ts:551-559`. Carry the explanatory comment across —
the next person needs to know why the copy exists, or they will "optimise" it
away:

```js
const extractPdfPlainText = async (arrayBuffer) => {
  const pdfjs = await loadPdfjs();
  if (pdfjs) {
    // pdfjs `getDocument({ data })` transfers ownership of the buffer and DETACHES it.
    // Hand it a private copy so the raw-text fallback below can still read the original
    // bytes when the primary path throws — otherwise `new Uint8Array(detachedBuffer)`
    // in extractPdfTextFallback crashes with "Cannot perform Construct on a detached
    // ArrayBuffer", turning a recoverable pdfjs failure into an empty extraction.
    const pdfData = arrayBuffer.slice(0);
    try {
      const document = await pdfjs.getDocument({
        data: pdfData,
```

Leave the rest of the function — including the final
`extractPdfTextFallback(arrayBuffer)` call, which must keep using the
**original** `arrayBuffer` — unchanged.

**Verify**: `grep -n "arrayBuffer.slice(0)" netlify/lib/resumeText.js` → 1 match;
`grep -n "extractPdfTextFallback(arrayBuffer)" netlify/lib/resumeText.js` → still 1 match.

### Step 2: Stop hardcoding a stale pdfjs version in the CDN URLs

Replace the two hardcoded `5.4.394` URLs at `netlify/lib/resumeText.js:280,282`
with the same dynamic form the client uses:

```js
        cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
```

If `pdfjs.version` is undefined under the test mock, that is a mock gap rather
than a code problem — extend the mock to expose a `version` string rather than
reverting to a hardcoded URL.

**Verify**: `grep -n "5.4.394" netlify/lib/resumeText.js` → **no matches**.

### Step 3: Create the test file and pin the regression

Create `netlify/lib/__tests__/resumeText.test.js`.

The test that matters: **when `pdfjs.getDocument` throws, the raw-text fallback
still runs and returns text.** Before the fix this throws; after it, it returns
the fallback string.

Sketch of the approach (adapt to the actual exports — read the bottom of
`netlify/lib/resumeText.js` to see what is exported; `extractPlainTextFromArrayBuffer`
is the public entry point used by `extract-resume-json.ts`):

- Build an `ArrayBuffer` containing minimal PDF-ish bytes that the fallback
  parser can extract at least one string from. Read `extractPdfTextFallback`
  and `decodePdfEscapes` (`netlify/lib/resumeText.js:193-271`) to construct
  input the fallback genuinely parses — do **not** assert on an empty result,
  because empty is exactly what the bug produces.
- Make the mocked `getDocument` reject.
- Assert the returned text contains your expected string.

Because `loadPdfjs` memoises at module scope, use `vi.resetModules()` and a
dynamic `await import()` of the module inside each test that needs different
pdfjs behaviour.

Add a second test asserting the happy path still works (mocked `getDocument`
resolves with page text → that text is returned), so Step 1 can't have broken
the normal case.

**Verify**: `npx vitest run netlify/lib/__tests__/resumeText.test.js` → all pass.

### Step 4: Confirm the test actually catches the bug

Temporarily revert Step 1 (pass `arrayBuffer` instead of `pdfData` to
`getDocument`), re-run the test file, and confirm the throwing-pdfjs test
**fails**. Restore the fix and confirm it passes.

A test that passes before and after proves nothing. Do not skip this. Report
both outcomes.

**Verify**: the test fails with the bug reintroduced, passes with the fix.

### Step 5: Full verification

**Verify**:
- `npm run type:check` → exit 0
- `npm run lint` → exit 0
- `npx vitest run src/__tests__/resumeText.test.js src/__tests__/resumeText.extraction.test.ts` → all pass (client copy untouched and unaffected)
- `npm run test` → exit 0

## Test plan

- **New tests**: 2, in a new file `netlify/lib/__tests__/resumeText.test.js`
  (the first test file for this module).
  - pdfjs throws → raw-text fallback runs and returns non-empty text **(the regression)**
  - pdfjs succeeds → its text is returned unchanged
- **Structural pattern to follow**: an existing `netlify/lib/__tests__/*.test.js`
  for the vitest/module-mocking setup — `netlify/lib/__tests__/parse-quality.test.js`
  is a close match in style. Read it before writing.
- **Mock**: the shared `src/test/__mocks__/pdfjs-dist.mjs`, already wired via
  the `vitest.config.ts` alias. Extend additively only; existing client tests
  depend on it.
- **Mutation check**: Step 4.
- Verification: `npx vitest run netlify/lib/__tests__/resumeText.test.js`, then
  the full suite.

## Done criteria

ALL must hold:

- [ ] `grep -n "arrayBuffer.slice(0)" netlify/lib/resumeText.js` → 1 match
- [ ] `grep -n "5.4.394" netlify/lib/resumeText.js` → no matches
- [ ] `grep -n "detached" netlify/lib/resumeText.js` → ≥ 1 match (the comment survived)
- [ ] `netlify/lib/__tests__/resumeText.test.js` exists with ≥ 2 tests
- [ ] Step 4's mutation check was performed and reported
- [ ] `git diff --name-only -- src/lib/utils/resumeText.ts` → empty (client copy untouched)
- [ ] `npm run type:check` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `netlify/lib/resumeText.js:273-283` does not match the excerpt above — the
  file has drifted or someone already applied this fix.
- `pdfjs.version` is not available at runtime in the Netlify bundle (not just
  under the test mock). Report rather than reverting to a hardcoded version.
- The existing `src/test/__mocks__/pdfjs-dist.mjs` cannot be extended to
  simulate a throwing `getDocument` without changing behaviour for the existing
  client tests.
- You find yourself needing to modify `netlify/functions/extract-resume-json.ts`
  or port the client's layout engine to make a test pass — both are out of scope.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **What a reviewer should scrutinise**: that `getDocument` receives the *copy*
  and `extractPdfTextFallback` receives the *original*. Swapping them
  reintroduces the bug in a way no type checker will catch.
- `arrayBuffer.slice(0)` doubles peak memory for the PDF during extraction. That
  is acceptable here — `extract-resume-json` already has an upload size cap and
  the client copy has run this way without issue — but if the upload limit is
  ever raised substantially, revisit.
- **Known remaining issue, deliberately deferred**: both the client and server
  fetch pdfjs cmaps and standard fonts from **unpkg.com at runtime**, on the
  core resume-upload path. That is a third-party availability dependency on the
  product's main funnel (and it is why `netlify.toml`'s CSP `connect-src`
  includes `https://unpkg.com`). Self-hosting those assets would remove the
  dependency and let the CSP tighten, but it is a build/deploy change, not a
  bug fix, so it is out of scope here.
- **Also deliberately deferred**: the two copies of this module have diverged
  substantially — the client has a two-column/wrapped-line layout engine and
  `isEvalSupported: false` that the server lacks. Convergence is not worth it on
  the current call pattern (see Scope), but if the server path ever starts
  handling primary extraction rather than fallback, that calculus changes and
  the drift should be revisited.
