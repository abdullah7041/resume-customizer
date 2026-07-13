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

// Postgres "undefined column" — the referral migrations were not applied to
// this database. Surface a precise message instead of a generic failure so the
// Netlify function log (and the error details) say exactly what to run.
const PG_UNDEFINED_COLUMN = '42703';

function describeDbError(prefix: string, dbError: { code?: string; message?: string }): string {
    if (dbError.code === PG_UNDEFINED_COLUMN) {
        return `${prefix}: the user_credits referral columns are missing. Apply the referral migrations in supabase/migrations (see 20260713000000_ensure_referral_schema.sql).`;
    }
    return `${prefix} (db code: ${dbError.code || 'unknown'})`;
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
        .maybeSingle();

    if (fetchError) {
        console.error('[referral-api] Fetch error:', summarizeErrorForLog(fetchError));
        throw new Error(describeDbError('Failed to fetch referral profile', fetchError));
    }

    let referralCode = userData?.referral_code;

    // Generate new code if user doesn't have one
    if (!referralCode) {
        referralCode = generateCode();

        // .select() verifies a row was actually updated: without it, a missing
        // user_credits row silently "succeeds" and we hand out a referral code
        // that was never persisted — a dead link no signup can ever match.
        const { data: savedRow, error: updateError } = await supabase
            .from('user_credits')
            .update({ referral_code: referralCode })
            .eq('email', email)
            .select('referral_code')
            .maybeSingle();

        if (updateError) {
            console.error('[referral-api] Update error:', summarizeErrorForLog(updateError));
            throw new Error(describeDbError('Failed to save referral code', updateError));
        }

        if (!savedRow) {
            console.error(`[referral-api] No user_credits row for ${redactForLog(email)} — cannot persist referral code.`);
            throw new Error('Referral profile not found. Your credits account may still be initializing — try again shortly.');
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
    // One failing leg must not take down the whole summary: previously a
    // get-link failure rejected the Promise.all and the modal showed BOTH
    // "Referral stats unavailable" and "Referral link unavailable". Now stats
    // still render and the link box carries the specific error.
    const [linkResult, statsResult] = await Promise.allSettled([
        handleGetLink(user.email),
        handleGetStats(user.id)
    ]);

    if (linkResult.status === 'rejected' && statsResult.status === 'rejected') {
        throw linkResult.reason;
    }

    if (linkResult.status === 'rejected') {
        console.error('[referral-api] get-summary link leg failed:', summarizeErrorForLog(linkResult.reason));
    }
    if (statsResult.status === 'rejected') {
        console.error('[referral-api] get-summary stats leg failed:', summarizeErrorForLog(statsResult.reason));
    }

    return {
        ...(linkResult.status === 'fulfilled'
            ? linkResult.value
            : { linkError: linkResult.reason instanceof Error ? linkResult.reason.message : 'Failed to generate referral link' }),
        ...(statsResult.status === 'fulfilled'
            ? statsResult.value
            : { totalReferrals: 0, completedReferrals: 0, pendingReferrals: 0, creditsEarned: 0 }),
    };
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
