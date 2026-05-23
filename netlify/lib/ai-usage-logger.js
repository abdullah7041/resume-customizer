import { getSupabaseClient } from './supabase-client.js';
import { summarizeErrorForLog } from './sentry.js';

/**
 * Record an AI usage event for future cost tracking.
 * Non-blocking: failures are logged but never thrown.
 *
 * @param {object} event
 * @param {string} event.feature_name
 * @param {string} event.model
 * @param {string} event.provider
 * @param {number} event.prompt_tokens
 * @param {number} event.completion_tokens
 * @param {number} event.reasoning_tokens
 * @param {number} event.total_tokens
 * @param {number|null} event.estimated_cost_usd
 * @param {number} event.latency_ms
 * @param {boolean} event.success
 * @param {string|null} event.error_code
 */
export async function recordAiUsageEvent(event) {
  try {
    if (process.env.BENCHMARK_DISABLE_USAGE_LOGGING === 'true') {
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      console.warn('[AI Usage] Supabase unavailable, structured log:', JSON.stringify(event));
      return;
    }
    // Fire-and-forget: never block the user request.
    // Supabase query builder returns PromiseLike, so wrap with Promise.resolve
    // before .catch() per project conventions.
    Promise.resolve(client.from('ai_usage_events').insert(event))
      .then(({ error }) => {
        if (error) {
          console.warn('[AI Usage] Failed to persist event, non-fatal:', {
            message: error.message,
            code: error.code,
            status: error.status,
          });
        }
      })
      .catch((err) => {
        console.warn('[AI Usage] Failed to persist event, non-fatal:', summarizeErrorForLog(err));
      });
  } catch (err) {
    console.warn('[AI Usage] Unexpected error, non-fatal:', summarizeErrorForLog(err));
  }
}
