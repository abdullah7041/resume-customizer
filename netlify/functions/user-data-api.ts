/**
 * Unified User Data API
 *
 * Handles GDPR data operations via action parameter:
 * - POST { action: "export" }  → Export all user data
 * - POST { action: "delete", confirmDelete: true }  → Delete user account
 */

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { withRateLimit } from '../lib/rate-limiter.js';
import { initSentry, captureError, redactForLog, summarizeErrorForLog } from '../lib/sentry.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { SearchIntentSchema, formatZodError } from '../lib/resume-schemas.js';

initSentry();

/**
 * Verify auth token and return user
 */
async function verifyAuth(authHeader: string | undefined) {
    if (!authHeader) {
        throw { statusCode: 401, message: 'Unauthorized' };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const supabaseAnon = createClient(
        (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!,
        (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)!
    );

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !user) {
        throw { statusCode: 401, message: 'Invalid token' };
    }

    return user;
}

/**
 * Get service role Supabase client
 */
function getServiceClient() {
    const supabase = getSupabaseClient();

    if (!supabase) {
        throw {
            statusCode: 500,
            message: 'Server configuration error. Please contact support.',
        };
    }

    return supabase;
}

/**
 * Handle export action - GDPR data export
 */
async function handleExport(email: string, userId: string) {
    const supabase = getServiceClient();

    const [
        { data: profile },
        { data: userCredits },
        { data: creditTransactions },
        { data: jobApplications },
        { data: feedbackReports },
        { data: strategicRealityChecks },
        { data: trackedCompanies },
        { data: jobFeedState },
        { data: legacyResumes },
        { data: legacyJobMatches },
        { data: legacyFeedback },
    ] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('email', email).single(),
        supabase.from('user_credits').select('*').eq('email', email).single(),
        supabase.from('credit_transactions').select('*').eq('email', email),
        supabase.from('job_applications').select('*').eq('user_id', userId),
        supabase.from('feedback_reports').select('*').eq('user_id', userId),
        supabase.from('strategic_reality_checks').select('*').eq('user_id', userId),
        supabase.from('user_tracked_companies').select('*').eq('user_id', userId),
        supabase.from('user_job_feed_state').select('*').eq('user_id', userId),
        supabase.from('resumes').select('*').eq('email', email),
        supabase.from('job_matches').select('*').eq('email', email),
        supabase.from('feedback').select('*').eq('email', email),
    ]);

    return {
        exportDate: new Date().toISOString(),
        exportType: 'GDPR_DATA_EXPORT',
        userData: {
            profile,
            userCredits,
            creditTransactions,
            jobApplications,
            feedbackReports,
            strategicRealityChecks,
            trackedCompanies,
            jobFeedState,
            legacyDeprecated: {
                resumes: legacyResumes,
                jobMatches: legacyJobMatches,
                feedback: legacyFeedback,
            },
        },
    };
}

/**
 * Handle delete action - Account deletion
 */
async function handleDelete(email: string, userId: string, confirmDelete: boolean) {
    if (!confirmDelete) {
        throw { statusCode: 400, message: 'Confirmation required' };
    }

    const supabase = getServiceClient();

    // Generate anonymous hash for deletion log (GDPR compliant)
    const emailHash = crypto.createHash('sha256').update(email).digest('hex');
    
    // Log deletion before removing the account
    const { error: logError } = await supabase.from('deletion_log').insert({
        user_id_hash: emailHash,
        deletion_date: new Date().toISOString()
    });
    
    if (logError) {
        console.error("Could not log to deletion_log (table might not exist)", summarizeErrorForLog(logError));
    }

    // Delete in order (respecting foreign keys). Supabase resolves rather than
    // throws on row errors, so inspect each result and surface any failure
    // BEFORE deleting the auth user — otherwise a partial deletion would be
    // silently reported as success (GDPR risk).
    const deletions: Array<{ table: string; error: unknown }> = [
        { table: 'strategic_reality_checks', error: (await supabase.from('strategic_reality_checks').delete().eq('user_id', userId)).error },
        { table: 'feedback_reports', error: (await supabase.from('feedback_reports').delete().eq('user_id', userId)).error },
        { table: 'job_applications', error: (await supabase.from('job_applications').delete().eq('user_id', userId)).error },
        { table: 'user_job_feed_state', error: (await supabase.from('user_job_feed_state').delete().eq('user_id', userId)).error },
        { table: 'user_tracked_companies', error: (await supabase.from('user_tracked_companies').delete().eq('user_id', userId)).error },
        { table: 'credit_transactions', error: (await supabase.from('credit_transactions').delete().eq('email', email)).error },
        { table: 'job_matches', error: (await supabase.from('job_matches').delete().eq('email', email)).error },
        { table: 'resumes', error: (await supabase.from('resumes').delete().eq('email', email)).error },
        { table: 'feedback', error: (await supabase.from('feedback').delete().eq('email', email)).error },
        { table: 'user_credits', error: (await supabase.from('user_credits').delete().eq('email', email)).error },
        { table: 'user_profiles', error: (await supabase.from('user_profiles').delete().eq('email', email)).error },
    ];

    const failedDeletions = deletions.filter((deletion) => deletion.error);
    if (failedDeletions.length > 0) {
        for (const failed of failedDeletions) {
            console.error(`[user-data-api] Failed to delete from ${failed.table}:`, summarizeErrorForLog(failed.error));
        }
        throw {
            statusCode: 500,
            message: `Account deletion incomplete: ${failedDeletions.map((deletion) => deletion.table).join(', ')} could not be cleared`,
        };
    }

    // Delete auth user (cascades remaining data)
    const authDeleteResult = await supabase.auth.admin.deleteUser(userId);
    const authDeleteError = authDeleteResult?.error;
    if (authDeleteError) {
        console.error('[user-data-api] Failed to delete auth user:', summarizeErrorForLog(authDeleteError));
        throw { statusCode: 500, message: 'Account data cleared but auth user deletion failed' };
    }

    console.log(`User ${redactForLog(email)} deleted their account at ${new Date().toISOString()}`);

    return { message: 'Account deleted' };
}

