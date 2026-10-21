# Candidate Trust Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Watheq's candidate assessments, AI edits, saved versions, and final exports traceable and honest before introducing an HR pilot.

**Architecture:** Add a small assessment-context module, a typed evidence record validated on the server, and a pure export-review preflight consumed by existing UI flows. Extend the current store and variant snapshots; retain existing renderers and providers. Deliver the existing Phase 1 flow in dependency order, without building the later HR report or workspace.

**Tech Stack:** React 19, TypeScript, Zustand, Zod, Netlify Functions, Vitest, existing PDF.js/Puppeteer/DOCX tools, native Web Crypto.

**Spec:** `docs/superpowers/specs/2026-09-24-candidate-trust-foundations-design.md` (approved by the user; introduced in commit `157ff84`).

## Global Constraints

- “Keep Watheq candidate-first.”
- “A score is not a hiring recommendation or probability.”
- “No phase establishes independent verification of employment, qualifications, or candidate statements.”
- “New dependencies, providers, paid model campaigns, production routing changes, or deployment” are excluded.
- “Database migrations or a new cloud persistence system” are excluded. Evidence remains in existing private local storage.
- “General refactoring or unrelated work already present in the checkout” is excluded.
- Preserve original candidate content, existing credit/auth gates, recommendation-only skill cards, and merge-integrity checks.
- Use English and Arabic copy; do not embed resume text in logs, analytics, errors, or assessment identifiers.
- Read `CLAUDE.md`, `AGENTS.md`, and `docs/adr/ADR-job-specific-resume-builder.md` before execution. Use CodeGraph first for code discovery.
- Worktree isolation happens at execution time. The source checkout contains unrelated model-evaluation work, including `netlify/lib/ai-contracts/executor.js`; do not copy or discard those changes without checking their relevance.
- This plan is not implementation, paid-evaluation, publishing, or deployment authorization. Execution begins after the user reviews it and selects a method.

## Review Focus

1. Equal-length resumes/JDs with identical first 100 characters must not collide in the current memoized cache (Tasks 1–2).
2. A late response after A → B → A navigation must not replace a newer A request merely because its content matches (Task 2).
3. Repeated bullets and identical numbers under different employers must not borrow each other's evidence (Tasks 4–6).
4. Legacy sessions without an original baseline must remain reviewable without invented provenance or deleted data (Tasks 6–7).
5. Arabic digits, bidirectional text, omitted sections, and edits during export must not create false trust badges or export a different document from the one reviewed (Tasks 7–9).

## File map and ownership

New files below are planned, not assumed to exist. Paths are repository-relative. Do not move existing large components wholesale.

| Unit | Files | Responsibility |
| --- | --- | --- |
| Context | `src/types/assessment.ts`; `src/lib/match/assessmentContext.ts` | Immutable input identity, compatibility, and request admission. |
| Evidence contract | `src/types/optimization-evidence.ts`; `netlify/lib/optimization-evidence.ts` | Typed provenance, source lookup, conservative live validation. |
| Review | `src/lib/optimize/evidenceReview.ts`; `src/components/sections/optimize/EvidenceReview.tsx` | Claim-specific candidate resolution and fingerprint-bound confirmation. |
| Export preflight | `src/lib/optimize/exportPreflight.ts` | Which applied changes actually reach a document and require review. |
| Export text check | `src/lib/utils/pdfTextCheck.ts` | Bounded selectable-text verification with honest unknown/failure states. |
| Existing integration | `resumeStore.ts`, `templates.ts`, `store-schemas.ts`, `MainContent.tsx`, `OptimizeSection.tsx`, `BulkAnalysisSection.tsx`, API/services/export files listed per task | Thread metadata through existing boundaries. |

## Delivery order

Tasks 1–3 deliver context integrity and honest presentation. Tasks 4–7 deliver evidence from generation through candidate review. Tasks 8–9 deliver export recovery and bilingual integration. Task 10 reviews the complete branch. Each task ends in its own focused check and commit; no intermediate commit should advertise a complete evidence-backed export flow.

### Task 1: Define assessment identity without partial-text collisions

**Files:** Create `src/types/assessment.ts`, `src/lib/match/assessmentContext.ts`, `src/lib/match/__tests__/assessmentContext.test.ts`.

**Interfaces:**

