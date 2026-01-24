import { Handler } from '@netlify/functions';
import { trackReferral } from '../lib/referral-manager.js';

const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { referrer_id, referee_id, referee_email } = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!referrer_id || !referee_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: referrer_id, referee_id' }),
      };
    }

    // Prevent self-referrals
    if (referrer_id === referee_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Cannot refer yourself' }),
      };
    }

    // Track the referral
    const result = await trackReferral(referrer_id, referee_id, referee_email || null);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        referralId: result.referralId,
        message: 'Referral tracked successfully',
      }),
    };
  } catch (error) {
    console.error('[track-referral] Error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to track referral',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

export { handler };
