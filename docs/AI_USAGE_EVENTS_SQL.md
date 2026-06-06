# AI Usage Events

## Status
Table migration was applied through Supabase MCP on 2026-05-21. The shipped app records AI usage through the shared OpenRouter/Gemini client; failures are non-blocking.

Live re-checks on 2026-05-29 and 2026-06-02 via the Supabase connector confirmed the table and service-role-only grant posture are live, but no rows had been inserted yet. The 2026-06-02 check found `public.ai_usage_events` still had `count(*) = 0` and `pg_stat_user_tables.n_tup_ins = 0`; `public.job_applications` was also empty, auth logs for the prior 24 hours were empty, the newest `auth.users` row was from 2026-04-07, and adjacent persisted app activity topped out on 2026-05-09. The zero-row result did not prove an app-code instrumentation gap by itself because there was no evidence of qualifying production AI traffic after the telemetry migration.

2026-06-04 follow-up: Supabase logs showed same-day authenticated local activity (`/auth/v1/user`, `/auth/v1/token`, `user_credits`, and `credit_transactions`) but the available connector tools did not expose a direct SQL/count query in this session. Local authenticated AI reproduction was blocked because the shell environment had no `OPENROUTER_API_KEY`, `SUPABASE_URL`, or `SUPABASE_SERVICE_ROLE_KEY`, and Netlify/Supabase CLI env paths timed out. Code review found a plausible serverless race: `recordAiUsageEvent()` returned before the fire-and-forget Supabase insert settled, so a short-lived Netlify invocation could respond before telemetry persisted. The fix makes the shared AI client await the telemetry insert attempt while keeping failures non-fatal.

## Migration
See `supabase/migrations/20260521_add_ai_usage_events.sql`.

## Fields
| Field | Type | Notes |
|-------|------|-------|
| feature_name | text | E.g. `optimize`, `ai_match`, `parse_resume` |
| model | text | Full model ID, e.g. `google/gemini-2.5-flash` |
| provider | text | `openrouter` or `gemini` |
| prompt_tokens | integer | |
| completion_tokens | integer | |
| reasoning_tokens | integer | |
| total_tokens | integer | |
| estimated_cost_usd | numeric(12,6) | Nullable until pricing model is finalized |
| latency_ms | integer | |
| success | boolean | |
| error_code | text | Nullable |
| created_at | timestamptz | Defaults to `now()` |

## Backend Helper
`netlify/lib/ai-usage-logger.js` provides `recordAiUsageEvent()`.
It awaits the Supabase insert attempt and falls back to structured console logging.
Logging failure never fails the user request.

## Implementation State
- [x] Apply migration SQL through Supabase MCP.
- [x] Add approximate `estimated_cost_usd` population from the backend model registry.
- [x] Wire `featureName` option from AI callers for better segmentation.
- [x] Wire streaming endpoint (`optimize-stream`) usage logging through the shared OpenRouter client as `optimize_stream`.
- [x] Re-check manual client-role grant hardening tracked in `docs/SUPABASE_SCHEMA_DRIFT_20260522.md`.
- [x] Remove the fire-and-forget persistence race in the shared AI telemetry path.
- [ ] After deploying the telemetry durability fix, generate or observe at least one production AI request and confirm a corresponding `ai_usage_events` row before relying on payment/cost reporting.