```ts
export type AssessmentKind = 'match' | 'optimize';
export interface AssessmentInput {
  resumeText: string;
  jobDescription: string;
  language: 'en' | 'ar';
  kind: AssessmentKind;
  isOptimized: boolean;
  rubricVersion: string;
}
export interface AssessmentContext {
  key: string;
  resumeFingerprint: string;
  jobFingerprint: string;
  language: 'en' | 'ar';
  kind: AssessmentKind;
  isOptimized: boolean;
  rubricVersion: string;
}
export interface AssessmentRecord<T> {
  context: AssessmentContext;
  jobSnapshot: string;
  requestId: string;
  createdAt: string;
  result: T;
  model?: string;
}
export function fingerprintText(text: string): Promise<string>;
export function createAssessmentContext(input: AssessmentInput): Promise<AssessmentContext>;
export function isCurrentAssessment(saved: AssessmentContext | undefined, active: AssessmentContext): boolean;
export function canAcceptAssessment(activeRequestId: string | null, responseRequestId: string,
  saved: AssessmentContext, active: AssessmentContext): boolean;
```

- [ ] Write tests for full-content differences, language/rubric/kind differences, original-versus-optimized, absent legacy context, and out-of-order request IDs. Construct contexts using this local test helper:

```ts
const input = (resumeText: string): AssessmentInput => ({ resumeText,
  jobDescription: 'Build APIs', language: 'en', kind: 'match',
  isOptimized: false, rubricVersion: 'match-v1' });
it('distinguishes same-length content with the same prefix', async () => {
  const prefix = 'x'.repeat(100);
  const a = await createAssessmentContext(input(prefix + 'A'));
  const b = await createAssessmentContext(input(prefix + 'B'));
  expect(a.key).not.toBe(b.key);
});
it('rejects an older request for identical inputs', async () => {
  const context = await createAssessmentContext(input('Resume'));
  expect(canAcceptAssessment('new', 'old', context, context)).toBe(false);
});
```

- [ ] Run `npm test -- src/lib/match/__tests__/assessmentContext.test.ts`; confirm meaningful failure before implementation.
- [ ] Implement SHA-256 over exact UTF-8 input, with no prefix memoization or delimiter ambiguity. Keep request ID and creation time outside cache identity. Generate the key from a JSON tuple of digests and settings. Do not silently downgrade hashing when Web Crypto fails: callers show an error before spending a credit.

```ts
export async function fingerprintText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function canAcceptAssessment(activeRequestId: string | null, responseRequestId: string,
  saved: AssessmentContext, active: AssessmentContext): boolean {
  return activeRequestId === responseRequestId && saved.key === active.key;
}
```

- [ ] Run the focused test, `npm run type:check`, and lint the new `.ts` files with `npx --no-install eslint`.
- [ ] Stage only this task's files and commit `feat: identify assessments by complete input context`.

### Task 2: Bind cache, requests, bulk rows, and historical reports to context

**Files:** Modify `src/lib/stores/resumeStore.ts:119`, `src/types/templates.ts`, `src/components/Layout/MainContent.tsx`, `src/components/sections/MatchSection.tsx`, `src/components/sections/OptimizeSection.tsx`, `src/components/sections/BulkAnalysisSection.tsx`; extend `src/lib/stores/resumeStore.test.ts`, `src/__tests__/bug-bulk-analysis.test.tsx`, `src/__tests__/score-drift-bug.test.jsx`; create `src/__tests__/assessment-context-flow.test.tsx`.

**Consumes:** Task 1 context functions and `AssessmentRecord<T>`.

**Produces:** Store methods `getCachedAssessment(context: AssessmentContext): CachedAnalysis | null` and `setCachedAssessment(context: AssessmentContext, analysis: CachedAnalysis): void`; add optional `assessment?: AssessmentRecord<CachedAnalysis>` to compatible persisted records. Preserve existing `CachedAnalysis` fields and TTL behavior. New callers use the context-aware methods; remove old context-free callers before retiring their methods.

- [ ] Add regression cases for job change after completion, restored legacy rows, same-prefix cache collisions, language change, and A → B → A with two deferred A requests. Assert that historical PDF content uses saved `jobSnapshot` and never the current prop.

```ts
it('does not reuse a cache entry for changed content', async () => {
  const base = { jobDescription: 'API work', language: 'en' as const,
    kind: 'match' as const, isOptimized: false, rubricVersion: 'match-v1' };
  const a = await createAssessmentContext({ ...base, resumeText: 'x'.repeat(100) + 'A' });
  const b = await createAssessmentContext({ ...base, resumeText: 'x'.repeat(100) + 'B' });
  expect(a.key).not.toBe(b.key);
  expect(isCurrentAssessment(a, b)).toBe(false);
});
```

