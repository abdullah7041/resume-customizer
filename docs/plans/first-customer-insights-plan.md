# First-Customer Report → Product Changes — Goal Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan workstream-by-workstream. Steps use checkbox (`- [ ]`) syntax for tracking. Read `CLAUDE.md` first — its gotchas (optimize latency, shared card-building logic, quality matrix) are binding.

**Goal:** Make the 7-day manual customer-validation test convert. A guest must complete a full free run on 1 real job ad (upload → paste JD → match score → suggestions) with zero sign-in friction, see why each suggestion serves that specific job ad, and see what Watheq refused to invent. Instrument the funnel so the validation test produces measurable signal.

**Source:** First-customer research (2026-07-14), 10 qualified Saudi job-seeker prospects from public Reddit signals. The plan implements only what the evidence supports.

## Context: what the evidence says

- 8 of 10 prospects want to know what changes for a specific vacancy and whether the result is readable/relevant — the job-ad comparison is the product, templates are secondary.
- 7 of 10 ask for guidance, review, and explanations over blank-page generation.
- 3 threads show explicit distrust: paid CV services, AI exaggeration, advice to falsify dates. The no-invented-experience stance is a purchase criterion.
- Outreach plan depends on a 15-minute guided test on the prospect's own vacancy. Success signals: 3 guided tests, 2 users completing a second job-specific resume unaided, 1 explicit 29 SAR willingness signal.

## Already done — do not rebuild

- Workflow is job-ad-first: upload → match → optimize → download stepper (`src/components/ui/UserProgressNav.tsx:168-197`).
- Landing page (majlis) leads with "upload resume, paste job ad", carries "No invented experience, ever", ask-before-optimization, free tier, and 29 SAR waitlist (`src/locales/{en,ar}/landing/majlis.json`).
- Anti-inflation scoring rules in match + optimize prompts (untouchable, see CLAUDE.md).
- `(verify)` markers on inferred metrics; `applied: true` lifecycle; truth check feature.
- Explainability panel + score diff: fully specced in `docs/plans/trust-pair-plan.md`. Execute that plan; do not re-derive it here.

## Global constraints

- No feature creep beyond this plan. Simplest implementation that works.
- Never fabricate evidence, never promise ATS passage or interviews in any copy.
- Bilingual ar/en + RTL for anything user-facing. All 10 prospects write in Arabic.
- Anti-inflation prompt rules and parse_resume contract details in CLAUDE.md are untouchable.
- No resume/JD text in analytics or logs — metadata only.
- Quality gates per CLAUDE.md matrix; broad gate as sequential legs only at the end.

---

## WS1 — Guest free run, end to end (highest priority; blocks outreach)

A prospect from Reddit must reach a match score + suggestions on 1 real job ad without signing in. Verified current guest state (2026-07-14 audit): uploads capped at 2MB (`src/services/api.js:20`, vs 8MB signed-in), OCR fallback gated to signed-in users, truth check gated (`MainContent.tsx:1174-1178`), save/export gated. `OptimizeSection` receives `isGuestMode` but never uses it (`OptimizeSection.tsx:97` declared, never destructured) — harmless, gating happens elsewhere.

The real blocker for this workstream's own success metric: guest free runs are ONE-SHOT BOOLEANS (`watheq:freeMatchUsed`, `watheq:freeOptimizeUsed` in localStorage), not counters. First match and first optimize work unauthenticated (server already allows `freePreview` with no credits — `optimize.ts:60,379`, `ai-match.ts:37,81,154`). The SECOND run of either drops `freePreview` and `getAuthHeaders({requireAuth:true})` throws `"Authentication required."` (`api.js:478,589,773`). That makes `second_jobad_run` — the report's key success signal — impossible today.

- [x] Replace the one-shot boolean with a run counter, 3 free runs per feature per browser. Rename `watheq:freeMatchUsed`/`watheq:freeOptimizeUsed` → count-based keys (e.g. `watheq:freeMatchRuns`, `watheq:freeOptimizeRuns`); migrate any existing `'true'` value to count=1 so returning guests don't regress. Touchpoints: `MatchSection.tsx` (`hasFreePreviewRun`/`markFreePreviewUsed`, ~lines 41, 204-209) and `OptimizeSection.tsx` (~lines 103-106). Keep sending `freePreview: true` for every run under the cap so the existing server no-auth/no-credit path is untouched. Sign-in prompt only fires after the 3rd run per feature. *(commit 171950c, reviewed clean)*
- [x] Audit the guest path manually: landing CTA → upload → paste JD → match → optimize → apply a card → view result → second JD, second match, second optimize. Document every remaining block/error/sign-in prompt. Sign-in gates on save/export/truth-check/refine-bullet stay as-is (already correct). *(code-trace audit — no live browser available this session; all 4 checks below PASS at the code level, no blockers found)*
- [x] Scanned PDFs (OCR is signed-in only): verify the existing localized failure message is showing correctly — `UploadSection.tsx:221-228` (`upload.errors.unreadable`/`unreadableHint`, ar+en already present) plus the pre-emptive guest toast `toasts.ocrFallbackGuestDesc` (`MainContent.tsx:962-979`). This is largely already built; fix only if the audit finds a gap. *(verified PASS, no gap found)*
- [x] Funnel events (metadata only, follow the `guest_preview_*` pattern at `src/services/analytics.ts:264-288`): `guest_run_started`, `guest_match_scored`, `guest_suggestion_applied`, `guest_run_completed`, `second_jobad_run` (a 2nd match run with a different JD in the same browser, now possible after the counter fix above). None of these five exist yet — build all. *(commit 12c334e, reviewed approved)*
- [x] Verify the panel from `AtsExplainabilityPanel` (already built, see WS2) renders correctly for guest runs — it is not auth-gated, confirm visually during this audit. *(verified PASS — no isGuestMode gate anywhere in the panel)*
- [x] Verify the Arabic guest path specifically: Arabic resume + Arabic job ad end to end, RTL rendering on every screen in the run, including a second JD run. *(code-level i18n audit PASS — all guest-relevant strings route through t(), ar/en keys match; actual visual RTL rendering CANNOT be verified without a live browser in this environment — do this manually before outreach)*

