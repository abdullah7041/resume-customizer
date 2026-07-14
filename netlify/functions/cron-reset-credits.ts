/**
 * Netlify Scheduled Function: Reset Monthly Credits
 * Triggered: Daily at 2 AM GMT+3
 *
 * Purpose:
 * - Find users whose credit reset date was >30 days ago
 * - Reset their credits to FREE_TIER_CREDITS (shared with signup grant in credit-manager)
 * - Send "Credits Refreshed" email notification
 * - Log transaction
 */

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { FREE_TIER_CREDITS } from '../lib/credit-manager.js';
import { requireScheduledFunctionGate } from '../lib/admin-gates.js';
import { batchWithConcurrency, RateLimiter } from '../lib/rate-limiter.js';
import { sendCreditsRefreshedEmail } from '../lib/email-service.js';
import { redactForLog, summarizeErrorForLog } from '../lib/sentry.js';

const emailRateLimiter = new RateLimiter({
  maxConcurrent: 1,
  minDelayBetweenRequestsMs: 500,
  maxRequestsPerMinute: 120,
});

const handler: Handler = async (event) => {
  console.log('[cron-reset-credits] Starting scheduled credit reset...');

  const gate = requireScheduledFunctionGate(event);
  if (gate.ok === false) {
    console.warn('[cron-reset-credits] Unauthorized call attempt');
    return {
      statusCode: gate.statusCode,
      body: JSON.stringify({ error: gate.error }),
    };
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
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
      console.error('[cron-reset-credits] Failed to query users:', summarizeErrorForLog(queryError));
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
      console.error('[cron-reset-credits] Failed to list auth users:', summarizeErrorForLog(authError));
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

    // Process users a few at a time — each user's update → log → email chain
    // must stay in order, but users are independent of each other. Concurrency
    // stays low because the email step is Resend-rate-limited (~2 req/s).
    await batchWithConcurrency(usersNeedingReset, async (userCredit) => {
      try {
        const email = userCredit.email;
        const authUserInfo = authUserMap.get(email);

        if (!email) {
          console.warn(`[cron-reset-credits] User record missing email, skipping`);
          errors.push({ userId: 'unknown', error: 'Missing email' });
          return;
        }

        // Reset to the free-tier allowance — must always match the signup grant
        const newCredits = FREE_TIER_CREDITS;
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
          console.error(`[cron-reset-credits] Failed to reset credits for user ${redactForLog(email)}:`, summarizeErrorForLog(updateError));
          errors.push({ userId: email, error: `Failed to update credits: ${updateError.message}` });
          return;
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
          console.warn(`[cron-reset-credits] Failed to log transaction for user ${redactForLog(email)}:`, summarizeErrorForLog(logError));
          // Don't fail the operation
        }

        // Send email notification
        const userName = authUserInfo?.name || email.split('@')[0];
        const emailResult = await sendCreditsRefreshedEmail(email, userName, newCredits, 'en');

        if (!emailResult.success) {
          console.warn(`[cron-reset-credits] Failed to send email for user ${redactForLog(email)}:`, redactForLog(emailResult.error));
          emailFailCount++;
        }

        successCount++;
        console.log(`[cron-reset-credits] Reset credits for user ${redactForLog(email)}. Email sent: ${emailResult.success}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[cron-reset-credits] Error processing user:`, errorMsg);
        errors.push({ userId: userCredit.email, error: errorMsg });
      }
    }, { concurrency: 2, rateLimiter: emailRateLimiter });

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
    console.error('[cron-reset-credits] Unexpected error:', summarizeErrorForLog(error));

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
