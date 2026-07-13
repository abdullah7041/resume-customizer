# ATS Explainability Panel + Before/After Score Diff — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Explain *why* the match score is what it is (matched keywords, missing requirements, weak evidence, caution notes — each mapped to real resume/JD text already in API responses) and show original vs projected optimized score with per-card attribution for `applied: true` cards only.

**Architecture:** Pure frontend derivation. One new pure utility converts existing match/optimize response data into a 4-bucket explainability model; two new components render it; the score diff reuses the exact projection formula already in `OptimizeSection.resultsSummaryData`. Zero backend changes, zero new AI calls.

**Tech stack:** React 19, TypeScript, Zustand (persist), Zod, react-i18next (ar/en, RTL via logical properties), Vitest.

## Context

Users see a score but not why. The data to explain it **already exists** in responses and is partially discarded/unrendered today. Score movement after optimization is currently a bare before→after number with no card attribution. This feature surfaces existing evidence; it must not create a parallel scoring path or fabricate anything.

## Global Constraints (verbatim from spec)

- No parallel scoring system, no new AI scoring call. Derive everything from existing response data.
- Never fabricate evidence. Every displayed claim maps to actual resume or JD text.
- Anti-inflation rules in `processMatchOnly` and `optimizeResume` are untouchable (they live in `netlify/lib/ai-contracts/contracts/index.js:834, 849-857, 865-874` — no file under `netlify/` is modified by this plan).
- Optimizations count only when `applied: true`. Missing skills stay recommendations, never auto-injected.
- Bilingual ar/en + RTL. Projected gains presented as estimates, never guarantees.
- No resume/JD text in analytics or logs (metadata only — follow `src/services/api.js:502-514` pattern).
- State through `resumeStore.ts` patterns; storage keys `watheq:` prefix; no `any` types (interfaces in `src/types/`).

---

## Verified audit findings (drive the design — do not re-litigate)

1. **Evidence already exists, server-verified.** `strategicRealityCheck` from ai-match carries `strengths[].evidence[{source:'resume'|'job_description'|'both', snippet}]`, `confirmedRisks[].evidence[...]`, `unclearRisks[{topic, reason, evidenceNeeded}]`, `limits{cannotDetermine[], assumptions[]}`. Snippets are verified server-side (`netlify/lib/strategic-reality-check.js:221-257` strips snippets without ≥75% token overlap with source). Rendering them verbatim client-side cannot fabricate.
2. **Explainability half-exists in MatchSection.** `src/components/sections/MatchSection.tsx:640-670` renders reality-check summary + top-2 confirmedRisks + top-2 unclearRisks. Evidence snippets and `strengths` are typed (lines 80-109, local private types) but **never rendered**. Extend, don't duplicate.
3. **`hiddenMatches` is always empty from live endpoints.** `optimize.ts:395-399` and `optimize-stream.ts:332` hardcode empty `keywordStrategy`; `ai-match.ts:142` returns `keywordStrategy: null`, `gapAnalysis: []`. Weak-evidence bucket must be built on `unclearRisks` (reliably populated — fallback generator at `strategic-reality-check.js:200-218`); `hiddenMatches` is optional passthrough only. Match-side missing bucket uses `missingKeywords` + per-category arrays, not gapAnalysis.
4. **Rich per-category keyword evidence exists.** ai-match `categoryScores.*` carry `matched?/missing?/gaps?` string arrays + `reasoning` (typed in `MatchSection.tsx:151-156`, `ScoreBreakdown.tsx:8-15`) but flow **untyped** through `OptimizationMetrics.categoryScores` (`src/types/templates.ts:147-152` types only `{score, max, reasoning}`). Type-widening needed (type-only).
5. **`source_span` deliberately dropped in card transform.** `optimize.ts:254-258` + `optimize-stream.ts:470-472` comments say span stays on raw object for future "proof on hover". **Decision: leave it dropped.** Experience cards' `original`/`exampleBefore` already IS the verbatim resume bullet — per-card resume evidence exists without span. Passthrough would be an additive API change for near-zero value; deferred.
6. **Optimize response contains no reality check and no vulnerabilities** (`detectVulnerabilities` output is prompt-only, never returned). Explainability in optimize context must come from the cached match analysis.
7. **`matchAnalysis` is React state** (`src/components/Layout/MainContent.tsx:401`), not in Zustand; lost on refresh (Match tab renders empty state post-refresh anyway). Store cache `CachedAnalysisSchema` (`src/lib/validation/store-schemas.ts:186-195`) keeps only `{score, coverage, similarity, missingKeywords, strongMatches, recommendations, overallAssessment, timestamp}` — no reality check / categoryScores. MainContent already writes `suggestions`/`reasoning` outside the schema (schema not enforced at write boundary).
8. **Existing projection formula** (`OptimizeSection.tsx:376-393`): `beforeScore` priority `baselineMatchScore → optimizationMetrics.beforeScore → cachedAnalysis → meta.match_score → 55`; `afterScore = beforeScore + Math.round((optimizationMetrics.improvement ?? 15) × appliedCount/total)`; `isScoreVerified` when auto-verify (`OptimizeSection.tsx:732-780`, temp-applies **all** cards) produced `verifiedScore`. The score diff must reuse this memo's outputs, never re-derive.
9. **`applied` lifecycle complete:** `applyOptimization` (`resumeStore.ts:268`), `revertOptimization` (:277), bulk (:324/:333), `getActiveResume` skips `!applied` (:410). `OptimizationResult` = `src/types/templates.ts:36-48`.

