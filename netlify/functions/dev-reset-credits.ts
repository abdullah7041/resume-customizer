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
import { summarizeErrorForLog } from '../lib/sentry.js';

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

      const { data, error } = await supabase.rpc('reset_free_credits', {
        p_email: email, p_amount: 20,
      });

      if (error) throw error;

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: `Credits reset for user ${email}`,
          data,
        }),
      };
    }

    if (event.httpMethod === 'POST') {
      // Reset all users
      const { data: users, error } = await supabase
        .from('user_credits')
        .select('email')
        .not('email', 'is', null); // Update all real users

      if (error) throw error;
      let count = 0;
      for (const user of users ?? []) {
        const { error: resetError } = await supabase.rpc('reset_free_credits', {
          p_email: user.email, p_amount: 20,
        });
        if (resetError) throw resetError;
        count++;
      }

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
    console.error('[dev-reset-credits] Error:', summarizeErrorForLog(error));
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
