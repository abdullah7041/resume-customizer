# Watheq candidate trust foundations

Date: 2026-09-24
Status: Written specification awaiting user review; implementation is not authorized by this document.

## 1. Agreed intent

Keep Watheq candidate-first. Make assessments and rewritten applications reliable enough that candidates can later share an evidence report with HR. Start by repairing the existing flow; a recruiter workspace is not part of this release.

The user selected “Candidate-first, then HR pilot” and approved the Phase 1 conversational design. Success means the correct resume and job are assessed, AI changes remain traceable, uncertainty remains visible, and exports preserve the intended content. A score is not a hiring recommendation or probability.

This specification defines Phase 1 only. Phase 2 introduces a candidate-controlled downloadable evidence report. Phase 3 evaluates it with consenting candidates and recruiters. Both require separate designs. No phase establishes independent verification of employment, qualifications, or candidate statements.

## 2. Scope and constraints

Included:

- Assessment context integrity in live requests, restored results, bulk comparison, and comparison exports.
- Truthful optimization and single-bullet refinement, including candidate clarifications.
- Evidence preservation through suggestions, applied edits, and saved variants.
- Review of unresolved AI additions before final document export.
- Honest score labels and removal of duplicated measurements.
- Explicit handling of PDF quality and existing DOCX fallback.
- English and Arabic behavior and focused regression coverage.

Excluded:

- Employer accounts, candidate-pool uploads, automated hiring decisions, hosted sharing links, and external credential checks.
- New dependencies, providers, paid model campaigns, production routing changes, or deployment.
- Database migrations or a new cloud persistence system. Extend existing local records for this phase; do not send unsupported new fields to existing cloud contracts.
- General refactoring or unrelated work already present in the checkout.
- Hiring-outcome promises, universal ATS compatibility claims, or an AI-generated “verified candidate” badge.

The current checkout has unrelated model-evaluation edits. Implementation must preserve them and reconcile any overlapping executor changes rather than overwriting them.

## 3. Existing boundaries and evidence

The review inspected these existing paths; implementation planning must refresh exact symbols and line numbers against its checkout:

| Boundary | Relevant files | Design implication |
| --- | --- | --- |
| AI contracts and execution | `netlify/lib/ai-contracts/contracts/index.js`, `netlify/lib/ai-contracts/executor.js` | Prompts and shape validation alone do not establish factual support. |
| Optimization presentation | `netlify/lib/optimize-cards.ts`, `src/components/shared/OptimizationCard.tsx`, `src/components/sections/OptimizeSection.tsx` | Source references must survive conversion into cards and applied results. |
| Candidate state | `src/lib/stores/resumeStore.ts`, `src/types/templates.ts` | Extend existing state and variant conventions without replacing saved work. |
| Matching and comparison | `netlify/functions/ai-match.ts`, `src/components/sections/BulkAnalysisSection.tsx` | Bind results to inputs; stop presenting one score as several independent measurements. |
| Export | `src/components/sections/TemplatesSection.tsx`, `netlify/functions/generate-pdf.ts` | Text PDFs and raster PDFs have different guarantees. |
| Truth Check | `src/types/truth-check.ts`, `src/lib/utils/truthCheckSummary.ts` | Reuse evidence vocabulary where appropriate; a text-based check cannot prove real-world truth. |

The existing job-variant ADR remains applicable. This phase does not advance its deferred cloud persistence or sharing scope.

## 4. Assessment identity and lifecycle

Each new assessment records an immutable context envelope:

- Resume identity where available, plus a fingerprint of the exact submitted resume content.
- Fingerprint and snapshot of the exact submitted job description.
- Language, assessment kind, contract/rubric version, and creation time.
- A request identifier used to reject late responses.
- Actual model metadata when available from the existing response; absence must not be filled with a guessed model.

Fingerprint inputs must distinguish meaningful content changes. Reuse an existing suitable implementation if available. A fingerprint binds content; it does not anonymize it or prove authenticity. Snapshots remain private in existing storage and must not enter analytics or ordinary logs.

The active display can be current, outdated, pending, failed, or legacy. The stored result remains immutable; its display status is evaluated against the current inputs.