## Design decisions

- **D1 — One panel component, two mounts, two sources.** `AtsExplainabilityPanel` mounts in MatchSection (fed from live `matchAnalysis` prop) and OptimizeSection (fed from `getCachedAnalysis(resumeText, jobDesc, false)` + `optimizationMetrics.gapAnalysis`). One pure derivation function normalizes both.
- **D2 — Score diff: aggregate-first, equal-share legend, no per-card invented precision.** Projection stays byte-identical to `resultsSummaryData` (values passed in as props from the same memo). Per-card row shows section label + first ~60 chars of `original` (real resume text, identification only) + counted/not-counted state. One legend line: "each applied suggestion adds ≈ +X pts to the estimate" where `X = (improvement ?? 15)/totalCards` to 1 decimal — shown once, never per row. Equal share is the *only* honest derivation because the existing formula is linear in `appliedCount`; any weighting would be a parallel scoring system. When `verifiedScore` exists: "Verified" badge + explicit caveat that verification ran with ALL suggestions applied; estimate remains the projection for the current subset.
- **D3 — Store: extend `CachedAnalysis` with optional fields; no new slice, no new storage keys, no new actions.** `optimizationMetrics` rejected as home (optimize-flow lifecycle, reset by `resetOptimizationMetrics`; reality check is match-flow output). New slice rejected (duplicates `analysisCache` per-(resume,JD) + TTL + eviction semantics). Everything rides existing `watheq:resumeStore` persist/partialize.
- **D4 — Zero backend changes.** No `netlify/*`, no `src/services/api.js` changes.

## ⚠️ FLAGGED: schema / contract changes (all additive; approve before implementing)

| Change | Kind | Back-compat |
|---|---|---|
| `CachedAnalysis` type + `CachedAnalysisSchema`: add optional `categoryScores?`, `strategicRealityCheck?`; also add already-written-but-unschema'd `matchedKeywords?/suggestions?/reasoning?` to make schema truthful | **Persisted localStorage store schema change** (`watheq:resumeStore`) | All optional; legacy entries parse unchanged; schema not enforced at write boundary today. localStorage on user's own device — analytics/log constraint not implicated (resume text already persisted there via `parsedResumeText`) |
| `OptimizationMetrics.categoryScores` widened with `matched?/missing?/gaps?: string[]` | Type-only | Runtime data already flows; no behavior change |
| **API contracts: NONE.** `source_span` passthrough explicitly deferred (finding 5) | — | — |

## Data flow

```
MATCH: ai-match response {score, missingKeywords, strongMatches,
       categoryScores{*.matched/missing/gaps/reasoning},
       strategicRealityCheck{strengths[].evidence, confirmedRisks[].evidence,
                             unclearRisks, limits}}
  → analyzeResumeWithAI (api.js:449-538, normalize :492)
  → MainContent.handleAnalyzeMatchAI (~:999-1037)
      ├→ setMatchAnalysis → MatchSection prop
      │     → deriveAtsExplainability(source) → <AtsExplainabilityPanel context="match">
      └→ setCachedAnalysis(..., {+categoryScores, +strategicRealityCheck})  [NEW fields]
            (persisted: watheq:resumeStore → analysisCache)

OPTIMIZE: optimize.ts response {cards, matchScoring{beforeScore, estimatedImprovement,
          matchedKeywords, jdKeywords}, gapAnalysis, categoryScores, ...}
  → OptimizeSection.handleGenerateActual → optimizations[] + optimizationMetrics
      ├→ resultsSummaryData memo (:376-393, UNCHANGED)
      │     → <ScoreDiffBreakdown> (inside existing Score Summary card)
      │        ← optimizations[] (applied:true counted), before/after/potential,
      │          verifiedScore, isScoreVerified, improvement
      └→ getCachedAnalysis(resumeText, jd, false) + optimizationMetrics.gapAnalysis
            → deriveAtsExplainability → <AtsExplainabilityPanel context="optimize">
```

