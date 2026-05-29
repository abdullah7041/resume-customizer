# AI Usage Events

## Status
Table migration was applied through Supabase MCP on 2026-05-21. The shipped app records AI usage through the shared OpenRouter/Gemini client; failures are non-blocking.

Live re-check on 2026-05-29 via the Supabase connector confirmed the table and service-role-only grant posture are live, but no rows have been inserted yet. The same check found no `job_matches`, feedback, waitlist, auth-user, or credit-transaction activity since the telemetry migration, so the zero-row result does not prove an app-code instrumentation gap by itself.

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
It attempts a Supabase insert and falls back to structured console logging.
Logging failure never blocks the user request.

## Implementation State
- [x] Apply migration SQL through Supabase MCP.
- [x] Add approximate `estimated_cost_usd` population from the backend model registry.
- [x] Wire `featureName` option from AI callers for better segmentation.
- [x] Wire streaming endpoint (`optimize-stream`) usage logging through the shared OpenRouter client as `optimize_stream`.
- [x] Re-check manual client-role grant hardening tracked in `docs/SUPABASE_SCHEMA_DRIFT_20260522.md`.
- [ ] Before launch/payment reporting depends on this data, generate or observe at least one production AI request after deployment and confirm a corresponding `ai_usage_events` row.
