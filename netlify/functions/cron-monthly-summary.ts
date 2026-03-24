/**
 * Netlify Scheduled Function: Send Monthly Usage Summary
 * Triggered: 28th of each month at 10 AM GMT+3
 *
 * Purpose:
 * - Calculate usage statistics for each user for the past month
 * - Generate breakdown by feature
 * - Send "Monthly Usage Summary" email notification
 */

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { sendMonthlyUsageSummary } from '../lib/email-service.js';

interface UserStats {
  totalUsed: number;
  remaining: number;
  totalActions: number;
  usagePercentage: number;
  nextResetDate: string;
  breakdown: Record<string, { count: number; credits: number }>;
}

const handler: Handler = async (event) => {
  console.log('[cron-monthly-summary] Starting scheduled monthly summary...');

  // Scheduled functions should only be called from Netlify's internal scheduler
  const isScheduledCall = event.headers['x-netlify-internal-functions'] === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  if (!isScheduledCall && !isDev) {
    console.warn('[cron-monthly-summary] Unauthorized call attempt');
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

    // Get all active users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('[cron-monthly-summary] Failed to list auth users:', authError);
      throw new Error('Failed to retrieve user information');
    }

    if (!authUsers || authUsers.users.length === 0) {
      console.log('[cron-monthly-summary] No users found');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No users to process',
          usersProcessed: 0,
        }),
      };
    }

    // Get user credits info for all users
    const { data: allUserCredits, error: creditsError } = await supabase.from('user_credits').select('email, credits_total, credits_remaining, last_reset_date');

    if (creditsError) {
      console.error('[cron-monthly-summary] Failed to get user credits:', creditsError);
      throw new Error('Failed to retrieve user credits');
    }

    // Create map for quick lookup
    const creditsMap = new Map((allUserCredits || []).map((c) => [c.email, c]));

    // Calculate the date range for past month (since last_reset_date)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get transactions for past 30 days
    const { data: recentTransactions, error: transError } = await supabase
      .from('credit_transactions')
      .select('email, feature, amount, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (transError) {
      console.error('[cron-monthly-summary] Failed to get transactions:', transError);
      throw new Error('Failed to retrieve transaction history');
    }

    // Build usage stats by user
    const userStatsMap = new Map<string, UserStats>();

    for (const user of authUsers.users) {
      const userEmail = user.email;
      if (!userEmail) continue;

      const userCredits = creditsMap.get(userEmail);
      if (!userCredits) {
        console.warn(`[cron-monthly-summary] User ${userEmail} has no credits record`);
        continue;
      }

      // Filter transactions for this user from past month
      const userTransactions = (recentTransactions || []).filter(
        (t) => t.email === userEmail && t.created_at && new Date(t.created_at) >= thirtyDaysAgo
      );

      // Calculate stats
      const totalUsed = userTransactions
        .filter((t) => (t.amount as number) < 0) // Negative amounts are consumption
        .reduce((sum, t) => sum + Math.abs(t.amount as number), 0);

      const totalActions = userTransactions.length;
      const usagePercentage = userCredits.credits_total > 0 ? totalUsed / userCredits.credits_total : 0;

      // Build breakdown by feature
      const breakdown: Record<string, { count: number; credits: number }> = {};
      for (const transaction of userTransactions) {
        const feature = (transaction.feature as string) || 'unknown';
        if (!breakdown[feature]) {
          breakdown[feature] = { count: 0, credits: 0 };
        }
        breakdown[feature].count += 1;
        if (typeof transaction.amount === 'number' && transaction.amount < 0) {
          breakdown[feature].credits += Math.abs(transaction.amount);
        }
      }

      // Calculate next reset date (30 days from last reset)
      const lastResetDate = new Date(userCredits.last_reset_date);
      const nextResetDate = new Date(lastResetDate);
      nextResetDate.setDate(nextResetDate.getDate() + 30);

      const stats: UserStats = {
        totalUsed,
        remaining: userCredits.credits_remaining,
        totalActions,
        usagePercentage,
        nextResetDate: nextResetDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        breakdown,
      };

      userStatsMap.set(userEmail, stats);
    }

    console.log(`[cron-monthly-summary] Calculated stats for ${userStatsMap.size} users`);

    let successCount = 0;
    let emailFailCount = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    // Send emails to each user
    for (const user of authUsers.users) {
      try {
        const userEmail = user.email;
        if (!userEmail) {
          console.warn(`[cron-monthly-summary] User has no email, skipping`);
          errors.push({ userId: user.id, error: 'User has no email' });
          continue;
        }

        const userName = user.user_metadata?.full_name || userEmail.split('@')[0] || 'User';
        const stats = userStatsMap.get(userEmail);

        if (!stats) {
          console.warn(`[cron-monthly-summary] No stats found for user ${userEmail}, using empty stats`);
        }

        // Send email
        const emailResult = await sendMonthlyUsageSummary(
          userEmail,
          userName,
          stats || {
            totalUsed: 0,
            remaining: 0,
            totalActions: 0,
            usagePercentage: 0,
            nextResetDate: 'next month',
            breakdown: {},
          },
          'en'
        );

        if (!emailResult.success) {
          console.warn(`[cron-monthly-summary] Failed to send email for user ${userEmail}:`, emailResult.error);
          emailFailCount++;
        }

        successCount++;
        console.log(`[cron-monthly-summary] Sent summary email to user ${userEmail}. Success: ${emailResult.success}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[cron-monthly-summary] Error processing user:`, errorMsg);
        errors.push({ userId: user.id, error: errorMsg });
      }
    }

    console.log(`[cron-monthly-summary] Completed: ${successCount} users processed, ${emailFailCount} email failures`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Monthly summary emails sent',
        usersProcessed: successCount,
        emailFailures: emailFailCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
    };
  } catch (error) {
    console.error('[cron-monthly-summary] Unexpected error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send monthly summaries',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

export { handler };