- [ ] Run `npm test -- src/__tests__/bug-bulk-analysis.test.tsx src/__tests__/assessment-context-flow.test.tsx src/lib/stores/resumeStore.test.ts` and capture failing assertions.
- [ ] Capture immutable inputs before hashing/request dispatch; allocate the request ID before any asynchronous work. On any input change, clear the active request ID immediately and show pending/outdated state; this also covers delayed hashing. Compare both request ID and context before admitting cache hits or network results. In `finally`, clear loading only for the still-active request.

```ts
const requestId = crypto.randomUUID();
activeRequest.current = requestId;
const capturedInput = { ...assessmentInput };
const context = await createAssessmentContext(capturedInput);
if (activeRequest.current !== requestId) return;
const cached = useResumeStore.getState().getCachedAssessment(context);
```

In each existing handler, use its existing API call after this prefix and the same identity guard before each state write. Store the unmodified submitted JD separately from the ADR's truncated variant display text. Preserve full submitted content identity even where server prompts truncate it; do not imply that omitted input was evaluated. Keep snapshots within existing request limits, private, and associated with the assessment. Bulk rankings exclude incompatible contexts; legacy/history remain inspectable. Never automatically rerun paid requests during restoration.
- [ ] Run the focused tests plus `src/__tests__/score-drift-bug.test.jsx`, `npm run type:check`, and lint touched files. Inspect the mocked PDF text assertion and all request completion branches.
- [ ] Commit `fix: prevent stale assessment reuse and report mismatches`.

### Task 3: Remove misleading measurements and hiring claims

**Files:** Modify `netlify/functions/ai-match.ts:172`, `src/components/sections/BulkAnalysisSection.tsx:149`, `src/components/sections/MatchSection.tsx`, `src/lib/optimize/scoreModel.ts`, `src/components/sections/optimize/ScoreHeader.tsx`, `src/locales/en/trust.json`, `src/locales/ar/trust.json`, `src/locales/en/sections/match.json`, `src/locales/ar/sections/match.json`, `src/locales/en/sections/bulk.json`, `src/locales/ar/sections/bulk.json`, `README.md`, `CLAUDE.md`; extend `src/__tests__/bug-bulk-analysis.test.tsx` and `src/lib/optimize/__tests__/scoreModel.test.ts`.

**Consumes:** Current versus historical result status from Task 2.

**Produces:** Existing scores labelled as estimated alignment; no duplicated coverage/similarity widget; relative rank label; original reality-check evidence retained on cache reuse. No new scoring algorithm.

- [ ] Add low-score comparison and absent-independent-measurement regressions using the existing bulk test harness. Assert that a score of 20 can be highest-ranked without being labelled suitable. Add a score-model case where absent projected score remains unavailable, instead of deriving improvement from card count.

```tsx
expect(screen.queryByText('Best Match')).not.toBeInTheDocument();
expect(screen.queryByText('Coverage')).not.toBeInTheDocument();
expect(screen.getByText('Highest score in this comparison')).toBeInTheDocument();
```

- [ ] Run `npm test -- src/__tests__/bug-bulk-analysis.test.tsx src/lib/optimize/__tests__/scoreModel.test.ts` and confirm failures caused by the old labels/derived values.
- [ ] Retain deprecated numeric API aliases only if a current compatibility consumer still requires them; annotate them and remove all presentation dependence. Do not calculate a replacement coverage percentage. Carry `strategicRealityCheck`/existing evidence through cached bulk results. Remove card-count-derived improvement from visible reporting; leave real existing projected values labelled estimated, not verified. Keep the overall/category decoupling unchanged. Update copy:

```text
English: Estimated alignment with this job description
Arabic: تقدير التوافق مع هذا الوصف الوظيفي
English: Highest score in this comparison
Arabic: أعلى درجة في هذه المقارنة
English: This assessment does not predict a hiring decision.
Arabic: هذا التقييم لا يتنبأ بقرار التوظيف.
```

Check `netlify/lib/optimize-cards.ts:154` and its consumers when removing fallback presentation; if the API return type must change to represent unavailable estimates, include its focused tests and update both endpoints together. Update repository instructions that mandate inferred metrics or say “hireable today,” keeping proprietary notices intact.
- [ ] Run focused tests, `npm run type:check`, `npm run i18n:validate`, and lint touched code. Search touched surfaces for “hireable today,” unconditional “Best Match,” and coverage derived from score.
- [ ] Commit `fix: describe alignment scores and comparisons honestly`.

