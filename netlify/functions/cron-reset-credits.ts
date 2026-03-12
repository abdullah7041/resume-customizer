/**
 * Netlify Scheduled Function: Reset Monthly Credits
 * Triggered: Daily at 2 AM GMT+3
 *
 * Purpose:
 * - Find users whose credit reset date was >30 days ago
 * - Reset their credits to 15
 * - Send "Credits Refreshed" email notification
 * - Log transaction
 */

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { sendCreditsRefreshedEmail } from '../lib/email-service.js';

const handler: Handler = async (event) => {
  console.log('[cron-reset-credits] Starting scheduled credit reset...');

  // Scheduled functions should only be called from Netlify's internal scheduler
  // But we can verify by checking for the X-Webhook-Signature header or similar
  const isScheduledCall = event.headers['x-netlify-internal-functions'] === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  if (!isScheduledCall && !isDev) {
    console.warn('[cron-reset-credits] Unauthorized call attempt');
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users whose credits need resetting (last_reset_date > 30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: usersNeedingReset, error: queryError } = await supabase
      .from('user_credits')
      .select('email, credits_remaining, last_reset_date')
      .lt('last_reset_date', thirtyDaysAgo.toISOString());

    if (queryError) {
      console.error('[cron-reset-credits] Failed to query users:', queryError);
      throw new Error('Failed to query users for credit reset');
    }

    if (!usersNeedingReset || usersNeedingReset.length === 0) {
      console.log('[cron-reset-credits] No users requiring credit reset');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No users requiring credit reset',
          usersProcessed: 0,
        }),
      };
    }

    console.log(`[cron-reset-credits] Found ${usersNeedingReset.length} users needing credit reset`);

    // Get user information from Supabase auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('[cron-reset-credits] Failed to list auth users:', authError);
      throw new Error('Failed to retrieve user information');
    }

    // Create map for quick email lookup (using email as key now)
    const authUserMap = new Map<string, { email?: string; name: string }>(
      authUsers?.users.map((u): [string, { email?: string; name: string }] => [
        u.email || u.id,
        { email: u.email, name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'User' },
      ]) || []
    );

    let successCount = 0;
    let emailFailCount = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    // Process each user
    for (const userCredit of usersNeedingReset) {
      try {
        const email = userCredit.email;
        const authUserInfo = authUserMap.get(email);

        if (!email) {
          console.warn(`[cron-reset-credits] User record missing email, skipping`);
          errors.push({ userId: 'unknown', error: 'Missing email' });
          continue;
        }

        // Reset credits to 15
        const newCredits = 15;
        const { error: updateError } = await supabase
          .from('user_credits')
          .update({
            credits_remaining: newCredits,
            credits_total: newCredits,
            last_reset_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('email', email);

        if (updateError) {
          console.error(`[cron-reset-credits] Failed to reset credits for user ${email}:`, updateError);
          errors.push({ userId: email, error: `Failed to update credits: ${updateError.message}` });
          continue;
        }

        // Log transaction
        const { error: logError } = await supabase.from('credit_transactions').insert({
          email: email,
          feature: 'monthly_reset',
          amount: newCredits - (userCredit.credits_remaining || 0),
          credits_before: userCredit.credits_remaining || 0,
          credits_after: newCredits,
          transaction_type: 'reset',
          metadata: {
            timestamp: new Date().toISOString(),
            reason: 'monthly_credit_reset',
          },
        });

        if (logError) {
          console.warn(`[cron-reset-credits] Failed to log transaction for user ${email}:`, logError);
          // Don't fail the operation
        }

        // Send email notification
        const userName = authUserInfo?.name || email.split('@')[0];
        const emailResult = await sendCreditsRefreshedEmail(email, userName, newCredits, 'en');

        if (!emailResult.success) {
          console.warn(`[cron-reset-credits] Failed to send email for user ${email}:`, emailResult.error);
          emailFailCount++;
        }

        successCount++;
        console.log(`[cron-reset-credits] Reset credits for user ${email}. Email sent: ${emailResult.success}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[cron-reset-credits] Error processing user:`, errorMsg);
        errors.push({ userId: userCredit.email, error: errorMsg });
      }
    }

    console.log(`[cron-reset-credits] Completed: ${successCount} users processed, ${emailFailCount} email failures, ${errors.length} errors`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Credit reset completed',
        usersProcessed: successCount,
        emailFailures: emailFailCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
    };
  } catch (error) {
    console.error('[cron-reset-credits] Unexpected error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process credit reset',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

export { handler };
