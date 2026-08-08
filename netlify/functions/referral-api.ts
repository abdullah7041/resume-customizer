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
import { withRateLimit } from '../lib/rate-limiter.js';
import { getReferralStats, trackReferral } from '../lib/referral-manager.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { redactForLog } from '../lib/sentry.js';

// Generate short, URL-safe referral codes (8 characters)
const generateCode = customAlphabet('0123456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', 8);

class ReferralError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.name = 'ReferralError';
        this.status = status;
        this.code = code;
    }
}

function httpError(status: number, code: string, message: string): ReferralError {
    return new ReferralError(status, code, message);
}

function isHttpError(error: unknown): error is ReferralError {
    return error instanceof ReferralError;
}

function normalizeReferralError(error: unknown, fallbackCode: string, fallbackMessage: string): ReferralError {
    if (isHttpError(error)) return error;
    return httpError(500, fallbackCode, fallbackMessage);
}

function summarizeErrorForLog(error: unknown) {
    if (isHttpError(error)) {
        return {
            status: error.status,
            code: error.code,
            name: error.name,
            message: redactForLog(error.message)
        };
    }

    if (error instanceof Error) {
        return {
            name: error.name,
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
        throw httpError(401, 'referral/auth-required', 'Authentication required');
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
        throw httpError(500, 'referral/server-misconfigured', 'Server configuration error. Please contact support.');
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user?.id || !user?.email) {
        throw httpError(401, 'referral/auth-invalid', 'Invalid or expired authentication token');
    }

    return { id: user.id, email: user.email };
}

// Postgres "undefined column" — the referral migrations were not applied to
// this database. Keep the actionable diagnosis in server logs only.
const PG_UNDEFINED_COLUMN = '42703';

function describeDbError(prefix: string, dbError: { code?: string; message?: string }): ReferralError {
    if (dbError.code === PG_UNDEFINED_COLUMN) {
        console.error('[referral-api] Referral schema unavailable:', {
            operation: prefix,
            code: PG_UNDEFINED_COLUMN,
            migration: 'supabase/migrations/20260713000000_ensure_referral_schema.sql'
        });
        return httpError(
            500,
            'referral/db-undefined-column',
            'Referral data unavailable'
        );
    }
    return httpError(500, 'referral/db-error', 'Referral data unavailable');
}

/**
 * Handle GET /get-link - Generate or retrieve referral link
 */
async function handleGetLink(email: string) {
    const supabase = getSupabaseClient();

    if (!supabase) {
        throw httpError(500, 'referral/server-misconfigured', 'Supabase client not available');
    }

    // Check if user already has a referral code
    const { data: userData, error: fetchError } = await supabase
        .from('user_credits')
        .select('referral_code')
        .eq('email', email)
        .maybeSingle();

    if (fetchError) {
        console.error('[referral-api] Fetch error:', summarizeErrorForLog(fetchError));
        throw describeDbError('Failed to fetch referral profile', fetchError);
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
            .is('referral_code', null)
            .select('referral_code')
            .maybeSingle();

        if (updateError) {
            console.error('[referral-api] Update error:', summarizeErrorForLog(updateError));
            throw describeDbError('Failed to save referral code', updateError);
        }

        if (!savedRow) {
            const { data: concurrentRow, error: concurrentFetchError } = await supabase
                .from('user_credits')
                .select('referral_code')
                .eq('email', email)
                .maybeSingle();

            if (concurrentFetchError) {
                console.error('[referral-api] Concurrent code fetch error:', summarizeErrorForLog(concurrentFetchError));
                throw describeDbError('Failed to fetch concurrent referral code', concurrentFetchError);
            }

            if (concurrentRow?.referral_code) {
                referralCode = concurrentRow.referral_code;
                // A concurrent request persisted the code after our initial read.
                // Return that durable winner instead of treating it as a missing profile.
            } else {
            console.error(`[referral-api] No user_credits row for ${redactForLog(email)} — cannot persist referral code.`);
            throw httpError(
                500,
                'referral/profile-not-found',
                'Referral profile not found. Your credits account may still be initializing — try again shortly.'
            );
            }
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

    const linkError = linkResult.status === 'rejected'
        ? normalizeReferralError(linkResult.reason, 'referral/link-failed', 'Failed to generate referral link')
        : null;
    const statsError = statsResult.status === 'rejected'
        ? normalizeReferralError(statsResult.reason, 'referral/stats-failed', 'Failed to load referral statistics')
        : null;

    return {
        ...(linkResult.status === 'fulfilled'
            ? linkResult.value
            : {
                linkError: linkError!.message,
                linkErrorCode: linkError!.code,
                linkErrorStatus: linkError!.status,
            }),
        ...(statsResult.status === 'fulfilled'
            ? statsResult.value
            : {
                statsError: statsError!.message,
                statsErrorCode: statsError!.code,
                statsErrorStatus: statsError!.status,
            }),
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
        throw httpError(400, 'referral/code-required', 'Missing required field: referral_code');
    }

    const result = await trackReferral(referral_code, refereeEmail, refereeUserId);

    if (!result.success) {
        console.error('[referral-api] Track failed:', summarizeErrorForLog(result.error || 'Failed to track referral'));
        throw httpError(400, 'referral/track-failed', 'Failed to track referral');
    }

    return { success: true, message: 'Referral tracked successfully' };
}

const baseHandler: Handler = async (event) => {
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
                    const normalizedError = normalizeReferralError(
                        linkError,
                        'referral/link-failed',
                        'Failed to generate referral link'
                    );
                    return {
                        statusCode: normalizedError.status,
                        body: JSON.stringify({
                            error: 'Failed to generate referral link',
                            status: normalizedError.status,
                            code: normalizedError.code,
                            message: normalizedError.message,
                            details: normalizedError.message
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
                statusCode: error.status,
                body: JSON.stringify({
                    status: error.status,
                    code: error.code,
                    message: error.message,
                    error: error.message,
                }),
            };
        }

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Referral operation failed',
                code: 'referral/unexpected',
            }),
        };
    }
};

export const handler = withRateLimit("referral-api", baseHandler);
