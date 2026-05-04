---
name: watheq-netlify-supabase
description: Use when editing Watheq Netlify Functions, Supabase access, credits, referrals, scheduled functions, rate limits, persistence, migrations, or environment variables.
---

# Watheq Netlify Supabase

Use this skill for backend work involving Netlify Functions, Supabase, credits, referrals, rate limits, scheduled jobs, persistence, email, or environment configuration.

## Process

1. Read `AGENTS.md`, `CLAUDE.md`, `context/CODING_STANDARDS.md`, and `references/backend-boundaries.md`.
2. Identify whether the change affects client auth, server-side service-role access, persistence, scheduled jobs, or external services.
3. Keep Supabase server-side access on `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; do not use the anon key for privileged function work.
4. Output database migrations as SQL for the user to run. Do not apply migrations directly.
5. Preserve the function style already used by the touched endpoint, including v1 handler shape or v2 streaming shape.
6. Update targeted tests for functions, validation, credits, persistence, and failure handling when behavior changes.

## Output

For diagnosis or plans, state:

- Boundary touched
- Environment variables involved
- Persistence or migration impact
- Timeout or rate-limit risk
- Verification
