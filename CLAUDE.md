# CLAUDE.md

**Watheq** (واثق) — Saudi-themed AI Resume Optimizer.
React 19 · Vite 8 · Tailwind v4 · Zustand · Netlify Functions · Supabase · OpenRouter (Gemini 2.5).

This file is the always-loaded core. Keep it lean — it costs tokens on every session.
Stack, commands, and standards live in ONE place (here + `context/CODING_STANDARDS.md`); do not duplicate them elsewhere.

## Commands

```bash
npm run dev                # Vite dev server (5173)
npm run dev:netlify        # Netlify dev + functions (8888)
npm run build              # Production build
npm run quality:parallel   # Fast gate when feasible; prefer focused checks for tiny edits
npm run quality:full       # quality + build + i18n — before launch/release/handoff
npm run lint:fix           # Auto-fix ESLint
```

## Hard rules (apply to every change)

- After code changes, run the smallest reliable focused verification first. Use `npm run quality:parallel` when the change touches runtime code, shared contracts, tests, or before handoff when feasible.
- Never use `any` — define interfaces in `src/types/`.
- Imports from `src/` use the `@/` alias. Storage keys use the `watheq:` prefix. Logs use a `[ComponentName]` prefix.
- Error objects always include `status`, `code`, `message`.
- DB migrations: output SQL for the user to run in Supabase. NEVER apply directly.
- Optimizations apply only when `applied: true`. AI-modified data goes in `meta.ai_suggestions`. Skills are recommendations only — never auto-injected.
- Diagnose root cause and trace the full data flow (frontend → API → backend → DB → response → display) BEFORE writing fix code.
- Use Context7 MCP for any library/API/SDK/config docs without being asked.

## Read-before-you-touch map (on demand — these are NOT loaded by default)

Read `context/ENGINEERING_NOTES.md` BEFORE working on any of these. Each rule there encodes a past incident:

- **Resume parsing / `parse_resume` / truncation / latency / OCR** → §Critical Gotchas (OpenRouter tiers, `reasoningBudget`, 30s timeout, deterministic recovery).
- **AI scoring or bullet rewrites** → §Critical Gotchas (anti-inflation bands, STAR+Metric enforcement).
- **Supabase, Netlify functions, Vite chunking, cover letters, SSE optimize-stream** → §Critical Gotchas.
- **Any bug fix** → §Debugging.
- **Finding the right file** → §Key File Locations.
- **Deep architecture / conventions** → `@docs/ARCHITECTURE.md`, `@docs/CONVENTIONS.md` (note: literal folder is named `@docs`).

## Pointers

- Coding standards & repo rules: `context/CODING_STANDARDS.md`
- Collaboration style & product priorities: `context/DEVELOPER_PROFILE.md`
- Codex / tooling (rtk, caveman, MCP): `AGENTS.md`
