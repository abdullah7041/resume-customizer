# Conventions & Patterns

> This file is loaded on demand via `@docs/CONVENTIONS.md` — not every session.

## TypeScript Standards

- Never use `any` — define interfaces in `src/types/`
- All function parameters must have explicit types
- All API responses must have typed interfaces
- All component props typed with interfaces
- React hooks must have properly typed return values
- `tsconfig.json` has `"strict": false` for legacy compat — new code should follow strict typing

## Naming & Logging

Logging prefixes for all store/function operations:
- `[ResumeStore]` — Zustand store
- `[OpenRouter]` — AI API calls
- `[extract-resume-json]` — Resume parsing
- `[optimize]` — Optimization function

## Error Handling

Error objects always include: `status`, `code`, `message`.

## Conventions

- Optimizations only applied if `applied: true` flag is set
- Skills never auto-injected (recommendations only — user must add manually)
- AI-modified data tracked in `meta.ai_suggestions` to preserve schema integrity
- Cache keys: generated from first 100 chars + length of both resume and job description (FNV-1a hash)
- File paths: `@/` alias for `src/` imports
- Storage keys: `watheq:` prefix (e.g., `watheq:resumeData`, `watheq:lastJobDescription`)
- Env vars: `OPENROUTER_API_KEY` required for all AI functions. Client-side vars prefixed `VITE_`.

## Type Locations

- `src/types/templates.ts` — Resume state, optimization results, template configs
- `src/types/analysis.ts` — Match analysis response, gap analysis, keyword strategy
- `src/types/resume.d.ts` — JSON Resume schema (extends jsonresume.org standard)
- `src/lib/validation/store-schemas.ts` — Zod schemas mirroring resume structure

## Netlify Function Patterns

- All endpoints validate with Zod schemas from `netlify/lib/resume-schemas.ts`
- Use `SUPABASE_SERVICE_ROLE_KEY` for server-side (never anon key)
- Rate limiting via Upstash Redis — falls back to allowing if unavailable
- Functions validate `OPENROUTER_API_KEY` before processing

## Quality Checklist

Before completing any task:
- `npm run quality:parallel` passes (0 lint warnings, 0 TS errors, 0 test failures)
- New interfaces in `src/types/`
- No `any` types
- All imports used
- React `.map()` calls have unique keys