### Task 4: Define evidence records and conservative live validation

**Files:** Create `src/types/optimization-evidence.ts`, `netlify/lib/optimization-evidence.ts`, `netlify/lib/__tests__/optimization-evidence.test.ts`; modify `netlify/lib/ai-contracts/contracts/index.js` and `netlify/lib/__tests__/ai-contracts.test.js`.

**Interfaces:** Shared types live in `src/types`; backend uses type-only imports with Node-compatible extensions. Runtime validation remains in `netlify/lib` so client bundles do not import server modules.

```ts
export interface EvidenceSource {
  id: string;
  kind: 'resume' | 'clarification';
  text: string;
  fingerprint: string;
  targetId: string;
  createdAt?: string;
}
export interface EvidenceReference { sourceId: string; quote: string }
export interface EditEvidence {
  version: 1;
  targetId: string;
  originalFingerprint: string;
  proposedFingerprint: string;
  references: EvidenceReference[];
  sourceFingerprints: Record<string, string>;
  status: 'source_matched' | 'needs_review' | 'rejected' | 'legacy';
  reasons: Array<'missing_source' | 'wrong_target' | 'new_number' | 'semantic_review' | 'legacy'>;
}
export interface EvidenceCandidate {
  targetId: string;
  original: string;
  proposed: string;
  references: EvidenceReference[];
}
export function validateEditEvidence(candidate: EvidenceCandidate,
  sources: EvidenceSource[]): Promise<EditEvidence>;
```

- [ ] Write tests for missing quotes, wrong employer, user clarification, exact unchanged text, Arabic-Indic numbers, and a fabricated metric marked “verify.” Use deterministic source fixtures with authentic hashes generated during setup, not manually claimed fingerprint strings.

```ts
it('does not treat a number from another employer as support', async () => {
  const source: EvidenceSource = { id: 'b', kind: 'resume', text: 'Cut cost 40%',
    fingerprint: await fingerprintText('Cut cost 40%'), targetId: 'work-b' };
  const result = await validateEditEvidence({ targetId: 'work-a', original: 'Improved service',
    proposed: 'Cut cost 40%', references: [{ sourceId: 'b', quote: 'Cut cost 40%' }] }, [source]);
  expect(result.status).toBe('rejected');
  expect(result.reasons).toContain('wrong_target');
});
```

- [ ] Run `npm test -- netlify/lib/__tests__/optimization-evidence.test.ts` and confirm failure.
- [ ] Build immutable source blocks from the actual supplied resume and candidate clarifications; assign target IDs per structured role/project/field, including original-content identity to survive reordering. Ambiguous repeated text gets review, not first-match attribution. Verify fingerprints server-side with native crypto. Validate every quote against its identified source and target. Normalize digits for number comparisons only; preserve original source text. Do not strip words, units, currency, or percentage signs when deciding whether a fact changed.

```ts
const source = sources.find(item => item.id === reference.sourceId);
const exists = source !== undefined && source.text.includes(reference.quote);
const belongsToTarget = source?.targetId === candidate.targetId;
```

Classify missing/misattributed sources as rejected. A matching source with new numbers requires review. Even without new numbers, an altered sentence receives `semantic_review` unless it is text-identical apart from whitespace: quotation checks cannot prove that a paraphrase follows from the source. Keep `source_matched` a literal source label, not real-world verification. Candidate review resolves conservative uncertainty in Task 6. Add structured evidence references to fresh output contracts and keep legacy deserialization compatibility separate from fresh-response requirements.
- [ ] Run both evidence and AI-contract tests, type checking, and touched-file lint. Verify no backend runtime imports reach browser-only utilities.
- [ ] Commit `feat: validate optimization evidence against supplied sources`.

### Task 5: Thread evidence through optimize, streaming, refinement, and cards

**Files:** Modify `netlify/lib/ai-contracts/contracts/index.js`, `netlify/lib/ai-contracts/executor.js`, `netlify/lib/optimize-cards.ts`, `netlify/functions/optimize.ts`, `netlify/functions/optimize-stream.ts`, `netlify/functions/refine-bullet.ts`, `netlify/lib/resume-schemas.ts`, `src/services/api.js`, `src/components/sections/OptimizeSection.tsx`, `src/components/shared/OptimizationCard.tsx`, `src/types/templates.ts`, `src/lib/validation/store-schemas.ts`; extend `netlify/lib/__tests__/ai-contracts.test.js`, `src/__tests__/OptimizationCard.test.jsx`; create `netlify/lib/__tests__/optimize-evidence-flow.test.ts`.

