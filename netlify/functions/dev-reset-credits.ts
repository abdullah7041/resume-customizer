/**
 * DEV ONLY: Reset Credits Function
 *
 * Resets credits for testing purposes.
 * IMPORTANT: Only enable in development/staging environments!
 *
 * Usage:
 * - GET  /.netlify/functions/dev-reset-credits?email=xxx  (reset specific user)
 * - POST /.netlify/functions/dev-reset-credits              (reset all users)
 */

import { Handler } from '@netlify/functions';
import { requireAdminMutationGate } from '../lib/admin-gates.js';
import { getSupabaseClient } from '../lib/supabase-client.js';

const handler: Handler = async (event) => {
  const gate = requireAdminMutationGate(event, 'ALLOW_DEV_RESET');
  if (gate.ok === false) {
    return {
      statusCode: gate.statusCode,
      body: JSON.stringify({ error: gate.error }),
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Database connection failed' }),
    };
  }

  try {
    if (event.httpMethod === 'GET') {
      // Reset specific user
      const email = event.queryStringParameters?.email || event.queryStringParameters?.user_id;

      if (!email) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'email parameter required' }),
        };
      }

      const { data, error } = await supabase
        .from('user_credits')
        .update({
          credits_remaining: 20,
          last_reset_date: new Date().toISOString(),
        })
        .eq('email', email)
        .select();

      if (error) throw error;

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: `Credits reset for user ${email}`,
          data: data[0],
        }),
      };
    }

    if (event.httpMethod === 'POST') {
      // Reset all users
      const { count, error } = await supabase
        .from('user_credits')
        .update({
          credits_remaining: 20,
          last_reset_date: new Date().toISOString(),
        })
        .not('email', 'is', null); // Update all real users

      if (error) throw error;

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: `Credits reset for ${count} users`,
          count,
        }),
      };
    }

    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('[dev-reset-credits] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to reset credits',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

export { handler };
