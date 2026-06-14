# Resume Truth Check Design

## Goal

Add a free, authenticated Resume Truth Check step that helps users identify unsupported, inflated, vague, unverifiable, or internally inconsistent resume claims using only evidence already present in the uploaded resume.

## Product Decisions

- Placement: primary workflow step after Resume and before Match.
- Scope: resume-only; do not send or require a job description.
- Persistence: local-only cache keyed to the current resume fingerprint.
- Billing: free for v1; rate-limited and authenticated, but no credits are checked or consumed.
- Truth invariant: the feature never rewrites resume content, never invents facts, and never auto-applies AI suggestions.

## Data Flow

Frontend Truth Check tab reads the current parsed resume text from the uploaded resume state and calls `analyzeResumeTruthCheck`.

`TruthCheckSection` -> `MainContent` handler -> `src/services/api.js` -> `/.netlify/functions/resume-truth-check` -> `TruthCheckRequestSchema` -> `resume_truth_check` AI contract -> OpenRouter -> validated response -> frontend rendering -> `watheq:resumeTruthCheck` local cache.

No Supabase persistence or migrations are part of v1.

## Response Shape

The backend returns:

- `overallRisk`: `low`, `medium`, or `high`
- `summary`: short user-facing summary
- `claims`: claim findings
- `limits.cannotVerify`: things Watheq cannot verify from resume text alone

Each claim includes:

- `claimText`
- `section`
- `severity`: `low`, `medium`, or `high`
- `riskTypes`: `unsupported`, `inflated`, `vague`, `unverifiable`, or `inconsistent`
- `evidenceStatus`: `supported`, `needs_evidence`, `unclear`, or `contradicted`
- `visibleEvidence`
- `whyItMatters`
- `userAction`

## AI Safety Rules

- Use only visible resume text.
- Do not invent facts, employers, dates, metrics, skills, credentials, nationality, or outcomes.
- Do not write replacement resume claims.
- Do not say a claim is false unless visible resume evidence contradicts it.
- Put uncertainty into unverifiable, unsupported, or unclear findings.
- Keep evidence snippets short and copied from visible resume text.

## Acceptance Criteria

- Truth Check appears as a primary workflow step after Resume and before Match.
- Guest users are gated before any backend Truth Check call.
- Signed-in users can run Truth Check without a credit confirmation modal.
- No credit manager call is made by the backend endpoint.
- Results render as read-only claim cards with evidence snippets.
- No Apply, Rewrite, or Fix automatically action exists.
- Cached results are reused for the same resume and cleared when a new resume is uploaded.
- Focused tests and `npm run quality:parallel` pass.
