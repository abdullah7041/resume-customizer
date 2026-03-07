/**
 * Unified User Data API
 *
 * Handles GDPR data operations via action parameter:
 * - POST { action: "export" }  → Export all user data
 * - POST { action: "delete", confirmDelete: true }  → Delete user account
 */

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { initSentry, captureError } from '../lib/sentry';

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
        process.env.SUPABASE_ANON_KEY!
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
    return createClient(
        (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

/**
 * Handle export action - GDPR data export
 */
async function handleExport(userId: string) {
    const supabase = getServiceClient();

    const [
        { data: profile },
        { data: resumes },
        { data: jobMatches },
        { data: jobApplications },
    ] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', userId).single(),
        supabase.from('resumes').select('*').eq('user_id', userId),
        supabase.from('job_matches').select('*').eq('user_id', userId),
        supabase.from('job_applications').select('*').eq('user_id', userId),
    ]);

    return {
        exportDate: new Date().toISOString(),
        exportType: 'GDPR_DATA_EXPORT',
        userData: { profile, resumes, jobMatches, jobApplications },
    };
}

/**
 * Handle delete action - Account deletion
 */
async function handleDelete(userId: string, confirmDelete: boolean) {
    if (!confirmDelete) {
        throw { statusCode: 400, message: 'Confirmation required' };
    }

    const supabase = getServiceClient();

    // Delete in order (respecting foreign keys)
    await supabase.from('job_matches').delete().eq('user_id', userId);
    await supabase.from('resumes').delete().eq('user_id', userId);
    await supabase.from('user_profiles').delete().eq('id', userId);

    // Delete auth user (cascades remaining data)
    await supabase.auth.admin.deleteUser(userId);

    console.log(`User ${userId} deleted their account at ${new Date().toISOString()}`);

    return { message: 'Account deleted' };
}

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    try {
        // Verify authentication
        const authHeader = event.headers.authorization || event.headers.Authorization;
        const user = await verifyAuth(authHeader);
        const userId = user.id;

        // Parse request body
        const body = JSON.parse(event.body || '{}');
        const action = body.action;

        // ===================== Export Action =====================
        if (action === 'export') {
            const exportData = await handleExport(userId);
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="user-data-export-${userId}.json"`,
                },
                body: JSON.stringify(exportData, null, 2),
            };
        }

        // ===================== Delete Action =====================
        if (action === 'delete') {
            const result = await handleDelete(userId, body.confirmDelete);
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, ...result }),
            };
        }

        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid action. Use: export, delete' }),
        };

    } catch (error: unknown) {
        console.error('[user-data-api] Error:', error);
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