**Consumes:** Task 4 `EditEvidence`, `EvidenceSource`, and `validateEditEvidence`.

**Produces:** Optional legacy-compatible `evidence?: EditEvidence` on `OptimizationResult`; new runtime results always supply it. Refinement returns the replacement edit's evidence. Evidence source records remain private session data, not public resume fields.

- [ ] Mock the provider and assert equal evidence behavior for ordinary and streaming optimization, plus refinement. Cover no-metric source, source-free headline/summary rewrites, candidate hard stops, valid clarification, one invalid item among valid items, and unchanged credit/auth behavior.

```ts
expect(card.evidence).toEqual(validatedEvidence);
expect(card.exampleAfter).not.toContain('(verify)');
expect(refined.evidence.proposedFingerprint).not.toBe(previous.evidence.proposedFingerprint);
```

Use existing endpoint harnesses for calls and fixtures; define `validatedEvidence`, `card`, `refined`, and `previous` from the mocked source/response under test, not global values.
- [ ] Run `npm test -- netlify/lib/__tests__/ai-contracts.test.js netlify/lib/__tests__/optimize-evidence-flow.test.ts src/__tests__/OptimizationCard.test.jsx` and confirm the evidence-loss regression fails.
- [ ] Replace inferred-number instructions in both prompt builders with qualitative results or a request for a real figure. Include stable source IDs in the supplied data. Apply validation after shape parsing for optimize/refine contracts only. Preserve unrelated executor metadata edits. Carry evidence through card building and `normalizeOptimization`; include headlines and summaries, not only bullets. Reject invalid items with structured `{ status, code, message }` diagnostics free of resume text. Keep valid items. If none remain usable, follow the endpoint's existing unusable-output error/credit handling and add no retry. Render literal source snippets safely as text and identify their source kind.

```ts
return {
  ...existingCard,
  evidence: validatedEvidence,
};
```

The snippet is the return-shape change at existing card construction, not a new wrapper API. Update API types so UI receives structured metadata; never reduce it back to an unverified string field.
- [ ] Run focused tests, `npm run type:check`, and touched-file lint. Verify streaming and nonstreaming parity without real provider calls.
- [ ] Commit `feat: preserve evidence across resume editing flows`.

### Task 6: Persist claim-specific candidate review and legacy state

**Files:** Create `src/lib/optimize/evidenceReview.ts`, `src/lib/optimize/__tests__/evidenceReview.test.ts`, `src/components/sections/optimize/EvidenceReview.tsx`; modify `src/lib/stores/resumeStore.ts:169`, `src/types/templates.ts`, `src/lib/validation/store-schemas.ts`, `src/components/sections/OptimizeSection.tsx`, `src/components/shared/OptimizationCard.tsx`, `src/locales/en/optimization.json`, `src/locales/ar/optimization.json`; extend `src/lib/stores/resumeStore.test.ts` and `src/lib/stores/resumeStore.mergeIntegrity.test.ts`.

**Interfaces:**

```ts
export interface CandidateConfirmation {
  proposedFingerprint: string;
  targetId: string;
  confirmedAt: string;
  statement: string;
}
export function isConfirmationCurrent(evidence: EditEvidence,
  confirmation: CandidateConfirmation | undefined): boolean;
```

Store `confirmation?: CandidateConfirmation` on an optimization, and `evidenceSources: EvidenceSource[]` on the working set and variant snapshot. Add store actions `confirmOptimization(sectionId: string, confirmation: CandidateConfirmation): void` and `setEvidenceSources(sources: EvidenceSource[]): void`. The UI hashes the displayed statement before invoking the action; the action verifies that the statement exactly equals the current proposed text and that the proposal fingerprint and target match. A confirmation records the displayed claim; no generic “verified” boolean. For array-valued content, use the same JSON serialization for hashing and equality throughout generation, refinement, confirmation, and export; do not join arrays with an ambiguous delimiter.

- [ ] Test refinement after confirmation, unrelated edits, role reordering, two identical bullets, variant switching, malformed legacy evidence, and storage migration for versions 0–3. Test missing original baseline without deleting the visible resume.

```ts
expect(isConfirmationCurrent(evidence, {
  proposedFingerprint: evidence.proposedFingerprint,
  targetId: evidence.targetId, confirmedAt: '2026-09-24T12:00:00Z', statement: proposed,
})).toBe(true);
expect(isConfirmationCurrent({ ...evidence, proposedFingerprint: 'changed' }, confirmation)).toBe(false);
```