Changing the resume, job, language, or assessment version immediately makes incompatible results outdated. A completed response is adopted only if its request and context still match the active request. Cancellation is an efficiency measure; response identity checks are mandatory even if cancellation fails.

Bulk comparisons group only compatible results for the same job snapshot, language, and rubric version. Each row retains its own resume fingerprint. Incompatible rows remain accessible but cannot participate in a current ranking. Historical report export is permitted only with its original job snapshot and an explicit historical label. Never print the current job description beside scores for a different one.

## 5. Factual editing and evidence

A suggestion carries its original text, proposed text, stable target reference, and evidence references. Each reference identifies the source kind, exact source text or structured field, source fingerprint, and candidate confirmation state where relevant.

Source kinds are:

1. Supplied resume content: present in the candidate's uploaded or edited resume.
2. Candidate clarification: explicitly provided by the candidate, with its own identity and timestamp.

Neither kind is independently verified. The UI uses “From your resume” and “Confirmed by you.” Rewording must not upgrade these labels.

Generation and refinement rules:

- Preserve supplied metrics, dates, tools, employers, scope, and responsibilities without inflation.
- Never invent a number and append “verify.” Use a qualitative result or request the actual number.
- A relevant job keyword can be introduced only when the candidate's evidence supports the underlying skill or experience.
- A candidate clarification can support a new fact even when it was absent from the original resume. Link to that clarification explicitly.
- Support is local to the claim: a tool or number elsewhere in the resume must not automatically justify attaching it to a different employer or project.
- Existing candidate-declared hard stops continue to override keyword recommendations.

Live validation checks source identity and the existence of cited evidence, as well as unsupported introduced numbers and obvious factual changes. Schema success or a matching quotation is not sufficient proof that the rewritten sentence follows from the evidence. Where support cannot be established, mark the edit as needing review; do not claim that deterministic checks fully verify semantics.

Fresh results require evidence metadata. Legacy results may deserialize without it but remain explicitly unreviewed. Apply the same policy to both optimization endpoints and refinement. Preserve valid suggestions when another suggestion is rejected, provided the response clearly identifies the rejected or review-required item. Do not add automatic paid retries or change credit policy as part of this work.

## 6. Candidate review and document state

Candidates see before/after wording and its evidence. For an unresolved AI addition they can:

- Supply or explicitly confirm the specific fact, recorded as a candidate statement.
- Edit the wording, followed by validation of the new text.
- Remove the addition or revert to their original wording.

“Apply” and “Confirm fact” are separate actions. Applying a suggestion does not silently attest to its truth. Confirmation is invalidated when the confirmed claim changes; unrelated edits do not require reconfirmation of unchanged claims.

The final export preflight checks the exact composed document, including the active variant. Unresolved AI additions actually included in that document require resolution. Unapplied suggestions do not block export. Candidates are not required to prove every original statement in their resume. User-authored text remains user-provided evidence, not independently verified content.

All first-party final resume export routes use the same preflight, including PDF and DOCX. Downloading the untouched original resume remains possible. This is an application workflow safeguard, not a claim that the system can prevent someone copying or independently editing text elsewhere.

Persist evidence and review state using the existing local resume/variant mechanism. On restore, check content fingerprints rather than trusting a stale “reviewed” flag. Legacy generated additions require review or reversion before final export; do not delete them or automatically rerun paid analysis. If an older session lacks an original baseline, let the candidate review the current document without guessing which claims were AI-authored.

## 7. Assessment presentation

- Present the existing score as an estimated alignment with the supplied job requirements, not “hireable today,” a hiring probability, or an ATS pass probability.
- Remove coverage and similarity from visible results where they are merely copies of the overall score. If compatibility temporarily requires retaining API fields, mark them deprecated and ensure no current UI or export treats them as independent measurements.
- Use “Highest score in this comparison” for relative ordering. Show gaps and assessment limitations even on the highest-ranked item.
- Preserve genuine evidence and uncertainty already returned by matching through cache reuse and comparison views.
- Do not introduce a replacement coverage percentage in Phase 1. A requirement-level evidence report belongs to Phase 2.
- Keep the deliberately separate overall score and weighted category scores; changing that scoring model is outside this repair.
- Update affected English/Arabic product copy and repository guidance so future prompts do not reintroduce mandatory invented metrics or hiring guarantees.

