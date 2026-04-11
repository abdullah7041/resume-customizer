# CLAUDE.md

**Watheq** (واثق) — Saudi-themed AI Resume Optimizer.
React 19 + Vite 7 + Tailwind CSS v4 + Zustand + Netlify Functions + Supabase + OpenRouter (Gemini 2.5).

## Commands

```bash
npm run dev                # Vite dev server (port 5173)
npm run dev:netlify        # Netlify dev with functions (port 8888)
npm run build              # Production build
npm run quality:parallel   # Lint + TypeScript + Tests in parallel (ALWAYS run after changes)
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

## Quality — NON-NEGOTIABLE

After EVERY code change, run `npm run quality:parallel`. Fix all errors immediately — do not ask permission, do not mark task complete until zero errors. Auto-fix workflow: `npm run lint:fix` → `npm run quality:parallel`.

## Critical Gotchas

- **Supabase server-side**: Use `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (anon key → RLS 42501 errors)
- **Supabase PromiseLike**: Query builder returns PromiseLike (only `.then()`), NOT full Promise — wrap fire-and-forget with `Promise.resolve()` before `.catch()`
- **DB migrations**: Output SQL for user to run in Supabase dashboard. NEVER apply directly.
- **Netlify functions**: 30s timeout default, 1024MB memory for `generate-pdf` (Puppeteer). No localhost URLs.
- **Vite chunking**: `@react-pdf` MUST stay in one chunk (`vendor-pdf`) — circular deps break if split. Same for `@sentry` (`vendor-sentry`). `react-i18next` MUST be in `vendor-react` chunk.
- **OpenRouter**: All AI functions use `OPENROUTER_API_KEY` env var. Two tiers: `lite` (gemini-2.5-flash-lite) for parsing, `flash` (gemini-2.5-flash) for all analysis — with per-function `reasoningBudget` caps to control latency.

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