- [ ] Run `npm test -- src/lib/optimize/__tests__/evidenceReview.test.ts src/lib/stores/resumeStore.test.ts src/lib/stores/resumeStore.mergeIntegrity.test.ts` and capture failures.
- [ ] Add a compact review section showing source, proposed claim, and the three actions: confirm the displayed claim, edit wording, revert. Applying remains a separate action. A candidate confirmation may resolve a previously unsupported claim as a new candidate statement; retain that distinction. Editing invalidates its prior confirmation and recomputes the fingerprint. Refining an already applied card must not preserve its previous approval.

```ts
export function isConfirmationCurrent(evidence: EditEvidence,
  confirmation: CandidateConfirmation | undefined): boolean {
  return confirmation?.proposedFingerprint === evidence.proposedFingerprint
    && confirmation.targetId === evidence.targetId;
}
```

Bump persisted version 3 to 4, composing existing migrations. Add empty sources and legacy statuses without erasing content or generating confirmations. Copy sources and confirmations in `snapshotWorkingSet`, restore them in `openVariant`, and extend schema validation so fields are not stripped. Do not sync them to cloud payloads. If storage fails, show that review could not be saved; never show a persisted success state. With no baseline, allow explicit review of the current document in Task 7; do not infer which old text was generated.
- [ ] Run focused tests, type checking, locale validation, and touched-file lint.
- [ ] Commit `feat: preserve candidate review through edits and variants`.

### Task 7: Gate every first-party final export on the exact composed document

**Files:** Create `src/lib/optimize/exportPreflight.ts`, `src/lib/optimize/__tests__/exportPreflight.test.ts`; modify `src/lib/optimize/mergeResume.ts`, `src/components/sections/TemplatesSection.tsx`, `src/components/Layout/MainContent.tsx:2325`, `src/services/exportPdf.js`, `src/services/exportDocx.ts`, `src/lib/utils/pdfExport.ts`, `src/types/templates.ts`; extend `src/__tests__/TemplatesSection.test.jsx`, `src/services/exportPdf.test.js`, `src/lib/utils/pdfExport.test.ts`.

**Interfaces:**

```ts
export interface ExportReviewInput {
  documentFingerprint: string;
  includedEdits: OptimizationResult[];
  legacyDocumentConfirmation?: { documentFingerprint: string; confirmedAt: string };
  missingBaseline: boolean;
}
export type ExportReviewResult =
  | { allowed: true; documentFingerprint: string }
  | { allowed: false; documentFingerprint: string; sectionIds: string[]; reason: 'review_required' | 'legacy_review' };
export function reviewExport(input: ExportReviewInput): ExportReviewResult;
```

**Consumes:** Task 6 `isConfirmationCurrent`; existing merge result. Extend the merge result to identify edit section IDs actually incorporated into output, rather than assuming every `applied` card merged.

- [ ] Add cases for unresolved included edits, unapplied/reverted/failed-merge cards, original-resume export, legacy document review, and modifying the document while export is pending. Assert PDF, DOCX, and the MainContent print/cloud route all call the guard before generation/upload.

```ts
expect(reviewExport({ documentFingerprint: 'd', includedEdits: [], missingBaseline: false }))
  .toEqual({ allowed: true, documentFingerprint: 'd' });
expect(reviewExport({ documentFingerprint: 'd', includedEdits: [], missingBaseline: true }))
  .toMatchObject({ allowed: false, reason: 'legacy_review' });
```

- [ ] Run `npm test -- src/lib/optimize/__tests__/exportPreflight.test.ts src/__tests__/TemplatesSection.test.jsx src/services/exportPdf.test.js src/lib/utils/pdfExport.test.ts` and confirm regression failures.
- [ ] Use the existing merge as the canonical document composition for review and export. Reconcile MainContent's separate `mergeResumeData` route: pass the reviewed structured document into the renderer, do not independently reapply raw suggestions after review. Fingerprint the exact composed data and capture an immutable export snapshot. While generation runs, export only that snapshot; if the UI changes, do not substitute current data or claim the new state has been downloaded. Keep auth/guest gates in place.

```ts
const snapshot = structuredClone(useResumeStore.getState().getActiveResume());
if (!snapshot) return;
const documentFingerprint = await fingerprintText(JSON.stringify(snapshot));
```

