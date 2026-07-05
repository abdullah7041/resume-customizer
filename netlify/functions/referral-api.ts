/**
 * Unified Referral API
 *
 * Handles all referral-related operations via action parameter:
 * - GET  ?action=get-link               → Get/generate referral link
 * - GET  ?action=get-stats              → Get referral statistics
 * - GET  ?action=get-summary            → Get link and statistics
 * - POST { action: "track", ... }         → Track a new referral
 */

import { Handler } from '@netlify/functions';
import { customAlphabet } from 'nanoid';
import { getReferralStats, trackReferral } from '../lib/referral-manager.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { redactForLog } from '../lib/sentry.js';

// Generate short, URL-safe referral codes (8 characters)
const generateCode = customAlphabet('0123456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', 8);

interface HttpError {
    statusCode: number;
    message: string;
}

function httpError(statusCode: number, message: string): HttpError {
    return { statusCode, message };
}

function isHttpError(error: unknown): error is HttpError {
    return Boolean(
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        'message' in error
    );
}

function summarizeErrorForLog(error: unknown) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: redactForLog(error.message)
        };
    }

    if (isHttpError(error)) {
        return {
            statusCode: error.statusCode,
            message: redactForLog(error.message)
        };
    }

    return redactForLog(error);
}

interface AuthenticatedReferralUser {
    id: string;
    email: string;
}

async function getAuthenticatedUser(event: Parameters<Handler>[0]): Promise<AuthenticatedReferralUser> {
    const authHeader = event.headers.authorization || event.headers.Authorization;

    if (!authHeader) {
        throw httpError(401, 'Authentication required');
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
        throw httpError(500, 'Server configuration error. Please contact support.');
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user?.id || !user?.email) {
        throw httpError(401, 'Invalid or expired authentication token');
    }

    return { id: user.id, email: user.email };
}

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
        console.error('[referral-api] Fetch error:', summarizeErrorForLog(fetchError));
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
            console.error('[referral-api] Update error:', summarizeErrorForLog(updateError));
            throw new Error('Failed to save referral code');
        }

        console.log(`[referral-api] Generated new code for user ${redactForLog(email)}: ${referralCode}`);
    }

    // Build full referral URL
    const baseUrl = process.env.URL || 'https://watheqai.app';
    const referralUrl = `${baseUrl}?ref=${referralCode}`;

    return { referralCode, referralUrl };
}

/**
 * Handle GET /get-stats - Get referral statistics
 */
async function handleGetStats(userId: string) {
    const stats = await getReferralStats(userId);

    // Map new field names to legacy format for backward compatibility
    return {
        totalReferrals: stats.total,
        completedReferrals: stats.completed,
        pendingReferrals: stats.pending,
        creditsEarned: stats.creditsEarned
    };
}

async function handleGetSummary(user: AuthenticatedReferralUser) {
    const [link, stats] = await Promise.all([
        handleGetLink(user.email),
        handleGetStats(user.id)
    ]);

    return { ...link, ...stats };
}

/**
 * Handle POST /track - Track a new referral
 * Expects: { referral_code: string }
 */
async function handleTrack(body: { referral_code: string }, refereeEmail: string, refereeUserId: string) {
    const { referral_code } = body;

    // Validate required fields
    if (!referral_code) {
        throw httpError(400, 'Missing required field: referral_code');
    }

    const result = await trackReferral(referral_code, refereeEmail, refereeUserId);

    if (!result.success) {
        throw httpError(400, result.error || 'Failed to track referral');
    }

    return { success: true, message: 'Referral tracked successfully' };
}

const handler: Handler = async (event) => {
    const method = event.httpMethod;

    try {
        // ===================== GET Requests =====================
        if (method === 'GET') {
            const action = event.queryStringParameters?.action;
            const user = await getAuthenticatedUser(event);

            if (action === 'get-link') {
                try {
                    const result = await handleGetLink(user.email);
                    return {
                        statusCode: 200,
                        body: JSON.stringify({ success: true, ...result }),
                    };
                } catch (linkError) {
                    console.error('[referral-api] get-link error:', summarizeErrorForLog(linkError));
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
                const stats = await handleGetStats(user.id);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, ...stats }),
                };
            }

            if (action === 'get-summary') {
                const summary = await handleGetSummary(user);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, ...summary }),
                };
            }

            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid action. Use: get-link, get-stats, get-summary' }),
            };
        }

        // ===================== POST Requests =====================
        if (method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const action = body.action;
            const user = await getAuthenticatedUser(event);

            if (action === 'track') {
                const result = await handleTrack(body, user.email, user.id);
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
        console.error('[referral-api] Error:', summarizeErrorForLog(error));

        // Handle custom errors with statusCode
        if (isHttpError(error)) {
            return {
                statusCode: error.statusCode,
                body: JSON.stringify({ error: error.message }),
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