## 8. Export behavior

Use the existing server-rendered text PDF as the primary route. Keep existing bounded timeouts and recoverable busy states.

If it fails, offer retry and the existing DOCX route. Image-only PDF requires an explicit candidate choice and a clear explanation that text selection is unavailable and receiving systems may need OCR. Do not silently substitute it for the primary document.

Use existing PDF extraction tooling for a bounded check of the generated text PDF against its expected visible document content. Check core fields that are actually present: name/contact details, employers, dates, and representative bullet content. Omitted-by-design sections must not be treated as missing. If a check fails or cannot complete, show an unverified export state and recovery choices rather than claiming ATS readability. Layout and reading-order correctness additionally require regression fixtures; a successful extraction alone is not universal ATS certification.

Record text-PDF, DOCX, and image-only export outcomes distinctly using existing analytics mechanisms, without resume content. Export checks must not start new model calls. Evidence metadata remains private and is not appended to the application resume; a separate shareable report is Phase 2.

## 9. Acceptance checks

| Scenario | Required outcome |
| --- | --- |
| Change job after completing bulk analysis | Existing rows become outdated; new-job report cannot include old-job scores. |
| Change job while a request runs | Late response cannot overwrite the active context. |
| Restore old or partially migrated records | Records remain accessible and visibly legacy/outdated; no fabricated context or silent paid rerun. |
| Switch between saved resume variants | Evidence and review states stay with their own content and job context. |
| Optimize a bullet without metrics | No invented figure or “verify” placeholder is produced as an accepted edit. |
| Refine a bullet or introduce a new tool | Same evidence and factual-change rules as full optimization apply. |
| Source reference is absent or points to another resume | Edit is rejected or requires review; it cannot receive a grounded label. |
| Candidate supplies a real clarification | Edit links to that statement and is labelled candidate-confirmed. |
| Candidate changes a confirmed claim | Previous confirmation no longer approves the changed claim. |
| Unapplied suggestion needs review | It does not block export of a document that does not contain it. |
| All compared resumes score poorly | Highest-ranked row remains visibly weak; ranking does not imply suitability. |
| PDF renderer fails | No silent image-only success; candidate gets retry/DOCX/explicit image-only choices. |
| Arabic, English, mixed-language, and multi-page fixtures | Critical facts survive export; reading order and text extraction are inspected. |

Verification uses focused Vitest tests for context lifecycle, card conversion, restore/migration, editing review, and export recovery; type checking for shared contracts; lint on changed files; and locale validation for changed copy. Before release, execute the repository's required broad checks sequentially and capture their results. Do not invoke the timeout-prone parallel gate as one in-agent operation. No live model evaluation runs without its separate spending authorization.

## 10. Delivery boundaries and later work

Implementation planning should order the work as follows:

1. Assessment identity and stale-result protection, with honest measurement labels.
2. Shared evidence representation and live editing validation.
3. Evidence persistence and candidate resolution before export.
4. Export quality distinctions and bilingual end-to-end regression coverage.

Each increment must remain compatible with existing saved work. Do not advertise evidence-backed final exports until the complete generation-to-export path is covered. Release readiness requires captured checks; this design review is not deployment authorization.

Phase 2 will specify the downloadable requirement/evidence report, including candidate-controlled inclusion of clarifications. Phase 3 will set pilot measures and acceptance thresholds before collecting results: unsupported claims, missed qualifications, reviewer disagreement, correction rates, and review time. Interview progression may be tracked separately but cannot alone establish causality or assessment accuracy.

## 11. Design review record

- Agreed direction: candidate-first, then an HR pilot.
- Conversational Phase 1 design: approved by the user.
- Self-review: scope, legacy behavior, provenance limits, confirmation semantics, export fallbacks, and testability checked; no implementation placeholders remain.
- Next gate: user review of this written specification, followed by a separate implementation plan and execution-method selection.
