# Goal 2: Trust pair — ATS Explainability Panel + Before/After Score Diff

**Model**: Fable 5, plan mode. Execute with Opus after plan approval.

Plan only. Do not write implementation code until the plan is approved.

Feature: ATS Explainability Panel + Before/After Score Diff for Watheq (React 19 + Vite, Zustand store `src/lib/stores/resumeStore.ts`, Netlify functions, OpenRouter Gemini 2.5). Existing related components: `ScoreBreakdown.tsx`, `GapAnalysisCard.tsx`, `HiddenMatchesCard.tsx`, `MirroredKeywordsCard.tsx` — audit these FIRST; part of this feature may already half-exist and the plan must extend, not duplicate.

Explainability Panel: explain why the score is what it is using matched keywords, missing requirements, weak evidence, and caution notes, all mapped to real resume/JD text from EXISTING match/optimize outputs.

Score Diff: original match score vs projected optimized score, showing which accepted optimization cards (`applied: true` only) contribute to the movement.

Hard constraints:

- No parallel scoring system, no new AI scoring call. Derive everything from existing response data.
- Never fabricate evidence. Every displayed claim maps to actual resume or JD text.
- Anti-inflation rules in processMatchOnly and optimizeResume are untouchable.
- Optimizations count only when `applied: true`. Missing skills stay recommendations, never auto-injected.
- Bilingual ar/en + RTL. Projected gains presented as estimates, never guarantees.
- No resume/JD text in analytics or logs (metadata only).
- State goes through resumeStore.ts patterns; storage keys `watheq:` prefix; no `any` types.

Deliverable: implementation plan with exact files to touch, data flow from existing score outputs to UI, component list, Zustand state changes, i18n keys (both locales), test list, and a risk register. Flag anything that forces a schema or API contract change — that escalates scope and I want to know before approving.

Done when: panel explains score from real matched/missing evidence, diff shows original vs projected score tied to applied cards, works in ar + RTL, projected gains labeled as estimates, no new AI scoring call, relevant Vitest files + lint:fix pass (add `npm run type:check` if stores/schemas change).