Collect included edits from the same composition operation and pass them to `reviewExport`. If blocked, open the review section with the exact section IDs. Missing-baseline legacy documents need an explicit document-level review tied to this fingerprint. Browser-print utilities cannot prove the eventual OS-created PDF: mark that route unverified. Public low-level render helpers may remain pure, but every app entry point must pass the guard; tests enumerate all known callers. Do not treat this client workflow as tamper-proof server attestation.
- [ ] Run focused tests, type checking, and touched-file lint. Check that cloud-export calls send only existing permitted content and no private evidence sidecar.
- [ ] Commit `feat: review composed resume changes before export`.

### Task 8: Make PDF fallback explicit and check extracted text

**Files:** Create `src/lib/utils/pdfTextCheck.ts`, `src/lib/utils/pdfTextCheck.test.ts`; modify `src/components/sections/TemplatesSection.tsx:535`, `src/locales/en/export.json`, `src/locales/ar/export.json`, `src/services/exportPdf.js`; extend `src/__tests__/TemplatesSection.test.jsx`. Inspect existing `src/lib/utils/resumeText.ts` and analytics export event implementation for reuse; do not add an extraction dependency.

**Interfaces:**

```ts
export interface ExpectedPdfText { fields: Array<{ id: string; text: string }> }
export type PdfTextCheck = { state: 'text_checked' | 'unverified'; missingFieldIds: string[] };
export function comparePdfText(extracted: string, expected: ExpectedPdfText): PdfTextCheck;
export function checkPdfBlob(blob: Blob, expected: ExpectedPdfText): Promise<PdfTextCheck>;
```

- [ ] Test normal server PDF, 429/503, timeout, blank file, image-only output, text-check timeout, Arabic digits, and excluded sections. Existing template tests must prove raster generation is not called automatically on server failure.

```ts
expect(comparePdfText('', { fields: [{ id: 'name', text: 'ليلى' }] }))
  .toEqual({ state: 'unverified', missingFieldIds: ['name'] });
expect(comparePdfText('ليلى 2024', { fields: [{ id: 'name', text: 'ليلى' }] }).state)
  .toBe('text_checked');
```

- [ ] Run `npm test -- src/lib/utils/pdfTextCheck.test.ts src/__tests__/TemplatesSection.test.jsx` and confirm expected failures.
- [ ] Replace automatic raster catch behavior with explicit recovery choices: retry PDF, download DOCX, or choose image-only PDF. Preserve current server timeouts and busy responses. Reuse existing PDF.js initialization; bound text checking to 5 seconds, destroy parser resources on completion/timeout, and cap to 20 pages. Over-limit files remain unverified, not unreadable. No extra model call.

Normalize Unicode to NFC, collapse whitespace, remove bidi formatting controls for comparison, and compare Arabic-Indic/Western digits consistently. Do not delete Arabic letters or reverse strings. Build expected fields from the visible template sections of the captured export document: name/contact when present, employers/dates, and representative bullet text. A missing field yields an unverified state and choices, not a universal ATS failure claim. A passing check is labelled “Selectable text checked,” never “ATS approved.”

```text
English: Image-only PDF — text cannot be selected; some systems may need OCR.
Arabic: ملف PDF على هيئة صور — لا يمكن تحديد النص، وقد تحتاج بعض الأنظمة إلى التعرف الضوئي عليه.
```

Distinguish analytics format/quality values `pdf_text_checked`, `pdf_unverified`, `pdf_image`, and `docx` in existing consent-gated events. Browser-print completion remains unverified. Preserve the original export snapshot across recovery choices and invalidate the attempt on a deliberate new export request.
- [ ] Run focused tests, type checking, locale validation, and touched-file lint.
- [ ] Commit `fix: distinguish text exports from image-only fallbacks`.

### Task 9: Pin the bilingual generation-to-export acceptance path

**Files:** Create `src/__tests__/candidate-trust-flow.test.tsx`, `src/__tests__/fixtures/candidate-trust.ts`, `netlify/lib/__tests__/candidate-trust-contract.test.ts`; extend `src/__tests__/TemplatesSection.test.jsx` and affected locale tests. Use existing test render/store helpers; do not install browser automation tools.

**Consumes:** Task 1 context, Tasks 4–6 evidence/review, Tasks 7–8 export preflight and quality checks. No new production interface.

- [ ] Add fictional English and Arabic fixture resumes with different employers, identical bullet fragments, real supplied metrics, and a no-metric role. Include equivalent Arabic/English facts and a mixed-language multi-page fixture. Mock provider output and record no real candidate information.

```ts
export const trustFacts = {
  name: 'Test Candidate',
  english: 'Built an API at Example A. Reduced latency by 20%.',
  arabic: 'طورت واجهة برمجية في شركة المثال أ. خفضت زمن الاستجابة بنسبة ٢٠٪.',
  qualitative: 'Maintained internal reports at Example B.',
};
```

