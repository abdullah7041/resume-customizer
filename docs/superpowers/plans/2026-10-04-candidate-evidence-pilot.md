# Candidate Evidence and Pilot Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for implementation and independent scoped reviews. Do not repeat completed Phase 1 Tasks 1–10.

**Goal:** Deliver the candidate-controlled local evidence report and executable offline pilot preparation, resolving or honestly documenting Arabic PDF text fidelity.

**Architecture:** Reuse existing assessment/evidence/export contracts; native local JSON downloads and a Node offline calculator. No server or persistence expansion.

**Tech Stack:** Existing React/TypeScript/Zustand/Vitest, Chromium PDF renderer/PDF.js, Node built-ins.

**Spec:** [Authorized design](../specs/2026-10-04-candidate-evidence-pilot-design.md).

## Global constraints

Isolated checkout from `4c422ab`; preserve both prior checkouts and uncommitted ownership. No dependencies, paid/cloud calls, DB application, participant collection/contact, publication, push/merge/deploy. Source provenance is not credential verification. Scores remain alignment estimates. Clarifications require candidate opt-in.

## Review focus

- Changed/stale assessment or legacy snapshot must not acquire a current score or new source mappings.
- Excluded clarification must not leak through proposal, confirmation or assessment narrative.
- Duplicate/forged references, wrong target or fingerprint must not gain supported status.
- Arabic presentation glyphs, mixed direction and multipage text must not gain false text-checked status.
- Empty/invalid/partial pilot data must never yield an empirical pass or fabricated zero error.

## Task 1: PDF diagnosis and native correction

**Files:** Production handler/render/checker files only where diagnosis warrants; `src/services/exportPdf.js` and test for separately inspected URL retention; fresh ignored QA harness/artifacts and a tracked verification report.

- [ ] Inspect real fixture bytes/items/direction/fonts/ToUnicode and independent installed extraction before edits.
- [ ] Reproduce any discovered root cause with actual handler, production stylesheet and TemplateRenderer; create failing regression before the minimal fix.
- [ ] Generate fresh EN/AR/mixed/multipage artifacts and inspect pages plus sampled substantive facts/order. Preserve unverified states on insufficient evidence.
- [ ] Run focused affected export/handler/checker suites and touched-file lint; obtain independent scoped review.

## Task 2: Candidate-controlled report

**Files:** Focused report type/builder/panel/test files, `src/components/sections/OptimizeSection.tsx`, and both export locales. Exact names chosen by implementer to fit existing directories.

**Consumes:** `AssessmentRecord`, `AssessmentContext`, `EvidenceSource`, `EditEvidence`, `CandidateConfirmation`, complete SHA-256 context utility. **Produces:** Candidate preview and immutable local JSON download; no persistence/API changes.

- [ ] Trace active assessment/store/source/review/export boundaries; distinguish edit support from job requirement support.
- [ ] Pin stale context, missing/forged refs, wrong target/fingerprint, excluded clarifications and immutable download behavior in focused tests.
- [ ] Add exact-JD requirement/source selection with candidate-declared associations, visible gaps and opt-in source clarifications; separate edit provenance and alignment estimate disclaimer.
- [ ] Independently validate context/sources/proposal before report construction; preview and download the same captured bytes.
- [ ] Run builder/panel/Optimize tests, touched ESLint, types and locales; obtain independent scoped review.

## Task 3: Executable offline pilot preparation

**Files:** `docs/hr-pilot/` protocol/templates/native Node tool/self-check; focused pilot spec if needed.

**Consumes:** Explicitly identified read-only prior draft materials. **Produces:** Preregistered thresholds, blank study contract, fictional rehearsal and calculation/validation CLI.

- [ ] Copy suitable materials with provenance; remove stale report-deferral and prior export-qualification claims.
- [ ] Define numerator/denominator, missingness, sample and language/pairing gates before fixtures.
- [ ] Implement validation/calculation using Node built-ins; self-check missing consent/context, invalid labels, empty denominators and incomplete strata.
- [ ] Run fictional rehearsal and blank-template checks, keeping participant evidence absent; obtain independent scoped review.

## Task 4: Integrated review and handoff

- [ ] Review entire continuation diff independently; route findings to implementers and scoped re-review.
- [ ] Run separate sequential `npm run lint`, `npm run type:check`, `npm test -- --reporter=verbose --no-file-parallelism`, `npm run build`, `npm run i18n:validate`, and `git diff --check`; retain logs and exit codes.
- [ ] Record exact completed, simulated, unverified, participant-dependent and unreleased items in a linked remaining-plan checklist. Local commits may preserve reviewed changes; no push/merge/deploy.

Self-review: each design boundary maps to one task. Tasks own separate files; no speculative recruiter workspace or silent sharing. User selected execution already; proceed with implementation and scoped review.
