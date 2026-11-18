# Watheq jobs-first implementation plan

Implements the approved [design](../specs/2026-11-16-jobs-first-design.md).

- [x] Isolate current remote main in `codex/watheq-jobs-first` and preserve billing changes.
- [x] Trace clarification, optimization dispatch, polling, worker outcome persistence, and export.
- [x] Add safe terminal telemetry, operation references, code preservation, and lookup-only recovery. Add regression checks.
- [x] Update four template layouts, names, margins, typography, workflow row, emerald controls, and RTL badge. Add layout and export checks.
- [x] Add catalogue metadata and crawl eligibility SQL for owner application.
- [x] Add authenticated search with server-side filtering/ranking before pagination and matching access without follows.
- [x] Require discipline terms independently per target role and retain bilingual normalization.
- [x] Add jobs-first navigation, filters, explicit matching, progress, evidence/gaps, saving, employer handoff, and company discovery.
- [x] Add explicit alert scope and completed-check/provider-acceptance health, retaining consent and delivery fences.
- [x] Verify 30 boards with Saudi locations and supply seed SQL and primary-response evidence.
- [x] Finish local focused checks, browser UI review, and PDF/DOCX content checks; record broad-run timeouts and remaining native-reader/Word qualification in the release report.
- [ ] Complete exact Arabic/mixed PDF source/order and native-reader searches, plus Word visual qualification.
- [ ] Owner applies SQL, preview qualifies with catalogue flags, then production checks verify Optimize, Neom download, Sentry, and alert processing separately.

Use existing dependencies and shared pipeline logic. Run lint, type checking, tests, build, and i18n validation as separate commands. Record inconclusive checks and observed limits in the release report.
