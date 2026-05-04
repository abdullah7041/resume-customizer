# Backend Boundaries

This reference is a compact map for Netlify and Supabase work. Read current source files before editing.

## Netlify Functions

- Function entrypoints live in `netlify/functions/`.
- Shared backend utilities live in `netlify/lib/`.
- Function settings live in `netlify.toml`, including timeouts, memory, and selected external modules.
- `optimize-stream.ts` uses Netlify Functions v2 response streaming with a custom path and SSE events.
- `generate-pdf` uses Puppeteer/Chromium and has special memory and timeout requirements.

## Supabase And Persistence

- Browser-facing Supabase usage should use public `VITE_` environment variables.
- Server-side Supabase usage should use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Supabase query builders may be PromiseLike rather than full Promise objects; wrap fire-and-forget calls with `Promise.resolve()` before `.catch()`.
- Database migrations belong in SQL output or migration files for user review, not direct agent execution against Supabase.

## Operational Concerns

- Respect existing credit, referral, waitlist, rate-limit, and scheduled-function boundaries.
- Keep error objects structured with `status`, `code`, and `message`.
- Check timeout budgets before adding slow AI, PDF, email, or database work.
- Avoid localhost URLs in serverless PDF or deployed function flows.