## Files

**Create**

| Path | Purpose |
|---|---|
| `src/types/explainability.ts` | New interfaces (below). No `any`. |
| `src/lib/utils/deriveAtsExplainability.ts` | Pure derivation: sources → 4 buckets; dedupe; null-safe; never synthesizes. |
| `src/lib/utils/deriveAtsExplainability.test.ts` | Unit tests. |
| `src/components/AtsExplainabilityPanel.tsx` | 4 collapsible buckets, evidence source badges, disclaimer. Collapsed by default. |
| `src/components/ScoreDiffBreakdown.tsx` | Per-card counted/not-counted list + estimate/verified labels. |
| `src/locales/en/sections/explainability.json` + `src/locales/ar/sections/explainability.json` | `sections.explainability.*` keys. |
| `src/__tests__/AtsExplainabilityPanel.test.tsx`, `src/__tests__/ScoreDiffBreakdown.test.tsx` | Component tests. |

**Modify**

| Path | Change |
|---|---|
| `src/types/analysis.ts` | Extract `StrategicRealityCheck`, `RealityCheckEvidence`, `RealityCheckStrength`, `ConfirmedRisk`, `UnclearRisk` from MatchSection's private types (`MatchSection.tsx:80-109`). |
| `src/types/templates.ts` | `CachedAnalysis` (:87-99): + optional `categoryScores?`, `strategicRealityCheck?`. `OptimizationMetrics.categoryScores` (:147-152): widen per finding 4. |
| `src/lib/validation/store-schemas.ts` | `CachedAnalysisSchema` (:186-195): optional fields per flagged table. |
| `src/components/Layout/MainContent.tsx` | `setCachedAnalysis` payload (~:1010-1016): add `categoryScores: result.categoryScores ?? null, strategicRealityCheck: result.strategicRealityCheck ?? null`. |
| `src/components/sections/MatchSection.tsx` | Import shared types (delete local copy); mount panel in results area after existing cards (~:891); extend `hasDetailedResults` (:375-383) with `strengths?.length \|\| limits?.assumptions?.length`. |
| `src/components/sections/OptimizeSection.tsx` | `<ScoreDiffBreakdown>` inside existing Score Summary GlassCard below before/arrow/after row (~:1294) — exactly one before/after display; `<AtsExplainabilityPanel>` after `ScoreBreakdown` (~:1387). |
| `src/locales/{en,ar}/sections/optimize.json` | `sections.optimize.scoreDiff.*` keys. |
| `src/locales/{en,ar}/index.ts` | Register `sections/explainability.json`. |
| `src/__tests__/OptimizeSection.test.jsx`, `src/lib/stores/resumeStore.test.ts`, match test | Extend (see tests). |

