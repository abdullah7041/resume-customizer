# Workflow repair validation — 2026-10-28

Branch: `codex/repair-resume-workflows`, based on `d27151c`.

## Implemented

- Optimization ends clarification once per input context. Failures settle the caller, remain visible, and retry with retained answers. Stale follow-ups cannot disable a new context.
- Closing questions shows a compact choice view immediately; answers, focus and scroll return on “Keep answering.” Numbering and selected options are clearer.
- Batch imports use the existing library without activating uploads or overwriting existing duplicates. File errors stay inline; one terminal notification summarizes the batch. Single-upload storage failures also produce one warning.
- The official badge iframe uses its provider's light color scheme, preserving expansion and transparency.
- PDF.js now loads its worker handler in the main realm. The obsolete `disableWorker` option did not prevent stalled module-worker initialization. Text checks still fail closed, distinguish failure causes, and have a bounded 30-second deadline.

## Evidence

| Check | Result |
|---|---|
| Full Vitest suite | 2,570 passed, 2 skipped; run before the final reader/bootstrap and notification refinements |
| Final affected component/API tests | 275 passed |
| Final reader and parse-quality tests | 132 passed |
| Final lint | Passed, no errors or warnings |
| Final TypeScript checks | Passed for frontend and Netlify functions |
| Final production build | Passed; existing chunk-size and mixed static/dynamic import warnings remain |
| Final translation validation | Passed, no issues |
| Final whitespace check | `git diff --check` passed |
| Independent review | Two preservation findings reproduced and fixed; scoped re-review and final loader/notification review clean |
| Dialog browser checks | English/light desktop, Arabic/dark desktop, English/dark mobile, Arabic/light mobile; exit choices visible and focus/scroll/answers restored |
| Official badge browser checks | Collapsed and expanded in light/dark themes; white rectangle removed |

Real generation used the existing Netlify handler, synthetic English content with bold keywords and links, and actual PDF.js checks. A deliberately unresponsive `Worker` reproduced the former initialization failure; the corrected reader needed no module-worker starts. Independently extracted saved bytes retained every expected visible field:

| Template | Pages | Expected fields | Missing fields |
|---|---:|---:|---:|
| Riyadh | 3 | 81 | 0 |
| Khobar | 3 | 81 | 0 |
| Qiddiya | 4 | 73 | 0 |
| Neom | 3 | 79 | 0 |

Reproduce with `node --import tsx scripts/pdf-export-regression.mjs`; use `UI_ONLY=1` for layout checks. The runner uses installed Edge by default; `PDF_TEST_BROWSER` accepts another installed Chromium executable. Evidence is written to the system temporary directory under `watheq-english-pdf-regression`.

## Independent review follow-up — 2026-10-30

The whole-change review found one remaining notification requirement: cancelling a single upload displayed an informational outcome, then the parent parsing catch replaced it with a failure. Two regressions reproduced this for `cancelled: true` and native `AbortError`. The parent now rethrows cancellation before failure telemetry or notification handling, preserving the cancellation outcome.

The seven affected suites passed again before this follow-up (275 tests). After the fix, all 135 MainContent and single/batch upload tests passed; lint on the two touched source/test files and `git diff --check` also passed. Focused independent re-review found no remaining actionable concerns. No additional production/browser qualification was performed for this one-line cancellation guard.

## Pre-push verification — 2026-10-30

The fresh full suite reported 2,572 passed, two skipped and one failure: `MainContent resume parsing > passes structured hard-stop answers to optimization without positive clarification text` exceeded the default asynchronous query deadline waiting for the lazily loaded clarification button. The entire MainContent file then passed unchanged in isolation (101 tests); that test completed in 721 ms. This is consistent with a timing flake under full-suite load, but the full run is not recorded as green. No assertion or timeout was weakened. The staged whitespace check passed and dependency manifests remain unchanged.

## Limits and tooling

No live paid optimization, deployment, or Arabic native-reader qualification was performed. Existing Arabic qualification requirements remain in force. No dependencies were added; the approved `npm ci` restored the lockfile.

`RTK.md` is absent. CodeGraph was used first; stale/omitted source and compact RTK output required narrow live reads. React Doctor's offline cache was unavailable, so no package was installed for it.
