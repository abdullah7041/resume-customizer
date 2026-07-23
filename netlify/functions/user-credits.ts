import { Handler } from '@netlify/functions';
import { getUserCredits, isEmailVerified } from '../lib/credit-manager.js';
import { getClientIP } from '../lib/ip-utils.js';
import { withRateLimit } from '../lib/rate-limiter.js';
import { initSentry, captureError, summarizeErrorForLog } from '../lib/sentry.js';
import { getSupabaseClient } from '../lib/supabase-client.js';

initSentry();

const headers = { 'Content-Type': 'application/json' };

/**
 * Authoritative credit balance for the signed-in user.
 *
 * The client normally reads `user_credits` directly through RLS, but a row
 * carrying `signup_metadata.pending_initial_grant` has a zero balance until the
 * server issues the grant. Only `getUserCredits` can issue it (it runs the
 * IP-abuse and email-verification checks), so the client cannot resolve that
 * state on its own — without this endpoint a pending user sees zero credits,
 * every credit-gated action stays disabled, and no server call is ever made to
 * release the grant.
 */
const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Authentication required. Please sign in.' }),
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const client = getSupabaseClient();
  if (!client) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'Service temporarily unavailable' }),
    };
  }

  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user?.email) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Invalid or expired authentication token' }),
    };
  }

  try {
    const credits = await getUserCredits(user.email, {
      ipAddress: getClientIP(event),
      emailVerified: isEmailVerified(user),
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        creditsRemaining: credits?.credits_remaining ?? 0,
        creditsTotal: credits?.credits_total ?? 0,
        feedbackCreditsEarned: credits?.feedback_credits_earned ?? 0,
        referralCreditsEarned: credits?.referral_credits_earned ?? 0,
        lastResetDate: credits?.last_reset_date ?? null,
        // Still pending means the grant was withheld — currently only when the
        // email is unverified. The client uses this to explain the zero balance.
        pendingInitialGrant: credits?.signup_metadata?.pending_initial_grant === true,
        emailVerified: isEmailVerified(user),
      }),
    };
  } catch (error) {
    console.error('[user-credits] Failed to resolve credits:', summarizeErrorForLog(error));
    captureError(error, { function: 'user-credits', userId: user.id });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to retrieve credit balance' }),
    };
  }
};

export const handler = withRateLimit('user-credits', baseHandler);
