/**
 * DEV ONLY: Reset Credits Function
 *
 * Resets credits for testing purposes.
 * IMPORTANT: Only enable in development/staging environments!
 *
 * Usage:
 * - GET  /.netlify/functions/dev-reset-credits?user_id=xxx  (reset specific user)
 * - POST /.netlify/functions/dev-reset-credits              (reset all users)
 */

import { Handler } from '@netlify/functions';
import { getSupabaseClient } from '../lib/supabase-client';

const handler: Handler = async (event) => {
  // SAFETY: Only allow in development
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_RESET) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Not available in production' }),
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
      const userId = event.queryStringParameters?.user_id;

      if (!userId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'user_id parameter required' }),
        };
      }

      const { data, error } = await supabase
        .from('user_credits')
        .update({
          credits_remaining: 15,
          last_reset_date: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select();

      if (error) throw error;

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: `Credits reset for user ${userId}`,
          data: data[0],
        }),
      };
    }

    if (event.httpMethod === 'POST') {
      // Reset all users
      const { count, error } = await supabase
        .from('user_credits')
        .update({
          credits_remaining: 15,
          last_reset_date: new Date().toISOString(),
        })
        .neq('user_id', '00000000-0000-0000-0000-000000000000'); // Update all real users

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
