# Main integration readiness — 2026-10-05

User requested complete local checklist and readiness to push/merge main. Existing approved specs remain authoritative: candidate-trust-foundations, candidate-evidence-pilot. Do not redo completed Phase1.

## Global constraints
Preserve original and prior checkouts. No new dependencies/tools, paid evaluation, DB/cloud writes, participant collection, push or merge into main/deployment. Reconcile current origin/main into isolated feature branch only. Scores remain alignment estimates; no independent qualification verification; unresolved PDF checks remain unverified. Do not overwrite current main features or candidate-trust behavior wholesale. Do not claim empirical pilot completion.

## Task 1: Reconcile current main
Base feature head56c87c1, origin/main211f60f; origin5ahead and branch45ahead. Merge-tree showed18 conflicting files. Inspect both sides and main commits ec2a610,8861e83,a02c6c5,bab3f39,211f60f. Perform reversible local merge of origin/main on codex/candidate-evidence-pilot and resolve conflicts preserving candidate trust and latest main controls/feed features. No ours/theirs whole-file blanket resolutions. Diagnose frontend/API/schema/persistence interfaces including automatically merged files. Add focused regression only for uncovered integration behavior. Run focused tests, touched lint, typecheck; commit local merge. If actual provider/cloud behavior unavailable record it, do not simulate success. Write report with exact conflict resolutions and meaningful checks.

## Task 2: Independent integration review
Review actual merge diff against both parents for lost/overwritten contracts, assessment request identity, local evidence privacy, latest UIcontrols, jobfeed inputs/verification bounds and clarification endpoints/schema. Fix concrete issues and scoped re-review. No broad reruns until integrated source stable.

## Task 3: Full readiness gate and checklist
Run sequential lint, typecheck, production build, serial full tests, i18n validation, pilot self-check and gitdiffcheck, capture exit/results. Preserve meaningful incompleteness if failures/timeouts. Verify ancestor origin/main, final diffscope/no unexpected deps/migrations, cleanindex and namedbranch. Refresh main-plan coverage and readiness doc: separate merge-blocking regressions from acknowledged Arabic PDF and real study/deployment limitations. Prepare concrete reviewer-ready PR text locally; do not publish/push/merge main. Record user-visible outstanding items honestly.