**Acceptance:** a fresh incognito guest completes score + suggestions on a real Arabic job ad in under 15 minutes with no sign-in prompt on the core path, AND can run a second job ad (match + optimize) unauthenticated within the 3-run cap. Funnel events visible with counts only.

## WS2 — Explainability panel + score diff (verification only — already implemented)

`docs/plans/trust-pair-plan.md` (T1–T9) is fully built and shipped, verified 2026-07-14: `src/types/explainability.ts`, `src/lib/utils/deriveAtsExplainability.ts` (+test), `AtsExplainabilityPanel.tsx` (+test) mounted in `MatchSection.tsx:808` and `OptimizeSection.tsx:1474`, `ScoreDiffBreakdown.tsx` (+test), ar/en `sections/explainability.json`, analytics events `explainability_panel_opened`/`score_diff_expanded` in `analytics.ts`. Neither panel is auth-gated — both already render for guests off existing response data. No implementation work remains; do not rebuild it.

- [x] Run trust-pair-plan.md's own verification section once, including the guest case (covered by the WS1 audit's panel check above). *(confirmed T1–T9 all already implemented and guest-visible; no code work needed)*

**Acceptance:** trust-pair plan's own verification section passes, including the guest case.

## WS3 — Per-card "why" on initial optimize generation (thread-through, not new AI work)

Cards currently carry `rationale`/`issue` on the client type only when refined via the single-bullet correction loop (`src/types/templates.ts:38-50`). Verified 2026-07-14: the reason data ALREADY EXISTS upstream and is silently dropped — no contract, prompt, or latency work needed. The optimize contract already requires per-bullet `issue`/`rationale` (`netlify/lib/ai-contracts/contracts/index.js:213-214,222`); the server already puts them on cards as `issue` + `suggestion` (`netlify/functions/optimize.ts:291-292`, parallel path `MainContent.tsx:1355-1356`); the client transform reads `{issue?, suggestion?}` off each card but discards them when building `OptimizationResult` (`OptimizeSection.tsx:689-728`).

- [x] Thread the existing `issue`/`suggestion` (→ `rationale`) fields through the `OptimizeSection.tsx:689-728` transform onto `OptimizationResult` instead of dropping them. Reuse the existing optional `rationale`/`issue` fields already on the type (`src/types/templates.ts:38-50`) — no new type fields, no schema change, no prompt change. *(commit eca39b3)*
- [x] Confirm the `MainContent.tsx:1355-1356` parallel card-building path (legacy `optimize.ts` fallback) carries the same fields through — both paths must agree, same as `optimize.ts`/`optimize-stream.ts` sharing the transform. *(confirmed via diff — both paths agree on shape; `netlify/` untouched)*
- [x] Render on cards in `OptimizeSection` under the diff, collapsed or muted; ar/en keys. *(rendered in JobGroupCard.tsx, reusing existing refine-loop i18n keys — no new locale keys needed)*
- [x] Anti-inflation rules untouched; the rendered reason must reference actual JD text already produced by the existing prompt, never new claims about the candidate — no prompt change needed since the field is already prompt-enforced. *(verified: rationale rendered verbatim from opt.suggestion, never reworded)*

**Acceptance:** cards from a fresh optimize run show a one-line reason tied to the JD, sourced from data the API already returns; both endpoints (streaming + legacy fallback) surface it; no latency change (no new tokens requested).

## WS4 — Copy audit: promises and pricing framing

Baseline verified clean 2026-07-14: grep of `src/locales/**` for guarantee/ATS-pass/يضمن/ضمان found no outcome-guarantee copy — every hit is an existing anti-guarantee disclaimer (`sections/optimize.json:7` en+ar, `landing/majlis.json:151`) or a benign "ensure accuracy" usage (`ar/vision2030.json:66`, `ar/sections/coverLetter.json:26`). Only the pricing-framing task remains.

- [x] Pricing section: frame 29 SAR against per-edit human CV services (prospect's stated pain: paying per revision, ~recurring cost). Keep "planned / waitlist" honesty as is. *(commit 70278ae — new `proFramingNote` key, en+ar, `pricingNote` left unchanged)*
- [x] Re-grep as final acceptance check (see below) to confirm no regression introduced by the pricing copy change. *(clean)*
- [x] `git diff --check` only for copy-only changes per quality matrix; i18n validation via `quality:full` legs if locale files change structurally. *(this change added a render point + CSS, not copy-only — ran `type:check` + `eslint` instead, both clean)*

**Acceptance:** grep for promise language ("guarantee", "ATS pass", "يضمن") returns nothing in user-facing strings; pricing copy names the per-edit alternative.

---

## Do not build (explicitly out of scope)

- Auto-apply / job-application concierge / employer contact. One prospect wants it; the report flags it as partial fit. Say so in copy if asked, never promise it.
- University / career-center B2B features. Evidence is D2C only.
- New scoring paths, template gallery work, or any channel besides the product itself.

## Order and verification

WS1 → WS2 → WS3 → WS4. WS1 ships alone first; outreach can start the day it's done. Each workstream: focused checks per CLAUDE.md matrix, commit per task. Final: sequential broad-gate legs (`npm run lint` → `npm run type:check` → `npm run test`), then the real-flow check — incognito guest, real Arabic CV, real job ad from LinkedIn, full run, apply cards, read every reason and panel item for fabrication.