- [ ] Run the new test files before adding full assertions to establish that the harness is connected; then introduce each acceptance assertion and confirm it fails if its guard is disabled. Do not use a trivially passing snapshot as integration evidence.
- [ ] Test the complete sequence: assess → propose → inspect source → confirm/edit/revert → apply → save variant → reload → export. Assert correct context after switching, matching confirmation fingerprints after reload, no fallback numbers, and no automatic image export. Test both optimization endpoints against the same contract fixtures.

```ts
expect(exportDecision.allowed).toBe(true);
expect(exportedContext.key).toBe(assessedContext.key);
expect(includedEdit.confirmation?.proposedFingerprint)
  .toBe(includedEdit.evidence?.proposedFingerprint);
```

Use test-owned values from the simulated pipeline for these assertions. Generate real PDF fixture outputs using the existing renderer in a local harness and inspect extracted field order plus rendered pages for English, Arabic, mixed-language, and multi-page examples. Avoid network/model calls. Record any renderer/environment blocker as inconclusive, not passed. Check DOCX output preserves the same substantive facts; do not equate successful blob creation with content correctness.
- [ ] Run `npm test -- src/__tests__/candidate-trust-flow.test.tsx netlify/lib/__tests__/candidate-trust-contract.test.ts src/__tests__/TemplatesSection.test.jsx --no-file-parallelism`, type checking, locale validation, and touched-file lint.
- [ ] Commit `test: cover candidate trust flow across languages and exports`.

### Task 10: Review complete scope and prepare the handoff

**Files:** All intended changes; update the approved spec only to record an explicitly accepted design change, not to disguise an implementation deviation. No new feature scope.

**Interfaces:** No new interfaces. This is the release-readiness gate for the preceding work.

- [ ] Review the branch diff for unsupported facts, source misattribution, lost saved data, stale requests, privacy leakage, old export paths, and overlapping unrelated edits. Use the selected execution method's review workflow. Fix confirmed issues and rerun their focused tests.
- [ ] Execute the broad checks separately and sequentially:

```text
npm run lint
npm run type:check
npm test -- --reporter=verbose --no-file-parallelism
npm run build
npm run i18n:validate
git diff --check
```

Capture each exit. These are the broad/build/i18n legs, run separately to avoid the in-agent parallel gate timeout. Do not blindly repeat timed-out broad commands or run paid evaluation scripts. If a gate cannot complete, name the missing evidence and keep release status inconclusive.
- [ ] Review the final saved-record migrations, confirm legacy sessions still open, and check no application export entry point bypasses the reviewed document snapshot. Verify no new dependencies, database changes, paid calls, or production routing changes.
- [ ] Prepare the user handoff with commits, meaningful tests, outstanding limitations, and a precise statement that this delivers candidate trust foundations, not an HR screening product. Do not merge or deploy solely because checks pass.

## Spec coverage and self-review

| Approved spec section | Owning tasks |
| --- | --- |
| Intent, scope, privacy, existing boundaries | Global Constraints; Tasks 1–10 |
| Assessment identity/lifecycle | Tasks 1–2 |
| Factual edits and source evidence | Tasks 4–5 |
| Candidate review and legacy state | Tasks 6–7 |
| Honest assessment presentation | Task 3 |
| Export behavior and text limitations | Tasks 7–9 |
| Acceptance checks | Focused tests in Tasks 1–9 and final Task 10 |
| Later evidence report and HR pilot | Explicitly excluded; no hidden employer or sharing subsystem |

Self-review: all approved Phase 1 sections have an owner. Five high-risk input classes have targeted tests. Shared names and records are defined before use. Example assertions that depend on existing endpoint/UI harnesses explicitly identify how their values are obtained. No paid or production operation is included in verification.

## Execution handoff

Review this plan before implementation. Choose one method:

- **Subagent-driven (recommended):** sequential implementer/reviewer tasks, then whole-branch review. Appropriate for the state, server-contract, and export boundaries where a missed integration could misrepresent a candidate.
- **Native:** the main agent implements the tasks sequentially, with an independent whole-branch review at the end. Lower coordination overhead, with fewer independent checkpoints.

The method is not yet selected. Preserve any subsequent user restriction on delegation or spending. Both methods start with an isolated checkout based on the approved spec/plan and relevant committed code; unrelated uncommitted model-evaluation work remains untouched.
