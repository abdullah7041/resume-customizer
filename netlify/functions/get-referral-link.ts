/**
 * Get Referral Link Function
 *
 * Generates or retrieves a user's unique referral link.
 * Returns both the referral code and full URL.
 */

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { customAlphabet } from 'nanoid';

// Generate short, URL-safe referral codes (8 characters)
const generateCode = customAlphabet('0123456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', 8);

/**
 * Get Supabase client with service role
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

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

    const supabase = getSupabaseClient();

    // Check if user already has a referral code in user_credits table
    const { data: userData, error: fetchError } = await supabase
      .from('user_credits')
      .select('referral_code')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[get-referral-link] Fetch error:', fetchError);
      throw new Error('Failed to fetch user data');
    }

    let referralCode = userData?.referral_code;

    // Generate new code if user doesn't have one
    if (!referralCode) {
      referralCode = generateCode();

      // Update user_credits with new referral code
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({ referral_code: referralCode })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[get-referral-link] Update error:', updateError);
        throw new Error('Failed to save referral code');
      }

      console.log(`[get-referral-link] Generated new code for user ${userId}: ${referralCode}`);
    }

    // Build full referral URL
    const baseUrl = process.env.URL || 'https://watheq.app';
    const referralUrl = `${baseUrl}?ref=${referralCode}`;

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        referralCode,
        referralUrl,
      }),
    };
  } catch (error) {
    console.error('[get-referral-link] Error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to generate referral link',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

export { handler };
