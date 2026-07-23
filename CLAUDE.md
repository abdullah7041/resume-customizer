# CLAUDE.md

**Watheq** (واثق) — Saudi-themed AI Resume Optimizer.
React 19 + Vite 8 + Tailwind CSS v4 + Zustand + Netlify Functions + Supabase + OpenRouter (Gemini 2.5).

Shared agent context: `AGENTS.md`. This file (`CLAUDE.md`) is the single source of truth for rules, commands, gotchas, and standards.

## Agent skills

### Issue tracker

Issues and PRDs are tracked with GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the standard Matt Pocock triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Use the single-context domain-documentation layout. See `docs/agents/domain.md`.

## Commands

```bash
npm run dev                # Vite dev server (port 5173)
npm run dev:netlify        # Netlify dev with functions (port 8888); OOMs esbuild on low-RAM (~8GB) machines — test functions via a `tsx` handler harness instead (see `netlify.toml` per-function `external_node_modules` note)
npm run build              # Production build
npm run quality:parallel   # Broad gate (lint+types+tests). Timeout-prone in-agent — see Quality. Prefer focused checks for small edits.
npm run quality:full       # Fast quality gate + production build + i18n validation
npm run lint:fix           # Auto-fix ESLint issues
npm run type:check         # TypeScript check
npm run test               # Vitest unit tests
```

## Code Rules

- IMPORTANT: Never use `any` — define interfaces in `src/types/`
- Use `@/` alias for all imports from `src/`
- Storage keys: `watheq:` prefix (e.g., `watheq:resumeData`)
- Logging: `[ComponentName]` prefix (e.g., `[ResumeStore]`, `[OpenRouter]`)
- Error objects: always include `status`, `code`, `message`
- Optimizations: only applied when `applied: true` flag is set
- Skills are never auto-injected — recommendations only, user adds manually
- AI-modified data tracked in `meta.ai_suggestions` to preserve schema integrity
- Preserve the proprietary licensing language already present in the repo — never strip or alter license headers.

## Quality

Match the check to the change. Do not run the broad gate by reflex.

- Docs / copy / instructions only → `git diff --check`. No test run.
- Single component / UI edit → relevant Vitest file(s) + `npm run lint:fix` on touched files.
- Shared runtime, Zod schemas, API contracts, stores, Netlify functions → focused tests + `npm run type:check`.
- Handoff / branch repair / cross-cutting change → broad gate (below).
- Launch / release needing build + i18n → `npm run quality:full`.

Running the broad gate IN-AGENT: do NOT call `quality:parallel` as one shot — its all-or-nothing parallel bundle overruns the wall-clock cap and discards every partial result. Run the legs as separate sequential commands so each returns within budget and partial progress survives:

```bash
npm run lint
npm run type:check
npm run test                 # add `-- --changed` to scope to files touched since git HEAD
```

Use `npm run quality:parallel` only on the dev machine / CI (no tool wall-clock cap).

Fix all errors immediately — do not ask permission, do not mark a task complete until zero errors. If a gate is genuinely inconclusive after ONE proper run, report it as inconclusive and list which focused checks passed. Never re-run a broad gate blindly — that is the token sink. Auto-fix: `npm run lint:fix` → focused verification → broad gate only when warranted.

## Critical Gotchas

