# AI Usage Events — SQL Proposal

## Status
Applied through Supabase MCP on 2026-05-21.

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

## TODO
- [x] Apply migration SQL through Supabase MCP.
- [ ] Add `estimated_cost_usd` population once pricing model is finalized.
- [x] Wire `featureName` option from AI callers for better segmentation.
- [ ] Consider streaming endpoint (`optimize-stream`) usage logging when token counts are available.
