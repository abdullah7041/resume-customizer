# Watheq jobs-first qualification

## Rollout

Run these additive migrations in Supabase in filename order after review. Agents have not applied them.

The owner confirmed all three migrations ran successfully on November 17, 2026.

1. `supabase/migrations/20261116010000_job_catalogue.sql`
2. `supabase/migrations/20261116020000_job_alert_scope_health.sql`
3. `supabase/migrations/20261116030000_verified_catalogue_seed.sql`

Set `JOB_CATALOGUE_ENABLED=true` server-side and `VITE_JOB_CATALOGUE_ENABLED=true` at build time for preview qualification. Existing subscriptions default to followed-company scope. Set `JOB_ALERTS_ENABLED=true` only where email credentials, origins, secret, schedules, and migrations are configured. Review live collection and delivery health before production rollout.

Error reporting requires `SENTRY_DSN` in Functions and `VITE_SENTRY_DSN` at build time. The release uses Netlify commit/deploy metadata when available. A configured Logs product is not needed for exception capture.

## Test deployment

PR [#150](https://github.com/abdullah7041/resume-customizer/pull/150) publishes the implementation for preview testing. Its target URL is `https://deploy-preview-150--resume-optimizing.netlify.app`.

The owner configured catalogue flags and enabled alerts for previews while keeping production alerts disabled. The agent added branch-specific `SITE_URL` pointing to that preview and `SENTRY_DSN` using the existing Sentry project DSN. Production environment values and the published production deploy were left unchanged. A fresh preview build is required to consume those settings. No alert worker or email send was triggered by this deployment setup.

Primary board-response evidence for 30 employers is in `research/job-catalogue-verified-2026-11-16.json`. Board access and Saudi job locations were checked on November 16. Re-run `python scripts/verify-job-catalogue.py --refresh` when re-verifying. Classification remains unclassified where primary evidence has not been reviewed. Counts are verification observations.

Search currently scans lightweight records on the server before ranking/pagination. Descriptions are fetched on demand. Move ranking to a SQL RPC if catalogue growth approaches the function execution budget. Search is authenticated and rate limited.

## Findings

Streaming recovery could discard the worker's terminal code. Background failed-result branches lacked explicit Sentry capture and discarded operation codes. Changes preserve safe metadata and use lookup-only recovery for uncertain billing. Pending lookup used to restart its polling deadline recursively; it now stops at the original deadline. A confirmed terminal failure with explicitly safe billing releases lookup-only recovery for a user-requested new run. Saved clarification answers remain available. The reported production “300” status and original production failure remain unconfirmed.

All templates used top margin for bottom padding. Fixed independently configurable bottom margins and wrapping, removed technical monospace and skill chips, isolated phone numbers for RTL, restored saved template selections on gallery mount, and retained document direction independent from interface language.

The real browser PDF check exposed `Invalid workerSrc type`: the dynamic `?url` module did not supply a usable default export. The shared reader now imports its existing main-thread handler directly. Four long English templates, including Neom, subsequently generated selectable multipage PDFs and passed field-preservation checks. This is local reproduction evidence, not confirmation of the user's original deployed download failure.

PDF server renderer/font failures now emit safe Sentry events and return a stable code plus UUID operation reference. The browser passes the same UUID in a request header for correlation. Alert dispatch/delivery events carry an operation UUID, stage, status and safe code; Sentry attaches the configured release. Expected request validation remains excluded.

The layout follows the parsing-risk reductions documented by [Greenhouse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse), updated March 2, 2026: one column, clear sections, body contact details, and text-based documents. No universal ATS compatibility claim is made.

## Verification record

| Check | Observed result |
|---|---|
| Final touched-file tests | 470 passed; one existing MainContent test exceeded its 10-second limit while browser checks were running. |
| Isolated MainContent follow-up | All 106 tests passed, including that timed-out case and the pending-to-safe-failure retry regression. |
| Telemetry follow-up | 76 backend PDF/alert checks and all 106 export UI tests passed after adding UUID correlation and safe metadata. |
| Lint | Passed separately. |
| Frontend and Netlify type checks | Passed separately. |
| Build and translations | Both passed separately after the final telemetry changes. Build emitted chunk-size and mixed static/dynamic import warnings. |
| Jobs UI | Four browser scenarios passed: English/Arabic, desktop/mobile, both themes, no horizontal overflow, explicit matching, employer link. Synthetic API responses; no production account or delivery claim. |
| PDF files | Four long English layouts passed. All four short English, short Arabic, long Arabic, and short mixed layouts passed PDF.js field checks. Long mixed Neom passed separately after the final RTL phone fix: two pages, 79 expected fields preserved, no UI alert, one fixture mount, no worker startup. The other three long mixed layouts passed the earlier matrix. |
| DOCX files | Twelve actual DOCX archives (four templates × English/Arabic/mixed) preserved their synthetic source text in document XML. Word visual inspection was blocked by unavailable accessibility/frame capture. |

The full-suite and dependency-based changed-file attempts were inconclusive and were stopped after their runtime windows. The explicit touched-file run returned per-file results. No bundled parallel quality gate was used.

Local logs, PDFs, DOCX files, and screenshots are retained under ignored `.verification/`. Runnable browser checks are `scripts/pdf-export-regression.mjs` and `scripts/jobs-first-regression.mjs`; they reuse installed Vite, Puppeteer and Edge. PDF fixtures support `PDF_FIXTURE_LANGUAGE=en|ar|mixed`, `PDF_SHORT=true`, and optional `PDF_TEMPLATE_ID`. Use synthetic Supabase configuration for that harness. Evidence generation does not send emails or invoke paid AI.

Arabic/mixed PDF release qualification remains open: PDF.js's normalized field check and a few pypdf literal probes do not establish complete exact source/order or native PDFium search. No PDFium Python package was installed, and no new dependency was added. Existing Arabic warnings and explicit DOCX, retry, plain-text review, and image-only choices remain. Image-only output is never substituted silently.

Production optimization, Neom download, Sentry ingestion, and email acceptance require a deployed release and configured services. They remain separate checks.

The isolated final Neom evidence is `.verification/neom-isolated/`; UI completion was inconclusive in an earlier mixed-language matrix, and another run timed out at the client request under concurrent local checks despite producing valid PDF bytes. The isolated rerun passed without increasing production timeouts or weakening document/session guards.

## Production qualification checklist

- [x] Owner reports all three SQL migrations applied before preview deployment. Production promotion still requires preview qualification.
- [ ] Preview authenticates a user with no follows, runs a catalogue crawl, searches and pages actual postings, verifies ten matches, tailors/exports, saves without changing an existing application's status, and confirms Applied explicitly.
- [ ] A clarification Optimize run records actual HTTP status, safe code, operation ID, successful result, and credit balance. Repeat a controlled failure and lookup-only recovery.
- [ ] The controlled terminal failure appears in Sentry Errors with release, stage, status and operation ID. No Logs-page configuration is required; inspect its payload for excluded résumé/answer/JD/contact content.
- [ ] Production Neom download preserves the expected text and opens in the target reader. Complete Arabic/mixed native-reader and Word rendering checks before claiming those formats fully qualified.
- [ ] Alert processing records a completed empty check and a real provider-accepted email under each explicitly chosen scope. Test unsubscribe. Provider acceptance never proves inbox receipt.

## Tooling

The isolated worktree has no CodeGraph index. Focused RTK reads were used; narrow PowerShell/rg fallbacks handled literal Windows paths, insufficient RTK output, process-scoped cleanup, and captured check logs. Existing node_modules were reused through a directory junction. No dependencies were installed. Independent agents stopped at an account usage limit, and their saved changes were reviewed in the parent session.
