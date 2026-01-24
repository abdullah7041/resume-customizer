/**
 * Credit Management System
 * Handles credit balance checks, consumption, and transaction logging
 */

import { createClient } from '@supabase/supabase-js';

// Feature pricing (in credits)
export const FEATURE_COSTS = {
  parse_resume: 0,        // FREE
  ai_match: 2,            // Match analysis
  vision2030: 2,          // Vision 2030 alignment
  optimize: 5,            // Resume optimization
  interview_prep: 3,      // Interview questions
  cover_letter: 4,        // Cover letter generation
  export_template: 0,     // FREE
};

/**
 * Initialize Supabase client with service role
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Get user's current credit balance
 * @param {string} userId - User ID
 * @returns {Promise<{credits_remaining: number, credits_total: number, last_reset_date: string} | null>}
 */
export async function getUserCredits(userId) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('user_credits')
    .select('credits_remaining, credits_total, feedback_credits_earned, referral_credits_earned, last_reset_date')
    .eq('user_id', userId)
    .single();

  if (error) {
    // If user doesn't exist, initialize their credits
    if (error.code === 'PGRST116') {
      console.log(`[CreditManager] Initializing credits for user ${userId}`);
      const { data: newCredits, error: insertError } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          credits_remaining: 15,
          credits_total: 15,
          feedback_credits_earned: 0,
          referral_credits_earned: 0,
          last_reset_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('[CreditManager] Failed to initialize credits:', insertError);
        throw new Error('Failed to initialize user credits');
      }

      return newCredits;
    }

    console.error('[CreditManager] Failed to get user credits:', error);
    throw new Error('Failed to retrieve user credits');
  }

  return data;
}

/**
 * Check if user has sufficient credits for a feature
 * @param {string} userId - User ID
 * @param {keyof typeof FEATURE_COSTS} feature - Feature name
 * @returns {Promise<{hasCredits: boolean, required: number, available: number}>}
 */
export async function checkCredits(userId, feature) {
  const requiredCredits = FEATURE_COSTS[feature];

  if (requiredCredits === undefined) {
    throw new Error(`Unknown feature: ${feature}`);
  }

  // Free features always pass
  if (requiredCredits === 0) {
    return { hasCredits: true, required: 0, available: 0 };
  }

  const credits = await getUserCredits(userId);
  const available = credits?.credits_remaining || 0;

  return {
    hasCredits: available >= requiredCredits,
    required: requiredCredits,
    available,
  };
}

/**
 * Consume credits for a feature (atomic operation)
 * @param {string} userId - User ID
 * @param {keyof typeof FEATURE_COSTS} feature - Feature name
 * @param {number} [amount] - Optional custom amount (defaults to FEATURE_COSTS[feature])
 * @returns {Promise<{success: boolean, creditsRemaining: number}>}
 */
export async function consumeCredits(userId, feature, amount = null) {
  const supabase = getSupabaseClient();
  const creditsToConsume = amount !== null ? amount : FEATURE_COSTS[feature];

  if (creditsToConsume === undefined) {
    throw new Error(`Unknown feature: ${feature}`);
  }

  // Skip for free features
  if (creditsToConsume === 0) {
    console.log(`[CreditManager] Feature ${feature} is free, skipping credit consumption`);
    return { success: true, creditsRemaining: 0 };
  }

  // 1. Check current balance
  const check = await checkCredits(userId, feature);
  if (!check.hasCredits) {
    console.warn(`[CreditManager] Insufficient credits for ${feature}. Required: ${check.required}, Available: ${check.available}`);
    return { success: false, creditsRemaining: check.available };
  }

  const creditsBefore = check.available;
  const creditsAfter = creditsBefore - creditsToConsume;

  // 2. Atomic update using RPC (Postgres function) - More reliable than client-side subtraction
  const { error: updateError } = await supabase.rpc('consume_user_credits', {
    p_user_id: userId,
    p_amount: creditsToConsume,
  });

  // Fallback to direct update if RPC doesn't exist yet
  if (updateError && updateError.code === '42883') {
    console.log('[CreditManager] RPC not found, using direct update');
    const { error: directUpdateError } = await supabase
      .from('user_credits')
      .update({
        credits_remaining: creditsAfter,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('credits_remaining', creditsBefore); // Optimistic locking

    if (directUpdateError) {
      console.error('[CreditManager] Failed to consume credits:', directUpdateError);
      throw new Error('Failed to consume credits');
    }
  } else if (updateError) {
    console.error('[CreditManager] Failed to consume credits:', updateError);
    throw new Error('Failed to consume credits');
  }

  // 3. Log transaction
  const { error: logError } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      feature,
      amount: -creditsToConsume,
      credits_before: creditsBefore,
      credits_after: creditsAfter,
      transaction_type: 'consumption',
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

  if (logError) {
    console.error('[CreditManager] Failed to log transaction:', logError);
    // Don't fail the operation if logging fails
  }

  console.log(`[CreditManager] Consumed ${creditsToConsume} credits for ${feature}. Balance: ${creditsBefore} → ${creditsAfter}`);

  return { success: true, creditsRemaining: creditsAfter };
}

/**
 * Add credits to user (for referrals, feedback, etc.)
 * @param {string} userId - User ID
 * @param {number} amount - Credits to add
 * @param {'referral_reward' | 'feedback_reward' | 'monthly_reset'} type - Transaction type
 * @param {object} [metadata] - Optional metadata
 * @returns {Promise<{success: boolean, creditsRemaining: number}>}
 */
export async function addCredits(userId, amount, type, metadata = {}) {
  const supabase = getSupabaseClient();

  // Get current balance
  const credits = await getUserCredits(userId);
  const creditsBefore = credits?.credits_remaining || 0;
  const creditsAfter = creditsBefore + amount;

  // Update balance
  const { error: updateError } = await supabase
    .from('user_credits')
    .update({
      credits_remaining: creditsAfter,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('[CreditManager] Failed to add credits:', updateError);
    throw new Error('Failed to add credits');
  }

  // Log transaction
  const { error: logError } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      feature: type,
      amount,
      credits_before: creditsBefore,
      credits_after: creditsAfter,
      transaction_type: type,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });

  if (logError) {
    console.error('[CreditManager] Failed to log credit addition:', logError);
  }

  console.log(`[CreditManager] Added ${amount} credits (${type}). Balance: ${creditsBefore} → ${creditsAfter}`);

  return { success: true, creditsRemaining: creditsAfter };
}
