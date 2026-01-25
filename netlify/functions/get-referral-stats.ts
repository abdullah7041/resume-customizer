/**
 * Get Referral Stats Function
 *
 * Returns referral statistics for a user:
 * - Total referrals made
 * - Completed referrals (that earned credits)
 * - Total credits earned from referrals
 */

import { Handler } from '@netlify/functions';
import { getReferralStats } from '../lib/referral-manager.js';

const handler: Handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get user ID from query params
    const userId = event.queryStringParameters?.user_id;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing user_id parameter' }),
      };
    }

    // Fetch stats from referral manager
    const stats = await getReferralStats(userId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ...stats,
      }),
    };
  } catch (error) {
    console.error('[get-referral-stats] Error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch referral stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

export { handler };
