/**
 * DEV ONLY: Celebration Bonus Credits
 *
 * Give bonus credits to all users for special occasions (National Day, Eid, etc.)
 * IMPORTANT: Only enable in development/staging or set ALLOW_CELEBRATION_BONUS=true
 *
 * Usage:
 * POST /.netlify/functions/dev-celebration-bonus
 * Body: { "amount": 10, "reason": "Saudi National Day 2026" }
 *
 * Example:
 * curl -X POST https://your-site.netlify.app/.netlify/functions/dev-celebration-bonus \
 *   -H "Content-Type: application/json" \
 *   -d '{"amount": 10, "reason": "Eid Al-Fitr 2026"}'
 */

import { Handler } from '@netlify/functions';
import { requireAdminMutationGate } from '../lib/admin-gates.js';
import { getSupabaseClient } from '../lib/supabase-client.js';

const handler: Handler = async (event) => {
  const gate = requireAdminMutationGate(event, 'ALLOW_CELEBRATION_BONUS');
  if (gate.ok === false) {
    return {
      statusCode: gate.statusCode,
      body: JSON.stringify({ error: gate.error }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' }),
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Database connection failed' }),
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { amount, reason } = body;

    // Validate inputs
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid amount. Must be a positive number.' }),
      };
    }

    if (!reason || typeof reason !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Reason is required (e.g., "National Day 2026")' }),
      };
    }

    console.log(`[CelebrationBonus] Adding ${amount} credits to all users. Reason: ${reason}`);

    // Get all active users
    const { data: users, error: fetchError } = await supabase
      .from('user_credits')
      .select('email, credits_remaining')
      .not('email', 'is', null); // Ensure emails exist

    if (fetchError) {
      throw fetchError;
    }

    if (!users || users.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No users found',
          usersUpdated: 0,
        }),
      };
    }

    // Update all users' credits
    const updates = users.map((user) => ({
      email: user.email,
      credits_remaining: user.credits_remaining + amount,
      updated_at: new Date().toISOString(),
    }));

    const { error: updateError } = await supabase
      .from('user_credits')
      .upsert(updates);

    if (updateError) {
      throw updateError;
    }

    // Log transactions for each user
    const transactions = users.map((user) => ({
      email: user.email,
      feature: 'celebration_bonus',
      amount,
      credits_before: user.credits_remaining,
      credits_after: user.credits_remaining + amount,
      transaction_type: 'celebration_bonus',
      metadata: {
        reason,
        timestamp: new Date().toISOString(),
      },
    }));

    const { error: logError } = await supabase
      .from('credit_transactions')
      .insert(transactions);

    if (logError) {
      console.warn('[CelebrationBonus] Failed to log some transactions:', logError);
      // Don't fail the operation if logging fails
    }

    console.log(`[CelebrationBonus] Successfully added ${amount} credits to ${users.length} users`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Added ${amount} credits to ${users.length} users`,
        usersUpdated: users.length,
        creditsAdded: amount,
        reason,
        totalCreditsDistributed: amount * users.length,
      }),
    };
  } catch (error) {
    console.error('[CelebrationBonus] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to add celebration bonus credits',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

export { handler };
