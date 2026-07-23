import { getSupabaseClient } from './supabase-client.js';
import { summarizeErrorForLog } from './sentry.js';

const AI_USAGE_PERSIST_TIMEOUT_MS = 1500;

/**
 * Record an AI usage event for future cost tracking.
 * Failures are logged but never thrown.
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
 * @param {string|null} [event.user_ref]
 * @param {string|null} [event.jd_fingerprint]
 */
export async function recordAiUsageEvent(event) {
  try {
    if (process.env.BENCHMARK_DISABLE_USAGE_LOGGING === 'true') {
      return;
    }

    const eventToInsert = { ...event };
    if (process.env.AI_USAGE_USER_ATTRIBUTION !== 'true') {
      delete eventToInsert.user_ref;
      delete eventToInsert.jd_fingerprint;
    }

    const client = getSupabaseClient();
    if (!client) {
      console.warn('[AI Usage] Supabase unavailable, structured log:', JSON.stringify(eventToInsert));
      return;
    }
    // Supabase query builder returns PromiseLike, so wrap with Promise.resolve
    // before awaiting per project conventions.
    let timeoutId;
    const insertPromise = Promise.resolve(client.from('ai_usage_events').insert(eventToInsert));
    const timedInsert = Promise.race([
      insertPromise,
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve({ timedOut: true }), AI_USAGE_PERSIST_TIMEOUT_MS);
      }),
    ]);

    let result;
    try {
      result = await timedInsert;
    } finally {
      clearTimeout(timeoutId);
    }

    if (result?.timedOut) {
      insertPromise.catch((err) => {
        console.warn('[AI Usage] Delayed persist failed after timeout, non-fatal:', summarizeErrorForLog(err));
      });
      console.warn('[AI Usage] Persist attempt timed out, non-fatal:', {
        timeout_ms: AI_USAGE_PERSIST_TIMEOUT_MS,
      });
      return;
    }

    const { error } = result;
    if (error) {
      console.warn('[AI Usage] Failed to persist event, non-fatal:', {
        message: error.message,
        code: error.code,
        status: error.status,
      });
    }
  } catch (err) {
    console.warn('[AI Usage] Unexpected error, non-fatal:', summarizeErrorForLog(err));
  }
}
