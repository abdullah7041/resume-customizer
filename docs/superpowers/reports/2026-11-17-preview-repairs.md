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


## Live preview follow-up

The deployed step strip and content panel both measured 1,184px wide, with a 12px gap (the old strip was about 884px with a 38px gap). Verified company search narrowed immediately to Salla; one test follow completed with the visible Following state. Applications opened inside the job area and Back to jobs restored its filters/results. Alert management showed manual-preview operation, scope controls and an explicit test-email button; no email was sent.

Live search exposed a pre-existing shared-prefix defect: `Data analyst` admitted `DataPower` roles, and regression tests also reproduced `Database`, `Salesforce` and `Production` false positives. The shared token comparator now permits ordinary inflection suffixes rather than arbitrary compounds. All 118 focused matching/feed/API tests passed after four red cases.

The first Optimize attempt reached clarification generation, then a preview deployment switch removed the deferred modal chunk (`Failed to fetch dynamically imported module: ClarificationModal...js`) and React unmounted the workspace. The critical clarification dialog is now imported with the workspace. React 19 root error callbacks explicitly capture a generic safe exception and component stack; original error content is not transmitted. This follows [Sentry's React 19 guidance](https://sentry.io/changelog/react-19-support/) and the installed SDK signatures. The reporting regression and all 16 modal tests passed. MainContent had one 10-second test timeout while lint was running; its isolated 106-test follow-up passed.

CI for `6646b43` passed its full suite after updating two older visual assertions to scope title-relevance colors correctly and retain readable locked-step contrast. At that stage, the matching/rendering follow-up still required its own deployed result; later live results are recorded below.

Context7 was newly present in Codex configuration during this work, but the running tool connection returned `unknown MCP server context7`. No tool was installed by the agent; official documentation was used as the fallback.

## Final preview evidence at 7e300d4

Full [CI run 44034847649](https://github.com/abdullah7041/resume-customizer/actions/runs/44034847649) passed: 258 files, 2,805 tests passed, three skipped. Netlify preview deploy `6afbfa7a9b9ee49da385d1e3` reached ready at that commit.

A live Optimize attempt successfully opened the clarification dialog and reached the background worker using the existing resume/job and the skip-answers choice. It returned `OPTIMIZE_NO_VERIFIED_EDITS`, reference `cbf4e150-c82c-4707-8b9a-1d7465e65a5b`. The balance remained 16 credits. This is a demonstrated terminal evidence rejection, not a successful optimization. No candidate experience was invented during testing.

That operation was not visible in Sentry. The attempted server reporting setup did not resolve runtime ingestion; subsequent worker logs identified a masked branch-specific DSN, corrected below. Production values were unchanged. A separate controlled SDK probe appeared in Sentry as JAVASCRIPT-REACT-1P, operation `f1cea02a-2e7a-452e-842a-ce708eee7d08`. This confirms SDK transport/project ingestion from the local qualification process; it does not yet prove deployed worker ingestion. New safe evidence-rejection reason counts will distinguish missing references, missing targets, wrong targets and unsupported numbers without transmitting source content.

A further prompt correction removes the contradictory optimization example and explicitly requires a complete original inside one resume source, matching target ID, and exact sourceId/quote references. The validator, models, budgets and retries are unchanged. The new both-contract prompt regression failed before the correction; 87 focused contract/card/evidence tests, typecheck and touched-file lint passed afterward. This corrects a demonstrated contract mismatch; it is not proof of the prior live failure's exact cause.

The deployed title-filter follow-up correctly removed both DataPower jobs from the Data analyst search and showed an honest empty state.

## Successful deployed optimization and final boundaries

The real worker log exposed `Invalid Sentry Dsn` containing a masked display value. The earlier server setup had copied that masked value. Both the explicit deploy-preview and existing branch-specific server contexts were corrected from the verified frontend project DSN. Environment-only preview rebuild `6afc02a0309353f7ecd96a30` reached ready on `ca4eb3e`; production stayed on `7508221`.

The subsequent live retry succeeded: worker request `8862d343`, 11 source-bound Experience cards, one provider attempt of about 35 seconds, and one 5-credit debit (16 → 11). The UI showed 11 suggestions ready and 0/11 applied. No candidate answers or accomplishments were invented; the live test used the skip-answers path after clarification questions. Answer-submission coverage remains synthetic regression evidence. No further paid tests were started.

The controlled SDK event JAVASCRIPT-REACT-1P was visible in Sentry. The rebuilt worker no longer logged an invalid DSN. A new deployed terminal-failure event after the DSN correction was not observed because that retry succeeded; production failure reporting remains a separate qualification. Do not describe the earlier missing worker events as delivered retroactively.

Final reporting hardening treats malformed worker JSON as expected request validation, before storage/ownership/generation, rather than a reportable terminal worker failure. Its regression failed before the guard; all eight worker and eight Sentry tests passed after it.

Successful empty results, real alert provider acceptance/inbox receipt, production Neom export, Arabic native-reader fidelity, and Word visual qualification retain the original release-report boundaries. The current preview has no automatic hourly schedule; use Manage alerts → Send test email for an explicit current-account check. No real email was sent by the agent.

Visual proof remains in ignored `.verification/verified-discovery-full.jpg` and `.verification/verified-optimization-ready.jpg`. The preview was left open with its unapplied suggestions for owner review.