/**
 * Persist the onboarding search intent on the user's profile.
 *
 * This used to write to public.resumes, which is deprecated and holds zero rows —
 * so every save updated 0 rows and every read returned null, and no user has ever
 * had a server-side intent. user_profiles is the live table, keyed by a unique
 * email, and is created at signup, so the write lands.
 */
async function handleSaveSearchIntent(email: string, rawIntent: unknown) {
    const parsed = SearchIntentSchema.safeParse(rawIntent);
    if (!parsed.success) {
        throw { statusCode: 400, message: `Invalid searchIntent: ${formatZodError(parsed.error)}` };
    }

    const supabase = getServiceClient();
    const { error } = await supabase
        .from('user_profiles')
        .update({ search_intent: parsed.data })
        .eq('email', email);

    if (error) {
        console.error('[user-data-api] Failed to save search_intent:', summarizeErrorForLog(error));
        throw { statusCode: 500, message: 'Failed to save search intent' };
    }

    return { searchIntent: parsed.data };
}

/**
 * Load the most recent persisted search intent for the user.
 */
async function handleGetSearchIntent(email: string) {
    const supabase = getServiceClient();
    const { data, error } = await supabase
        .from('user_profiles')
        .select('search_intent')
        .eq('email', email)
        .maybeSingle();

    if (error) {
        console.error('[user-data-api] Failed to load search_intent:', summarizeErrorForLog(error));
        throw { statusCode: 500, message: 'Failed to load search intent' };
    }

    return { searchIntent: data?.search_intent ?? null };
}

const baseHandler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    try {
        // Verify authentication
        const authHeader = event.headers.authorization || event.headers.Authorization;
        const user = await verifyAuth(authHeader);
        const userId = user.id;
        const userEmail = user.email;

        if (!userEmail) {
            return { statusCode: 400, body: JSON.stringify({ error: 'User email is missing' }) };
        }

        // Parse request body
        const body = JSON.parse(event.body || '{}');
        const action = body.action;

        // ===================== Export Action =====================
        if (action === 'export') {
            const exportData = await handleExport(userEmail, userId);
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': 'attachment; filename="watheq-user-data-export.json"',
                },
                body: JSON.stringify(exportData, null, 2),
            };
        }

        // ===================== Delete Action =====================
        if (action === 'delete') {
            const result = await handleDelete(userEmail, userId, body.confirmDelete);
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, ...result }),
            };
        }

        // ===================== Save Search Intent =====================
        if (action === 'save_search_intent') {
            const result = await handleSaveSearchIntent(userEmail, body.searchIntent);
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true, ...result }),
            };
        }

        // ===================== Get Search Intent =====================
        if (action === 'get_search_intent') {
            const result = await handleGetSearchIntent(userEmail);
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true, ...result }),
            };
        }

        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid action. Use: export, delete, save_search_intent, get_search_intent' }),
        };

    } catch (error: unknown) {
        console.error('[user-data-api] Error:', summarizeErrorForLog(error));
        captureError(error, { function: 'user-data-api' });

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
            body: JSON.stringify({ error: 'Operation failed' }),
        };
    }
};

export const handler = withRateLimit("user-data-api", baseHandler);
