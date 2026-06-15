# Resume Truth Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free, authenticated, read-only Resume Truth Check workflow step that flags risky resume claims without changing user content.

**Architecture:** Add a dedicated Netlify function backed by a structured OpenRouter AI contract, expose it through the frontend API service, and render results in a new primary workflow section. Results are cached locally by resume fingerprint and are never written to Supabase or applied to the resume.

**Tech Stack:** React 19, Vite 8, Tailwind CSS v4, Zustand/localStorage, Vitest, Netlify Functions, Zod, OpenRouter.

---

### Task 1: Spec And Red Tests

**Files:**
- Create: `docs/superpowers/specs/2026-06-14-resume-truth-check-design.md`
- Create: `docs/superpowers/plans/2026-06-14-resume-truth-check.md`
- Modify: `netlify/lib/__tests__/ai-contracts.test.js`
- Modify: `netlify/functions/__tests__/ai-integration.test.ts`
- Modify: `src/__tests__/MainContent.test.jsx`

- [ ] Add tests proving the new contract, function, and workflow are missing.
- [ ] Run focused tests and confirm failures are for missing `resume_truth_check` support.

### Task 2: Backend AI Contract And Function

**Files:**
- Modify: `netlify/lib/resume-schemas.ts`
- Modify: `netlify/lib/ai-contracts/contracts/index.js`
- Modify: `netlify/lib/model-registry.js`
- Modify: `netlify/lib/rate-limiter.ts`
- Modify: `netlify/lib/gemini-client.js`
- Create: `netlify/functions/resume-truth-check.ts`

- [ ] Add `TruthCheckRequestSchema`.
- [ ] Add the `resume_truth_check` contract with conservative prompt and strict output validation.
- [ ] Add a backend helper that executes the contract.
- [ ] Add an authenticated, rate-limited Netlify function with no credit manager calls.
- [ ] Run backend focused tests until green.

### Task 3: Frontend API, Types, UI, Cache

**Files:**
- Create: `src/types/truth-check.ts`
- Modify: `src/services/api.js`
- Create: `src/components/sections/TruthCheckSection.tsx`
- Modify: `src/components/Layout/MainContent.tsx`

- [ ] Add frontend result types and API call.
- [ ] Add Truth Check as a primary workflow step after Resume.
- [ ] Add local cache under `watheq:resumeTruthCheck` keyed by resume fingerprint.
- [ ] Gate guests before backend calls.
- [ ] Render read-only claim cards with filters and evidence snippets.
- [ ] Run frontend focused tests until green.

### Task 4: Localization And Verification

**Files:**
- Modify: `src/locales/en/tabs.json`
- Modify: `src/locales/ar/tabs.json`
- Modify: `src/locales/en/workspace.json`
- Modify: `src/locales/ar/workspace.json`
- Create: `src/locales/en/sections/truthCheck.json`
- Create: `src/locales/ar/sections/truthCheck.json`

- [ ] Add English and Arabic copy with no credit wording.
- [ ] Run focused tests.
- [ ] Run `npm run quality:parallel`.
- [ ] Run `npm run i18n:validate` if not covered by the quality gate.
