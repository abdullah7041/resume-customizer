# Preview repair qualification — November 17, 2026

Target: PR #150 / `codex/watheq-jobs-first`. Production is not promoted by this repair.

## Demonstrated causes and changes

- Vision 2030 passed an AbortSignal as the job-description argument. Corrected the caller and API signal parameter; the request now retains a string/absent job description.
- Optimization and follow-crawl dispatch could use the production `URL` from a preview when deployment-specific runtime environment variables were absent. Both now validate and use the invoking site origin, reject foreign hosts and redirects, and retain signed worker ownership.
- The old workflow reserved an approximately 300px desktop action column beside the steps. Controls now occupy their own row; the step strip spans the panel width. Optimization progress has a labelled emerald indicator instead of an unlabelled dark track.
- Company resolution had no searching/following feedback, and empty resolver outcomes could remain silent. The verified directory now filters names/sectors immediately; the careers-board resolver reports progress, empty outcomes, errors and confirmed follow results.
- The job area follows the supplied concept: compact filters, alert/progress strips, horizontal job rows, next-step sidebar and an internal Applications view with Back to jobs. Save/follow/tailor actions expose pending and confirmed outcomes.
- Netlify previews do not run the hourly production schedule. Alert settings now distinguish saved consent, manual preview operation, unavailable configuration, scheduled operation and provider acceptance. An explicit authenticated test-email action targets only the current verified account, with fail-closed per-user quota and stable provider idempotency on uncertain retries. Saving consent sends no test email.
- Primary-source classification review supports categories for 26 employers and sectors for all 30. Four unsupported size categories remain unknown and their category badges are omitted. The audit and additive SQL are supplied; SQL was not applied by the agent. The shared search response uses the reviewed metadata immediately without requiring that migration.
- Optimization errors retain stage/status/code and an operation UUID searchable in Sentry. Background completion awaits a bounded telemetry flush. Empty evidence-backed edits fail before credit consumption; evidence gates are unchanged.

## Verification

- 310 focused tests passed across 22 changed/new test files; the added pre-claim telemetry regression then passed with all seven worker tests and eleven alert UI tests.
- Repository lint, frontend/backend type checks, production build and i18n validation passed as separate commands. Existing build size/static-dynamic import warnings remain.
- Four synthetic browser scenarios passed: English light desktop, Arabic dark desktop, English dark mobile and Arabic light mobile, including explicit matching and no horizontal overflow.
- Regression tests cover trusted preview routing, foreign-host rejection, Vision argument shape, worker failures, Sentry metadata, follow dispatch, alert health, test-email authorization/quota/idempotency, directory search, follow feedback and Applications return navigation.

## Boundaries

The historical Optimize reference `31e7fedf-f455-457b-94cf-932f4f38f98c` had no matching event visible in Sentry during inspection. Its exact provider/evidence failure is not established. The demonstrated cross-deployment dispatch and reporting defects are repaired, but a successful deployed clarification run and observed Sentry ingestion are separate live checks.

No real email has been sent by the agent. Provider acceptance and inbox receipt remain distinct. No broad preview alert worker was invoked because the preview shares the production database. Production hourly processing remains a separate qualification step.

The new optional migration is `supabase/migrations/20261117010000_reviewed_employer_classifications.sql`; the owner runs it in Supabase. Earlier PDF/DOCX and Arabic native-reader qualification limits in the original release report still apply.

Tooling: this worktree has no CodeGraph index. RTK and focused PowerShell fallbacks were used for live source, Windows paths and captured check output. No dependencies or tools were installed.

