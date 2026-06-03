# CLAUDE.md

**Watheq** (واثق) — Saudi-themed AI Resume Optimizer.
React 19 + Vite 8 + Tailwind CSS v4 + Zustand + Netlify Functions + Supabase + OpenRouter (Gemini 2.5).

Shared agent context: `AGENTS.md`, `context/DEVELOPER_PROFILE.md`, and `context/CODING_STANDARDS.md`.

## Commands

```bash
npm run dev                # Vite dev server (port 5173)
npm run dev:netlify        # Netlify dev with functions (port 8888)
npm run build              # Production build
npm run quality:parallel   # Lint + TypeScript + Tests in parallel (ALWAYS run after changes)
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
- Always use Context7 mcp when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

## Quality — NON-NEGOTIABLE

After EVERY code change, run `npm run quality:parallel`. Use `npm run quality:full` before launch, release, or handoff decisions that need build and i18n coverage. Fix all errors immediately — do not ask permission, do not mark task complete until zero errors. Auto-fix workflow: `npm run lint:fix` → `npm run quality:parallel`.

## Critical Gotchas

- **Supabase server-side**: Use `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (anon key → RLS 42501 errors)
- **Supabase PromiseLike**: Query builder returns PromiseLike (only `.then()`), NOT full Promise — wrap fire-and-forget with `Promise.resolve()` before `.catch()`
- **DB migrations**: Output SQL for user to run in Supabase dashboard. NEVER apply directly.
- **Netlify functions**: 30s timeout default, 1024MB memory for `generate-pdf` (Puppeteer). No localhost URLs.
- **Vite chunking**: `@react-pdf` MUST stay in one chunk (`vendor-pdf`) — circular deps break if split. Same for `@sentry` (`vendor-sentry`). `react-i18next` MUST be in `vendor-react` chunk.
- **OpenRouter**: All AI functions use `OPENROUTER_API_KEY` env var. Two tiers: `lite` (gemini-2.5-flash-lite) for parsing, `flash` (gemini-2.5-flash) for all analysis — with per-function `reasoningBudget` caps to control latency.
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
- **Templates**: `src/components/templates/` — registry pattern, 4 templates, PDF via `@react-pdf/renderer`
- **Netlify functions**: `netlify/functions/` — parse-resume, extract-resume-json, ai-match, optimize, predict-questions, generate-cover-letter, generate-pdf, batch-api, user-data-api, referral-api

## References (read on demand, not every session)

- Architecture & data flow: @docs/ARCHITECTURE.md
- Conventions & patterns: @docs/CONVENTIONS.md
- Skills: `.claude/skills/` and `.claude/commands/` — invoke with `/skill-name`
