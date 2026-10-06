# Main readiness — 2026-10-05, updated 2026-10-06

Branch `codex/candidate-evidence-pilot`; reviewed runtime commit `05f23b6ca82e99b2cf6f2914e6779fe65eedfc16`, followed by test-only commit `0d7fd5aec3167b6d8afd3d1d3c9eb160173b25cb`. The latter was the branch HEAD for the 2026-10-06 test receipts, before this docs handoff. This is local implementation readiness, not release or participant validation. The original plan's unchecked instructions are not an execution ledger; do not redo completed Phase 1.

## Approved plan coverage

| Task | Actual local status | Still open |
| --- | --- | --- |
| Phase 1 / 1: assessment identity | Complete UTF-8 SHA-256 context and typed identity implemented | Production verification |
| Phase 1 / 2: context, cache and history | Context-aware admission, request ownership, persistence and snapshots implemented; legacy records remain historical | Production verification |
| Phase 1 / 3: honest scores | Alignment estimates, relative comparisons and unavailable derived estimates implemented | Hiring accuracy/probability not established |
| Phase 1 / 4: source evidence | Typed source records, hashes, attribution, numbers and semantic review implemented | Supplied sources do not prove external facts |
| Phase 1 / 5: optimization evidence | Shared optimize/stream/refine/card contracts and transport implemented | No paid-provider evaluation claimed |
| Phase 1 / 6: claim review | Exact confirmation identity, edit invalidation, variants and persistence implemented | Confirmation is not credential verification |
| Phase 1 / 7: composed export | Canonical captured snapshot reviewed before PDF/DOCX/print/cloud generation | Deployed/manual delivery checks |
| Phase 1 / 8: PDF recovery | Bounded text checks and explicit DOCX/image recovery implemented | Arabic/mixed logical fidelity |
| Phase 1 / 9: bilingual acceptance | Fictional integration and actual local handler/renderer fixtures implemented/reviewed | All templates/readers/ATS/deployed Linux not qualified |
| Phase 1 / 10: review/handoff | Phase 1 review and baseline gates completed; current integration reviewed | Current final gate recorded below |
| Continuation / 1: PDF diagnosis | Diagnosis and browser-print URL retention complete; installed jsPDF, mapping and isolated stock fontkit probes rejected | Portable Arabic extraction and mixed order unresolved |
| Continuation / 2: candidate report | Local JSON preview/download, exact requirement/source associations and opt-in clarification inclusion implemented/reviewed | Real consenting-candidate workflow validation |
| Continuation / 3: offline pilot | Protocol, blank records, fictional rehearsal, native calculator, invitation/session drafts and proposed private operation prepared/reviewed | Actual authorized consented study |
| Continuation / 4: review/handoff | Prior implementation/fixes reviewed; current main merge and P1/P2 corrections independently reviewed; test-only clock correction reviewed | Clean CI and authorized integration |

## Current main integration

Local merge `e86f5e4acf6d7a568e41494a78b23929ed97fa69` joins feature parent `56c87c1` and current main `211f60fdf42828081e19f99c7e68a2f909c1df85`, preserving assessment/evidence contracts alongside main resume-library, feed verification and three-round clarification controls. Independent review found missing live job-description props: P1 auxiliary tools and P2 Optimize's stale stored-job fallback after switching to a resume with an empty live job description. Scoped fix `05f23b6` restores all four props with red-before/green-after wiring regressions; independent scoped re-review reports Spec PASS / Quality PASS, no remaining findings in that fix scope.

Controller live target receipt: remote main remains `211f60f`; origin/main is an ancestor, with 0 remote-only / 47 branch-only commits before this docs handoff. Package manifest, lockfile and Supabase paths have no difference against origin/main. No push, PR, merge into main, deployment, cloud operation or participant contact occurred.

## 2026-10-05 gate receipts on reviewed runtime

| Check on reviewed runtime `05f23b6` | Result |
| --- | --- |
| Broad lint | Exit 0 (`lint.log`) |
| Frontend and Netlify types | Exit 0 after the four-prop fix (`task-2-types.log`) |
| Production build | Exit 0 (`build.log`); existing dynamic-import/build warnings remain |
| Full serial Vitest | Exit 1: 223 files, 222 passed / one failed; 2,337 tests passed / two skipped / one failed, 690.57s (`full-tests.log`). JobFeedSection display-clock in-flight assertion failed at the initial wait for two calls, before clock advance; unchanged whole file subsequently passed all 64 tests in 9.85s (`task-3-feed-reproduction.log`). Startup timing is plausible; exact cause remains unproven. The original broad run remains failed |
| Locale validation | Exit 0, all translations valid (`locales.log`) |
| Fictional pilot self-check | Exit 0 (`pilot-self-check.log`); blank-template CLI exit 0, simulation / zero cases / unavailable ratios / insufficient_or_targets_not_met (`pilot-template.log`). No participant validation |
| Whitespace | Controller pre-docs, docs and staged `git diff --check` exit 0 |
| Final staged paths/branch/index | Docs-only staging: readiness report, remaining checklist and controller plan; verified on named feature branch, no app/dependency paths |

Independent gate assessment read the failure, recovery and live test/runtime boundaries: no actionable runtime or test-logic defect is established. It recommends no speculative patch, assertion weakening or timeout increase. PR review readiness is conditional on clean CI; merge readiness is not established. If the failure recurs in CI, diagnose startup/load and mock/effect scheduling before choosing a fix.

## 2026-10-06 remaining validation