**Untouched:** everything under `netlify/`, `src/services/api.js`, existing cards (`ScoreBreakdown`, `GapAnalysisCard`, `HiddenMatchesCard`, `MirroredKeywordsCard` keep current roles; panel complements, doesn't replace).

## Types & components

```ts
// src/types/explainability.ts
import type { GapAnalysisItem, HiddenMatch, StrategicRealityCheck } from './analysis';
import type { CategoryScoresData } from './analysis'; // reuse existing

/** Raw inputs — all optional; all data verbatim from existing responses. */
export interface AtsExplainabilitySource {
  matchedKeywords?: string[];                 // strongMatches | topHits | matchedKeywords
  missingKeywords?: string[];
  categoryScores?: CategoryScoresData | null;
  realityCheck?: StrategicRealityCheck | null;
  gapAnalysis?: GapAnalysisItem[];            // optimize context only
  hiddenMatches?: HiddenMatch[];              // passthrough; currently always empty upstream
}

export interface ExplainabilityKeyword {
  term: string;
  category?: 'hard_skills' | 'experience' | 'education' | 'soft_skills';
}

export interface AtsExplainability {
  matched:      { keywords: ExplainabilityKeyword[]; strengths: StrategicRealityCheck['strengths'] };
  missing:      { keywords: ExplainabilityKeyword[]; gaps: GapAnalysisItem[] };
  weakEvidence: { unclear: StrategicRealityCheck['unclearRisks']; hiddenMatches: HiddenMatch[] };
  caution:      { risks: StrategicRealityCheck['confirmedRisks']; assumptions: string[]; cannotDetermine: string[] };
  isEmpty: boolean;
}
```

- `AtsExplainabilityPanel` props: `{ source: AtsExplainabilitySource; context: 'match' | 'optimize'; className?: string }`. Derives via `useMemo`; returns `null` when `isEmpty`. Evidence snippets verbatim in quoted block + source badge. Logical properties only (`ms-*`, `me-*`, `text-start`, `border-s-*`).
- `ScoreDiffBreakdown` props: `{ beforeScore, afterScore, potentialScore, improvement: number | null, isScoreVerified, isPlaceholderScore, isPlaceholderImprovement, optimizations: OptimizationResult[], className? }`. Internal display math only: `perCardShare = total > 0 ? (improvement ?? 15)/total : 0` (1 decimal, legend only).

**Derivation rules (mechanical, zero generation):**
- `matched.keywords` = case-insensitive dedupe of `matchedKeywords ∪ categoryScores.*.matched`, category-tagged when sourced from a category.
- `missing.keywords` = dedupe of `missingKeywords ∪ categoryScores.*.missing ∪ categoryScores.*.gaps`, minus matched.
- Reality-check arrays pass through verbatim (`?? []`); `missing.gaps` = verbatim `gapAnalysis`.
- **Invariant (tested):** every output string exists exactly in some input field — filter/dedupe allowed, synthesis never.

## Zustand changes

No new slice, actions, or storage keys. `CachedAnalysis` gains two optional fields written by the existing `setCachedAnalysis` call in MainContent, read by OptimizeSection via existing `getCachedAnalysis(resumeText, jobDesc, false)`. Cache eviction (10 entries) / TTL unchanged; entry growth bounded (reality-check arrays server-clamped).

## i18n keys (en values shown; ar file required with identical keys, proper readable Arabic)

`sections.explainability.`: `title` "Why this score" · `subtitle` "Every item below comes from your resume, the job description, or the analysis you already ran — no new AI call." · `disclaimer` "Derived entirely from your existing analysis. Nothing here is newly generated." · `expand`/`collapse` · `sourceBadge.resume` "From your resume" / `sourceBadge.job_description` "From the job description" / `sourceBadge.both` "Resume + job description" · `buckets.matched.{title,keywords,strengths,whyItMatters,empty}` · `buckets.missing.{title,keywords,gaps,currentState,recommendation,empty,note}` (`note` = "These stay recommendations — Watheq never adds skills you don't have.") · `buckets.weak.{title,reason,evidenceNeeded,hiddenMatch,empty}` · `buckets.caution.{title,mitigation,assumptions,cannotDetermine,empty}` · `severity.{critical,high,medium,moderate,minor}` · `itemCount_one`/`itemCount_other`.

`sections.optimize.scoreDiff.`: `title` "Score projection" · `estimateBadge` "Estimate" · `estimateNote` "Projected gains are estimates based on the suggestions you applied — not a guarantee." · `verifiedBadge` "Verified" · `verifiedNote` "Verified by AI re-analysis with all suggestions applied." · `appliedOf` "{{applied}} of {{total}} suggestions applied" · `perCardShare` "Each applied suggestion adds about +{{points}} pts to the estimate" · `counted` / `notCounted` · `noneApplied` "Apply suggestions to see their effect on the projection." · `potentialNote` "Up to {{score}}% if all suggestions are applied (estimate)" · `showCards` / `hideCards`.

## Analytics (metadata only)

- `explainability_panel_opened` → `{context, matchedCount, missingCount, weakCount, cautionCount, riskTier|null}`
- `score_diff_expanded` → `{appliedCount, totalCount, isVerified, improvementEstimate}`
- Never keyword strings, snippets, or resume/JD text. Follow `trackStrategicRealityCheck` pattern (`MatchSection.tsx:275-282`).

## Test list (Vitest; mock patterns from `OptimizeSection.test.jsx` — react-i18next t=key, store selector mock; `buildFixture`/`buildOpt` from `resumeStore.test.ts`)

1. `deriveAtsExplainability.test.ts`: dedupe matched across sources case-insensitively; missing excludes matched; reality-check arrays verbatim passthrough; **never-synthesize invariant** (every output string ∈ inputs, property-style over fixtures); null realityCheck/categoryScores/empty → `isEmpty`; optimize context includes gapAnalysis, match context empty gaps.
2. `AtsExplainabilityPanel.test.tsx`: four buckets w/ counts; evidence snippet verbatim + resume badge; null render when empty; missing-skills note copy present; ar smoke under `dir=rtl`.
3. `ScoreDiffBreakdown.test.tsx`: counts only `applied:true`; estimate badge+note when unverified; verified badge + all-applied caveat; equal-share legend = `improvement/total` to 1 decimal shown once; zero applied → `noneApplied` + +0; placeholder score/improvement → em-dash, no fabricated numbers.
4. `OptimizeSection.test.jsx` (extend): ScoreDiffBreakdown mounts in score summary when optimizations exist; panel fed from cached analysis; **formula-parity test** — diff projection equals `resultsSummaryData.afterScore` for same applied set.
5. `resumeStore.test.ts` (extend): `setCachedAnalysis` round-trips new fields; legacy-shape entry (no new fields) reads without error.
6. Match test (`JobMatch.test.jsx` or new `MatchSection.explainability.test.tsx`): panel renders with realityCheck fixture; `hasDetailedResults` true with strengths only.

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Formula fork: diff drifts from `resultsSummaryData` | Medium | Diff receives computed values as props from same memo; formula-parity test |
| Verified score misread as per-selection actual (auto-verify = all-applied) | Medium | Explicit `verifiedNote` copy; estimate stays visible for current subset |
| Equal per-card share read as AI-asserted precision | Medium | Single legend line, "about/≈", 1 decimal, Estimate badge; no per-row numbers |
| `hiddenMatches` / match-side `gapAnalysis` always empty → hollow buckets | Certain | Conditional bucket rendering; weak bucket built on `unclearRisks` (fallback generator guarantees ≥1) |
| Legacy localStorage entries lack new fields | Certain | All optional + null guards; legacy-entry test |
| Denominator includes non-appliable display-only cards (e.g. certification recs) | Existing behavior | Unchanged (no invented weighting); code comment |
| Panel duplicates info already shown (chips, risks) | Medium | Panel collapsed-by-default; MatchSection top-3 chips stay as summary |
| Arabic overflow / RTL breakage in evidence quotes | Low | Logical properties only; `text-start`; ar smoke test |
| Text leakage into analytics | Low | Counts/enums only; review checklist item |
| `improvement === 0` fallback path before auto-verify completes | Medium | perCardShare 0 → legend hidden; estimate labeling unchanged |

## Task order (TDD; dependencies noted)

1. **T1 Types** — extract reality-check types to `analysis.ts`; create `explainability.ts`; widen `templates.ts`. Gate: `npm run type:check` clean.
2. **T2 Derivation util** (needs T1) — test first, then implement. Gate: `npm run test -- deriveAtsExplainability`.
3. **T3 Store/schema** (needs T1) — extend `CachedAnalysisSchema` + store tests + MainContent wiring.
4. **T4 i18n** — both locale files + registration (correct readable Arabic in JSON; terminal may display it reversed — that's a rendering artifact, write it correctly).
5. **T5 Panel component** (needs T2, T4) — test first.
6. **T6 Match mount** (needs T5) — MatchSection integration + test.
7. **T7 ScoreDiff component** (needs T4) — test first.
8. **T8 Optimize mounts** (needs T3, T5, T7) — OptimizeSection integration + formula-parity test.
9. **T9 Analytics + sweep** (needs T6, T8) — metadata-only events; verify no text in payloads.

Commit per task. Focused checks per CLAUDE.md Quality matrix (components → relevant Vitest + `lint:fix`; store/schema → focused tests + `type:check`). Broad gate as separate sequential legs (`npm run lint` → `npm run type:check` → `npm run test`) only at the end.

## Verification (end-to-end)

1. `npm run dev` (NOT `dev:netlify` — esbuild OOM on this box; functions via tsx harness if needed).
2. Real flow: upload real PDF → Match tab → analyze → panel shows matched/missing/weak/caution with verbatim snippets + source badges; toggle ar → RTL layout correct.
3. Optimize → apply subset of cards → score diff shows counted/not-counted rows, estimate badge, projection identical to header numbers; apply all → auto-verify → Verified badge + caveat.
4. Refresh page → OptimizeSection panel still populated (cache round-trip).
5. DevTools: analytics/Sentry payloads contain counts/enums only.
6. Sequential broad gate legs green.
