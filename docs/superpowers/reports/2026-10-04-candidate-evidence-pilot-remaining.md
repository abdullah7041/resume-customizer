# Candidate trust continuation — remaining plan

**2026-10-07 current-status pointer:** See [continuation validation](2026-10-07-continuation-validation.md) for the later [draft PR #146](https://github.com/abdullah7041/resume-customizer/pull/146), reviewed OAuth, Modern DOCX and parser corrections, saved fictional artifacts, and live export limits. Historical no-PR/pending-CI statements below apply to their dated snapshots. On parser head `eb78b29`, remote quality passed (224 files, 2,353 tests passed, three skipped) and the Netlify preview reported ready; security-check success is confirmed only for the earlier `820e49a` head. Main merge, portable/deployed PDF and reader/ATS checks, candidate approval and an actual consented HR study are still open.

Started: 2026-10-04; final local verification: 2026-10-05 (Asia/Riyadh). Branch: `codex/candidate-evidence-pilot`, isolated from Phase 1 commit `4c422ab`. This checklist distinguishes local implementation from participant evidence and release.

## Phase 1 and PDF fidelity

- [x] Preserve completed Phase 1 Tasks 1–10; original and prior trust checkouts remain untouched.
- [x] Diagnose fresh fictional English, Arabic, mixed and multipage PDFs through the actual handler/TemplateRenderer/current stylesheet; inspect actual Unicode mappings, text directions and independent extractors.
- [x] Retain honest `unverified` Arabic/mixed text state; no string reversal or checker weakening.
- [x] Preserve personal/profile URLs in both browser-print HTML variants with scoped regression coverage.
- [ ] Resolve portable logical Arabic text extraction/search/copy and complete mixed reading order. The tested native PDFs retain legible pixels but fail these text-fidelity checks.
- [ ] Verify deployed Linux Chromium, actual manual reader copy/search, native print dialog, additional templates and downstream readers/ATS. Local fixtures do not qualify those environments.

See [PDF diagnosis and fresh evidence](2026-10-04-arabic-pdf-fidelity.md), [2026-10-05 installed-writer follow-up](2026-10-05-arabic-pdf-followup.md), and the [2026-10-06 isolated fontkit experiment](2026-10-06-arabic-pdf-fontkit-experiment.md). The stock jsPDF, logical-mapping, and stock subset `pdf-lib`/fontkit routes failed their independent fidelity checks; no production renderer correction was demonstrated. DOCX is an existing recovery choice; XML fixture checks do not establish every consumer's behavior.

## Phase 2: candidate-controlled report

- [x] Complete local report implementation and independent final review; final verification is recorded below.
- [ ] Verify the actual candidate workflow with real consenting candidates under a separately authorized study.

The minimum report is a local JSON download from Optimize. Candidates select exact job requirement quotations and supplied evidence, choose clarification inclusion, inspect the exact preview and download those bytes. Associations remain candidate-declared and not independently verified. Edit provenance does not establish job requirement support. No scores, model narrative or proposal/confirmation wording is exported. The list is candidate-selected and may omit requirements; repeated rows can associate additional sources. Stale/legacy contexts cannot borrow current snapshots or associations. There is no recruiter workspace, automatic semantic matching, cloud sharing or report persistence.

## Phase 3: offline pilot preparation

- [x] Complete protocol/harness review, including exact source-approval and per-review material identity corrections and malformed-manifest regression.
- [x] Select concrete cohort, invitation channel, proposed private storage and deletion/withdrawal process under the user's delegated decisions; prepare candidate/HR invitation drafts and session steps in the existing offline kit.
- [ ] Identify actual recipients and owner contact, verify storage/access/backups, obtain written consent, and record actual preregistration and locked randomized allocation. No people, consent, real dates or allocation are supplied yet.
- [ ] Enroll consenting candidates and reviewers: proposed feasibility target 12 complete case pairs, four active reviewers, four English/four Arabic/four mixed cases.
- [ ] Prepare candidate-approved exact packets; establish independent supplied-evidence reference annotations and claim audits before recruiter review.
- [ ] Collect the 24 baseline/packet reviews, actual corrections, disagreements, judgments, comprehension and active time; preserve actual denominators and negative/inconclusive outcomes.
- [ ] Audit participant records and assess predefined thresholds. No actual participant records or empirical findings exist.

The [offline kit](../../hr-pilot/README.md) and [protocol](../specs/2026-10-04-hr-pilot-validation-protocol.md) are preparation. Fictional rehearsals and automated tests are simulation. Supplied-source agreement does not verify credentials, hiring reliability, causality, fairness, employer demand or willingness to pay. Interview progression alone cannot establish accuracy or causality.

## Verification and release

2026-10-05 review fixes, commit `12f090a66`: assessment identity changes reset candidate requirement rows/private clarification opt-ins while same-assessment edits remain; pilot malformed nested materials/languages return invalid/null metrics without throwing and retention requires a real ISO calendar date; both print variants retain legacy string skills. Focused report/export/builder tests passed (66 tests), fictional pilot self-check passed, touched-file ESLint and type checks passed, and whitespace passed. Independent specification and quality reviews of these fixes passed with no findings; the controller also passed broad `npm run lint` after `12f090a66`. Final independent integrated specification and quality review passed for `0c3e011..135c96e`, with no P1/P2 findings; evidence is recorded in `.superpowers/sdd/2026-10-05-review-fixes-and-completion/final-review.md`. Earlier integrated review below covers the prior implementation, not these new fixes. No broad test rerun is claimed for the new commit.

Independent integrated review found one final duplicate-source provenance issue. The builder now counts IDs in raw source records before filtering; malformed duplicate records cannot establish support. Independent scoped re-review closed that finding with no new Critical or Important issue. Detailed local logs are kept in `.superpowers/sdd/2026-10-04-candidate-evidence-pilot/`.

- [x] Independent integrated review and scoped fix re-review.
- [x] Broad lint; frontend/Netlify type checks; full serial Vitest; build; locale validation; diff whitespace checks, with the snapshot distinction below.
- [ ] Explicitly authorized integration/push/PR/merge/deployment and post-deployment verification. None performed in this continuation.

| Check | Result and scope |
| --- | --- |
| Full serial Vitest | 217 files, 2,288 passed, two skipped; exit 0, 708.31 seconds. This run precedes the final duplicate-ID guard. |
| Final guard | Both new regressions failed before the fix. Implementer and independent reviewer each passed all 46 tests in the two focused files after the fix. |
| Final lint and types | Broad ESLint and frontend plus Netlify TypeScript checks passed after the guard. |
| Final build and locales | Production build and locale validation passed after the guard. Existing CSS/browser-externalization and mixed static/dynamic-import build warnings remain. |
| PDF fixtures | 100 scoped export/MainContent tests and seven real trust fixture tests passed. Arabic/mixed logical extraction remains unverified; passing fixtures do not qualify that gate. |
| Offline pilot calculator | Native fictional self-check passed; no participant validation performed. |
| Whitespace | `git diff --check` passed; staged paths are verified before local commit. |

Two implementation decisions: isolate work to avoid concurrent writes to the prior active checkout, at the cost of an extra checkout and later integration; use native JSON with candidate-declared associations, at the cost of candidate review and no automatic qualification mapping.

No new dependency/tool installation, paid model evaluation, database migration application, cloud write, participant contact/data collection or external publication occurred. Existing installed dependencies were reused through a local junction. CodeGraph, RTK.md and referenced context/CODING_STANDARDS.md are absent in this checkout; scoped RTK plus direct PowerShell reads were used. React Doctor is unavailable locally and was not installed. Native `pdftotext` is unavailable; installed pypdf/PDFium supplied independent extraction.

## Current main integration — 2026-10-05

Local merge `e86f5e4` reconciles main `211f60f`; reviewed correction `05f23b6` restores live job-description wiring for Optimize, Interview, Bulk and Cover Letter. Independent scoped re-review passes specification and quality. Current lint, frontend/Netlify types and production build have exit-0 receipts. Locales and fictional pilot recheck also pass. Full serial Vitest exited 1: 223 files (222 passed / one failed), 2,337 passed / two skipped / one failed in 690.57s. The JobFeedSection initial wait failed before clock advancement; unchanged focused whole-file recovery passed all 64 tests in 9.85s. Startup timing is plausible but exact cause unproven. The original broad run remains failed; clean CI is required before merge. Do not infer current-head success from the historical table above.

- [x] Local current-main reconciliation and independent correction review.
- [x] Run the current integrated-head gate and scoped recovery, retaining the failed broad-run caveat.
- [x] Independent gate assessment and final docs/index verification. No actionable runtime/test defect established; PR review readiness is conditional on clean CI, merge readiness is not established.
- [ ] Obtain/preserve push/PR authorization; require CI and approval before merge into main. No push, PR, main merge or deployment has occurred.

## Remaining validation — 2026-10-06

Test-only commit `0d7fd5a` synchronizes the JobFeed clock test's initial load and verification effect. A controlled probe failed with the old wait and passed with the corrected async `act`; the normal whole file passed 64/64, touched-file ESLint passed, and independent specification and quality review passed. The probe identifies a scheduling vulnerability, but it does not prove the precise cause of the 2026-10-05 full-suite failure. Runtime code and assertions are unchanged.

The controller's new full serial run on `0d7fd5a` also exited 1: 222 files passed, with 2,323 tests passed and two skipped. One worker-start timeout prevented `feedback-api.test.ts` from executing. The fixed JobFeed clock test passed within this run, with no assertion failures. A separate focused execution then passed the missing feedback file's 15 tests in 2.30 seconds. Together the receipts cover all 223 files with 2,338 unique passing tests and two skips, but they are **not one green full-suite run**. The reported elapsed time was 18,050.29 seconds; the reason for its length and for the worker-start timeout was not diagnosed. Preserve both failed full-run receipts and require clean CI before merge. Do not repeat the broad suite blindly.

The isolated `pdf-lib`/fontkit four-line probe failed visual mixed Latin/digit fidelity and exact extraction: PDFjs 2/4, PDFium 0/4, and pypdf 3/4. Its independent review passed after a wording correction. The [durable report](2026-10-06-arabic-pdf-fontkit-experiment.md) records the limited result. It is not an Arabic export fix. Previous lint, types, build, locale and fictional-pilot passes apply to unchanged runtime `05f23b6`; they were not fresh 2026-10-06 runs.

- [x] Diagnose and correct the clock test synchronization with controlled and focused evidence; preserve the unproven historical cause.
- [x] Record the second failed full serial receipt and focused feedback-file recovery without claiming a green full suite.
- [x] Run and independently review the bounded stock fontkit experiment; stop that failed route.
- [ ] Obtain clean CI and approval before merge. No push, PR, main merge or deployment has occurred.

See [current readiness and full task coverage](2026-10-05-main-readiness.md). Arabic/mixed PDF, deployed/manual/ATS and real consented candidate/HR study gates above remain open. Offline preparation and fictional calculations are complete local work, not participant results.