- **Supabase server-side**: Use `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (anon key → RLS 42501 errors)
- **Supabase PromiseLike**: Query builder returns PromiseLike (only `.then()`), NOT full Promise — wrap fire-and-forget with `Promise.resolve()` before `.catch()`
- **DB migrations**: Output SQL for user to run in Supabase dashboard. NEVER apply directly.
- **Netlify functions**: 30s timeout default, 1024MB memory for `generate-pdf` (Puppeteer). No localhost URLs.
- **Vite chunking** (`vite.config.js` `manualChunks`): `@sentry` MUST stay in one chunk (`vendor-sentry`) — circular deps break if split. `react-i18next` + `i18next` MUST be in the `vendor-core` chunk with React/react-dom (react-i18next calls `React.createContext` at import time). PDF libs are split by tool: `jspdf` → `vendor-jspdf`, `pdfjs-dist` → `vendor-pdfjs`. (There is no `@react-pdf`/`vendor-pdf` — that lib is not used.)
- **OpenRouter**: All AI functions use `OPENROUTER_API_KEY` env var. Two tiers: `lite` (gemini-2.5-flash-lite) for parsing, `flash` (gemini-2.5-flash) for all analysis — with per-function `reasoningBudget` caps to control latency. NOTE: `flash` is NOT viable for `parse_resume` — it exceeds the 30s function limit and its default reasoning burns the output budget (truncation). Parsing stays on `lite`.
- **Resume parse latency/output budget**: `parse_resume` (`netlify/lib/ai-contracts/contracts/index.js`) uses `maxTokens: 8192`, `timeoutMs: 20000`, and `reasoningBudget: 0` (thinking DISABLED). A 4096 cap truncated legitimate rich-CV JSON, while 16384 let pathological whitespace output consume Netlify's 30s limit. CRITICAL: leave reasoning OFF — with gemini-2.5-flash-lite's default thinking ON, reasoning tokens consumed the 8192 output budget (truncation on rich CVs) and pushed latency to ~26s; OFF, the real JSON (~2-3k tokens) fits with headroom at ~6s. Do NOT raise maxTokens to "fix" a truncation — that re-opens the 30s timeout path; disable reasoning instead. The `reasoningBudget` knob: `0`=disable (`reasoning:{enabled:false}` OpenRouter / `thinkingBudget:0` Gemini), `>0`=cap, `null`=model default. Token usage is logged BEFORE the truncation throw in `openrouter-client.js` so a truncation shows its reasoning-vs-completion split. There is NO second AI attempt on truncation: re-parsing the full resume on direct Gemini stacked two multi-second generations and overran the 30s limit (→ hard 500). OpenRouter truncation now throws fast (`openrouter-client.js` only falls back to Gemini on genuine 5xx/auth/network/timeout outages, never on truncation). There is also NO focused AI re-parse: dropped sections (incl. dropped work entries) are recovered deterministically from raw text by `parse-quality.js` (`recoverSectionsFromRawText`/`buildDeterministicBaseline`). Once readable text exists, an AI parser/provider failure NEVER 500s — `extract-resume-json.ts` builds the deterministic skeleton and returns 200 with `meta.parseQuality.aiParseFailed/aiFailureCode/confidence:"low"` and `extractionSource` ending `+deterministic`. **`parse_resume` requests `responseFormat: 'json_object'`, NOT `json_schema` (2026-07-06):** OpenRouter's grammar-constrained structured output for gemini-2.5-flash-lite regressed to runaway generation (`finish_reason:"length"` truncation at ANY maxTokens — 8192, 30000 all loop) on some layouts (right-aligned dates, decorative/Canva, two-column). A direct-fetch matrix proved strict, non-strict, AND fully-closed (`additionalProperties:false` everywhere) json_schema all loop, while `json_object` returns clean complete JSON. The client honors `options.responseFormat==='json_object'` (threaded via `executor.js` `buildCallOptions` + `scripts/parse-eval.mjs`). Do NOT switch `parse_resume` back to `json_schema` unless the provider bug is confirmed fixed via `npm run eval:parse` (must stay 8/8 @ 100%). Shape is enforced by the prompt's "you MUST extract" rules + the Zod `outputSchema`, not the API schema.
- **Scanned/image-only PDFs**: when text extraction yields no selectable text, signed-in PDF uploads fall back to OCR via `netlify/lib/ocr-extract.js` (Gemini native, OpenRouter `file-parser` engine), recorded as `meta.parseQuality.ocrFallback/pagesProcessed`. Guests keep the `resume/unreadable-file` rejection.
- **Resume parse section contract**: `resumeJsonSchema` requires every top-level section container AND the always-present core item fields — `basics` (`name`, `label`, `location`, `summary`; `location` requires `city`+`countryCode`) and each `work` entry (`name`, `position`, `startDate`, `endDate`, `highlights`). These item fields are REQUIRED on purpose: gemini-2.5-flash-lite (reasoning off) otherwise silently drops `label`/`location`/`summary`/`endDate` and dumps bullets into a single `summary` string instead of `highlights[]` (gold-set regression CV measured 47% → 97% after requiring them; the `work` item `summary` escape-hatch field was removed so bullets must land in `highlights[]`). Keep the OTHER item fields optional (`education`/`skills`/`projects`/`certificates`/`languages` — an empty array means absent evidence; never fabricate), and never remove the top-level `required` list. NOTE: since `parse_resume` moved to `json_object` (see the runaway gotcha above), this schema is no longer sent to the API as an enforced grammar — field completeness is now carried by the prompt's per-field "you MUST extract" rules + the Zod `outputSchema`. Keep the schema + prompt rules in sync; the eval (`npm run eval:parse`, 8/8 @ 100%) is the guard that `lite` still emits every evidenced field/section.
- **AI Scoring Prompts**: Anti-inflation rules enforced in BOTH `processMatchOnly` and `optimizeResume`. 80+ = hireable today, 60-79 = competitive with gaps, <60 = significant gaps. NEVER score >90 without full evidence. Do NOT re-add "score 85+ for excellent match" anchors.
- **Bullet Improvements**: STAR + Metric enforcement is MANDATORY. Every `improved` bullet must have [Action Verb] + [Task] + [Quantified Result]. Inferred metrics appended with `(verify)`. Missing JD keywords must be woven INTO rewritten bullets (not just listed separately).
- **Client-Side PDF Parsing**: PDF/DOCX text extraction happens in the **browser** via `pdfjs-dist` (dynamically imported in `src/lib/utils/resumeText.ts`). The `parseResume` API function in `src/services/api.js` extracts text client-side and sends `kind: "text"` to the server. Falls back to `kind: "file"` (base64) only if client extraction yields <100 chars (scanned PDFs). This saves 5-8s of serverless execution time.
- **Vulnerability → Optimization**: The optimize endpoint accepts optional `workHistory` (structured work entries) and runs `detectVulnerabilities()` to find career red flags (gaps, short tenures, pivots, demotions, job hopping). These are injected into the AI prompt so bullet rewrites proactively neutralize interview concerns. The `WorkHistoryEntrySchema` MUST be declared BEFORE `OptimizeRequestSchema` in `resume-schemas.ts` (TDZ).
- **Cover Letter Tone**: The `generateCoverLetter` function accepts a `tone` parameter (`professional|enthusiastic|formal|creative`). The frontend tone selector UI already exists in `CoverLetterSection.tsx`. The tone flows: Frontend → `generate-cover-letter.ts` → `gemini-client.js` prompt injection.
- **SSE Streaming (optimize-stream)**: `optimize-stream.ts` uses **Netlify Functions v2** syntax (`export default async function(request: Request): Promise<Response>`) and returns a `ReadableStream` with SSE events. It streams progress phases: `validating → detecting_vulnerabilities → ai_processing → building_response → result → done`. The frontend (`optimizeResumeStream` in `api.js`) consumes these via `ReadableStream.getReader()` and falls back to the legacy `optimize.ts` (v1 syntax) on failure. Both endpoints share the same card-building logic. The v2 function uses `export const config = { path: '/api/optimize-stream' }` for custom routing.

## Debugging

IMPORTANT: Diagnose root cause BEFORE writing fix code. Trace full data flow: frontend → API → backend → database → response → frontend display. State your diagnosis first. For score bugs, trace from AI generation to display — scores must be genuine calculations, never placeholders.

## Key File Locations

- **State store**: `src/lib/stores/resumeStore.ts` (Zustand, localStorage persistence, fuzzy merge logic)
- **Types**: `src/types/templates.ts`, `src/types/analysis.ts`, `src/types/resume.d.ts`
- **Validation**: `src/lib/validation/store-schemas.ts` (Zod), `netlify/lib/resume-schemas.ts`
- **AI client**: `netlify/lib/openrouter-client.js` — `callOpenRouter('lite'|'flash', messages, schema?, options?)`
- **Templates**: `src/components/templates/` — registry pattern, 4 templates (DOM/React, not PDF primitives)
- **PDF generation**: primary = server `netlify/functions/generate-pdf.ts` (Puppeteer `page.pdf()` → real selectable text PDF); fallback = `handleDownloadPdf` catch-block in `TemplatesSection.tsx` (html-to-image → jsPDF raster). Bulk compare export = jspdf + jspdf-autotable (text) in `BulkAnalysisSection.tsx`. `pdfjs-dist` is for **parsing uploads** (text extraction), not generation.
- **Netlify functions**: `netlify/functions/` — 25 TypeScript functions, grouped as parsing (`parse-resume`, `extract-resume-json`, `onboard-extract`); match/optimize (`ai-match`, `optimize`, `optimize-stream`, `refine-bullet`, `resume-truth-check`, `vision2030-alignment`); job import (`import-job-url`, `extract-job-metadata`); generation (`generate-cover-letter`, `generate-pdf`, `predict-questions`, `generate-clarifications`); accounts/growth (`user-data-api`, `referral-api`, `feedback-api`, `batch-api`, `notify-waitlist`, `waitlist-confirm`); scheduled (`cron-monthly-summary`, `cron-reset-credits`); and dev utilities (`dev-celebration-bonus`, `dev-reset-credits`).

## References (read on demand, not every session)

- Skills: `.claude/skills/` and `.claude/commands/` — invoke with `/skill-name`