The clock test had a real synchronization vulnerability: its initial wait relied on host scheduling while `waitFor` polling was frozen by the test's interval mock and its real timeout kept running. Test-only commit `0d7fd5a` awaits async `act` for the resolved mount/load and verification effects before asserting the same two calls. The later 60-second clock and AbortSignal assertions remain. Controlled host-starvation evidence made the old test fail at its initial assertion and the corrected test pass; the normal complete file passed 64/64 and touched-file ESLint passed. Independent specification and quality review passed. This does not prove that host starvation caused the historical full-run failure, and no runtime code changed. See `.superpowers/sdd/2026-10-06-remaining-validation/task-1-report.md` and `task-1-review.md`.

The controller's full serial run on `0d7fd5a` **exited 1** after a reported 18,050.29 seconds. It passed 222 files and 2,323 tests, with two skipped; the fixed JobFeed clock test passed in 70 ms without an assertion failure. One worker-start timeout prevented `feedback-api.test.ts` from executing. A separate focused run then passed that missing file's 15/15 tests in 2.30 seconds. Combined, the two receipts cover all 223 files and 2,338 unique passed tests with two skips, but they are **not a single green full-suite result**. The reason for the long elapsed time and the worker-start timeout was not diagnosed; normal suite runtime is unestablished. Both the 2026-10-05 assertion failure and the 2026-10-06 worker-start failure remain failed full-run receipts. Clean CI is required before merge; no blind broad rerun is planned. Logs: `.superpowers/sdd/2026-10-06-remaining-validation/full-tests.log` and `feedback-worker-recovery.log`.

The [isolated Arabic PDF experiment](2026-10-06-arabic-pdf-fontkit-experiment.md) used bundled `pdf-lib` 1.17.1, isolated `@pdf-lib/fontkit` 1.1.1 and existing DejaVu Sans. The four-line PDF failed mixed Latin/digit visual fidelity and exact extraction: PDFjs 2/4, PDFium 0/4, pypdf 3/4. Independent review passed after correcting the description of normal RTL punctuation and lam-alef group placement. This rules out that tested stock subset `drawText` route for the current fidelity gate; it is not a production fix or a general verdict on every fontkit configuration.

Lint, frontend/Netlify types, build, locale validation and fictional pilot checks previously passed on unchanged runtime `05f23b6`; they were not rerun on 2026-10-06. The new code commit changes only the clock test. No app dependency, renderer, migration or production code changed.

Historical evidence stays scoped: the 217-file / 2,288-pass / two-skip suite recorded in the continuation checklist precedes the final duplicate-ID guard and is not current integrated-head evidence. The task-2 covering run timed out on the unchanged Interview CSV test; its focused unchanged-file recheck passed all three tests. The unique covering total is 188 passed / two skipped, not a wholly green initial run.

## Readiness and remaining gates

- [x] Reconcile current main locally and independently review the integration corrections.
- [x] Preserve candidate-first evidence, privacy, scores, export review and current-main controls.
- [x] Run current serial tests and scoped failure recovery; preserve the 2026-10-05 failed broad-run receipt and unresolved exact cause. Lint/types/build/locales/fictional checks passed on the unchanged runtime.
- [x] Independently review the 2026-10-06 test-only clock correction, complete a new serial run, and retain its worker-start failure plus focused feedback-file recovery. Neither full run is green.
- [x] Independently review the isolated fontkit experiment and record its failed fidelity gate.
- [ ] Push/publish PR only within explicit authorization after local gates; CI must pass before an approved merge into main. No remote action is performed by this report.
- [ ] Verify deployed Linux Chromium, real native print dialog and Save-as-PDF content, manual reader copy/search/select, additional templates and downstream readers/ATS. Prior local native-print/URL evidence does not complete this broader gate.
- [ ] Resolve portable logical Arabic extraction/search/copy and full mixed-language fact/punctuation/digit order on actual bytes. Legible pixels, local fixtures and DOCX XML checks cannot establish that result. See [bounded follow-up](2026-10-05-arabic-pdf-followup.md).
- [ ] Obtain separate authorization for contact/collection/sharing; identify actual recipients and owner withdrawal contact; verify private storage/access/backups and actual retention/deletion route.
- [ ] Record written candidate/reviewer consent, actual preregistration and locked randomized allocation; obtain exact-version and per-source candidate approval and inspect actual delivery.
- [ ] Complete 12 consented pairs, four reviewers, four English/four Arabic/four mixed cases, independent annotations/adjudication and 24 baseline/packet reviews; audit corrections, judgments, time, comprehension, withdrawals, denominators and negative outcomes.
- [ ] Calculate and manually audit actual participant results against preregistered thresholds. HR reliability, causality, fairness, employer demand and willingness to pay remain unvalidated.

Reviewed local implementation has a local PR draft with both failed-full-run receipts and scoped recoveries. Clean CI is required before merge. Local checks cannot establish a qualified Arabic PDF export or validated HR product. Merge into main awaits CI and approval. The [remaining checklist](2026-10-04-candidate-evidence-pilot-remaining.md), [pilot kit](../../hr-pilot/README.md) and [protocol](../specs/2026-10-04-hr-pilot-validation-protocol.md) retain those boundaries.

Tooling: no CodeGraph index/RTK.md in this isolated checkout. RTK reads were used where suitable; narrow PowerShell reads provided full multi-file evidence because compressed output omitted necessary detail. No app dependency or tool configuration changed; the approved experiment installed `@pdf-lib/fontkit` with a lockfile only in its ignored QA folder.
