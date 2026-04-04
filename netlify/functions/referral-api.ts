/**
 * Unified Referral API
 *
 * Handles all referral-related operations via action parameter:
 * - GET  ?action=get-link&email=xxx     → Get/generate referral link
 * - GET  ?action=get-stats&email=xxx    → Get referral statistics
 * - POST { action: "track", ... }         → Track a new referral
 */

import { Handler } from '@netlify/functions';
import { customAlphabet } from 'nanoid';
import { getReferralStats, trackReferral } from '../lib/referral-manager.js';
import { getSupabaseClient } from '../lib/supabase-client.js';

// Generate short, URL-safe referral codes (8 characters)
const generateCode = customAlphabet('0123456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', 8);

/**
 * Handle GET /get-link - Generate or retrieve referral link
 */
async function handleGetLink(email: string) {
    const supabase = getSupabaseClient();

    if (!supabase) {
        throw new Error('Supabase client not available');
    }

    // Check if user already has a referral code
    const { data: userData, error: fetchError } = await supabase
        .from('user_credits')
        .select('referral_code')
        .eq('email', email)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('[referral-api] Fetch error:', fetchError);
        throw new Error('Failed to fetch user data');
    }

    let referralCode = userData?.referral_code;

    // Generate new code if user doesn't have one
    if (!referralCode) {
        referralCode = generateCode();

        const { error: updateError } = await supabase
            .from('user_credits')
            .update({ referral_code: referralCode })
            .eq('email', email);

        if (updateError) {
            console.error('[referral-api] Update error:', updateError);
            throw new Error('Failed to save referral code');
        }

        console.log(`[referral-api] Generated new code for user ${email}: ${referralCode}`);
    }

    // Build full referral URL
    const baseUrl = process.env.URL || 'https://watheqai.app';
    const referralUrl = `${baseUrl}?ref=${referralCode}`;

    return { referralCode, referralUrl };
}

/**
 * Handle GET /get-stats - Get referral statistics
 */
async function handleGetStats(email: string) {
    const stats = await getReferralStats(email);

    // Map new field names to legacy format for backward compatibility
    return {
        totalReferrals: stats.total,
        completedReferrals: stats.completed,
        pendingReferrals: stats.pending,
        creditsEarned: stats.creditsEarned
    };
}

/**
 * Handle POST /track - Track a new referral
 * Expects: { referral_code: string, referee_email: string }
 */
async function handleTrack(body: { referral_code: string; referee_email: string }) {
    const { referral_code, referee_email } = body;

    // Validate required fields
    if (!referral_code || !referee_email) {
        throw { statusCode: 400, message: 'Missing required fields: referral_code, referee_email' };
    }

    const result = await trackReferral(referral_code, referee_email);

    if (!result.success) {
        throw { statusCode: 400, message: result.error || 'Failed to track referral' };
    }

    return { success: true, message: 'Referral tracked successfully' };
}

const handler: Handler = async (event) => {
    const method = event.httpMethod;

    try {
        // ===================== GET Requests =====================
        if (method === 'GET') {
            const action = event.queryStringParameters?.action;
            const email = event.queryStringParameters?.email;

            if (!email) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Missing email parameter' }),
                };
            }

            if (action === 'get-link') {
                try {
                    const result = await handleGetLink(email);
                    return {
                        statusCode: 200,
                        body: JSON.stringify({ success: true, ...result }),
                    };
                } catch (linkError) {
                    console.error('[referral-api] get-link error:', linkError);
                    return {
                        statusCode: 500,
                        body: JSON.stringify({
                            error: 'Failed to generate referral link',
                            details: linkError instanceof Error ? linkError.message : 'Unknown error'
                        }),
                    };
                }
            }

            if (action === 'get-stats') {
                const stats = await handleGetStats(email);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, ...stats }),
                };
            }

            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid action. Use: get-link, get-stats' }),
            };
        }

        // ===================== POST Requests =====================
        if (method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const action = body.action;

            if (action === 'track') {
                const result = await handleTrack(body);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, ...result }),
                };
            }

            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid action. Use: track' }),
            };
        }

        // Other methods not allowed
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };

    } catch (error: unknown) {
        console.error('[referral-api] Error:', error);

        // Handle custom errors with statusCode
        if (error && typeof error === 'object' && 'statusCode' in error) {
            const err = error as { statusCode: number; message: string };
            return {
                statusCode: err.statusCode,
                body: JSON.stringify({ error: err.message }),
            };
        }

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Referral operation failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};

export { handler };
