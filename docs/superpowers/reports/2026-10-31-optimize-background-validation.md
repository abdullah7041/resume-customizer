# Optimization background repair — 2026-10-31

## Proven failure

The signed-in production reproduction ended with `SSE stream ended without a result event`. Netlify's function log showed `Duration: 30000 ms` while the AI call had a 40-second timeout. The subsequent read-only cache lookup missed. The site's configured timeout did not extend this measured execution limit. A smaller guest request succeeded, so that request was not a reproduction of the reported case.

## Repair

Both public optimization routes now dispatch one native `optimize-background` invocation and return promptly. The browser polls the existing route for the stored result. The worker invokes the existing evidence-validation and credit pipeline in process, with its original model, prompt, reasoning budget, and output validation. Its provider timeout is 90 seconds within Netlify's 15-minute background lifetime.

The existing Redis connection stores an atomic job claim and the terminal result. Signed invocation envelopes, immutable redispatch bodies, worker claims, and operation ownership prevent duplicate delivery from repeating generation or a possible debit. Ambiguous dispatch, status-read, and debit outcomes retain ownership. Guest quota is reserved by the worker only. Oversized background payloads fail before a new claim is created.

No dependencies, database migrations, model substitutions, or relaxed evidence assertions were added. The result remains device-local after the existing client accepts it; temporary server-side job ownership expires after 20 minutes and completed results after 10 minutes.

## Validation before deployment

- The real configured Redis regression script passed: five concurrent claim attempts produced one owner; duplicate workers produced one claimant; signature tampering and stale completion were rejected; completed results remained readable; unknown billing outcomes blocked new claims. The disposable key was removed. This check invoked no AI and used no credits.
- The affected-test run had 1,073 passing tests, four failing legacy transport expectations, and two skips. Those four expectations were adapted to exercise the real background worker and retained their evidence assertions. The final six-file focused run passed all 66 tests, including both language cases, slow completion beyond 30 seconds, duplicate delivery, partial transport failures, billing uncertainty, and guest quota ownership. The full affected run was not repeated after that adaptation.
- Final `npm run lint`, `npm run type:check`, `npm run build`, `npm run i18n:validate`, and `git diff --check` passed. The build retained existing chunk-size and dynamic-import warnings.
- Independent code review found no remaining important issues after the ownership, billing, quota, and payload findings were addressed.

## Production verification

Pending deployment and a repeat of the existing signed-in Brave case. Local checks and a published deployment alone do not establish a successful live optimization.
