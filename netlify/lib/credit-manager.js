/**
 * Credit Management System
 * Handles credit balance checks, consumption, and transaction logging
 */

import { createClient } from '@supabase/supabase-js';
import { redactForLog, summarizeErrorForLog } from './sentry.js';

// Free-tier allowance. Signup grant AND monthly cron reset MUST use this —
// they drifted once (signup 20 vs cron reset 15). Single source of truth.
export const FREE_TIER_CREDITS = 20;
export const SUSPICIOUS_IP_CREDITS = 5;

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
 * True when the Supabase auth user has a confirmed email.
 * Supabase sets email_confirmed_at to an ISO string on confirmation;
 * it is undefined/null otherwise.
 */
export function isEmailVerified(user) {
  return Boolean(user?.email_confirmed_at);
}

/**
 * Initialize Supabase client with service role
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('[CreditManager] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Check if IP has too many accounts (anti-abuse)
 * @param {string} ipAddress - User's IP address
 * @returns {Promise<boolean>} - True if IP is suspicious
 */
async function checkIPAbuse(ipAddress) {
  if (!ipAddress) return false; // No IP tracking = allow

  const supabase = getSupabaseClient();

  // Count accounts from this IP in last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('user_credits')
    .select('email', { count: 'exact', head: true })
    .contains('signup_metadata', { ip_address: ipAddress })
    .gte('created_at', oneDayAgo);

  if (error) {
    console.warn('[CreditManager] IP check failed:', summarizeErrorForLog(error));
    return false; // Fail open (allow if check fails)
  }

  const accountsFromIP = count || 0;
  // Threshold 10 (was 3): carrier CGNAT means many legit users share an IP —
  // 3 penalized real signups on launch day. 10 still caps farm abuse at ~200 credits/IP/day (~$0.50 AI cost).
  if (accountsFromIP >= 10) {
    console.warn(`[CreditManager] IP ${ipAddress} has ${accountsFromIP} accounts (suspicious)`);
    return true;
  }

  return false;
}

/**
 * Get user's current credit balance
 * @param {string} userId - User ID
 * @param {Object} options - Additional options
 * @param {string} options.ipAddress - User's IP address for abuse detection
 * @param {boolean} options.emailVerified - Whether user's email is verified
 * @returns {Promise<{credits_remaining: number, credits_total: number, last_reset_date: string} | null>}
 */
export async function getUserCredits(email, options = {}) {
  const { ipAddress, emailVerified = true } = options;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('user_credits')
    .select('credits_remaining, credits_total, feedback_credits_earned, referral_credits_earned, last_reset_date, signup_metadata')
    .eq('email', email)
    .single();

  if (error) {
    // If user doesn't exist, initialize their credits
    if (error.code === 'PGRST116') {
      console.log(`[CreditManager] Initializing credits for user ${redactForLog(email)}`);

      // ANTI-ABUSE CHECKS

      // Check 1: Email must be verified
      if (!emailVerified) {
        console.warn(`[CreditManager] Email not verified for ${redactForLog(email)} - giving 0 credits`);
        const { data: newCredits, error: insertError } = await supabase
          .from('user_credits')
          .insert({
            email: email,
            credits_remaining: 0, // No credits until verified
            credits_total: 0,
            feedback_credits_earned: 0,
            referral_credits_earned: 0,
            last_reset_date: new Date().toISOString(),
            signup_metadata: {
              ip_address: ipAddress,
              email_verified: false,
              created_at: new Date().toISOString()
            },
          })
          .select()
          .single();

        if (insertError) {
          console.error('[CreditManager] Failed to initialize credits:', summarizeErrorForLog(insertError));
          throw new Error('Failed to initialize user credits');
        }

        return newCredits;
      }

      // Check 2: IP abuse detection
      const isIPSuspicious = await checkIPAbuse(ipAddress);
      const creditsToGive = isIPSuspicious ? SUSPICIOUS_IP_CREDITS : FREE_TIER_CREDITS; // Reduced credits for suspicious IPs

      if (isIPSuspicious) {
        console.warn(`[CreditManager] Suspicious IP detected for ${redactForLog(email)} - giving ${creditsToGive} credits instead of ${FREE_TIER_CREDITS}`);
      }

      const { data: newCredits, error: insertError } = await supabase
        .from('user_credits')
        .insert({
          email: email,
          credits_remaining: creditsToGive,
          credits_total: creditsToGive,
          feedback_credits_earned: 0,
          referral_credits_earned: 0,
          last_reset_date: new Date().toISOString(),
          signup_metadata: {
            ip_address: ipAddress,
            email_verified: emailVerified,
            is_suspicious: isIPSuspicious,
            created_at: new Date().toISOString()
          },
        })
        .select()
        .single();

      if (insertError) {
        console.error('[CreditManager] Failed to initialize credits:', summarizeErrorForLog(insertError));
        throw new Error('Failed to initialize user credits');
      }

      return newCredits;
    }

    console.error('[CreditManager] Failed to get user credits:', summarizeErrorForLog(error));
    throw new Error('Failed to retrieve user credits');
  }

  return data;
}

/**
 * Check if user has sufficient credits for a feature
 * @param {string} userId - User ID
 * @param {keyof typeof FEATURE_COSTS} feature - Feature name
 * @param {Object} options - Optional parameters for user initialization
 * @param {string} options.ipAddress - User's IP address (for anti-abuse on first call)
 * @param {boolean} options.emailVerified - Whether user's email is verified (for anti-abuse on first call)
 * @returns {Promise<{hasCredits: boolean, required: number, available: number}>}
 */
export async function checkCredits(email, feature, options = {}) {
  const requiredCredits = FEATURE_COSTS[feature];

  if (requiredCredits === undefined) {
    throw new Error(`Unknown feature: ${feature}`);
  }

  // Free features always pass
  if (requiredCredits === 0) {
    return { hasCredits: true, required: 0, available: 0 };
  }

  const credits = await getUserCredits(email, options);
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
export async function consumeCredits(email, feature, amount = null) {
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
  const check = await checkCredits(email, feature);
  if (!check.hasCredits) {
    console.warn(`[CreditManager] Insufficient credits for ${feature}. Required: ${check.required}, Available: ${check.available}`);
    return { success: false, creditsRemaining: check.available };
  }

  const creditsBefore = check.available;
  const creditsAfter = creditsBefore - creditsToConsume;

  // 2. Atomic update using RPC (Postgres function) - More reliable than client-side subtraction
  const { error: updateError } = await supabase.rpc('consume_user_credits', {
    p_email: email,
    p_amount: creditsToConsume,
  });

  // Fallback to direct update if RPC doesn't exist yet
  if (updateError && updateError.code === '42883') {
    console.log('[CreditManager] RPC not found, using direct update');
    const { data: directUpdateRows, error: directUpdateError } = await supabase
      .from('user_credits')
      .update({
        credits_remaining: creditsAfter,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email)
      .eq('credits_remaining', creditsBefore) // Optimistic locking
      .select('credits_remaining');

    if (directUpdateError) {
      console.error('[CreditManager] Failed to consume credits:', summarizeErrorForLog(directUpdateError));
      throw new Error('Failed to consume credits');
    }
    if (!directUpdateRows || directUpdateRows.length === 0) {
      console.warn(`[CreditManager] Optimistic lock lost for ${feature} - balance changed concurrently, no deduction applied`);
      return { success: false, creditsRemaining: creditsBefore };
    }
  } else if (updateError) {
    console.error('[CreditManager] Failed to consume credits:', summarizeErrorForLog(updateError));
    throw new Error('Failed to consume credits');
  }

  // 3. Log transaction (fire-and-forget to avoid blocking response)
  // Note: Supabase query builder returns PromiseLike (no .catch), so wrap with Promise.resolve
  Promise.resolve(
    supabase
      .from('credit_transactions')
      .insert({
        email: email,
        feature,
        amount: -creditsToConsume,
        credits_before: creditsBefore,
        credits_after: creditsAfter,
        transaction_type: 'consumption',
        metadata: {
          timestamp: new Date().toISOString(),
        },
      })
  ).catch((logError) => {
    console.error('[CreditManager] Failed to log transaction:', summarizeErrorForLog(logError));
    // Non-blocking: transaction logging failure doesn't affect credit consumption
  });

  console.log(`[CreditManager] Consumed ${creditsToConsume} credits for ${feature}. Balance: ${creditsBefore} → ${creditsAfter}`);

  // Trigger referral completion on first paid action (non-blocking)
  if (creditsToConsume > 0) {
    try {
      const { completeReferral } = await import('./referral-manager.js');
      const result = await completeReferral(email);

      if (result.completed) {
        console.log(`[CreditManager] Referral completed. Awarded ${result.referrerReward} + ${result.refereeReward} credits`);
      }
    } catch (error) {
      console.warn('[CreditManager] Referral completion failed (non-blocking):', summarizeErrorForLog(error));
    }
  }

  return { success: true, creditsRemaining: creditsAfter };
}

/**
 * Add credits to user (for referrals, feedback, etc.)
 * @param {string} userId - User ID
 * @param {number} amount - Credits to add
 * @param {'referral_reward' | 'feedback_reward' | 'monthly_reset' | 'refund'} type - Transaction type
 * @param {object} [metadata] - Optional metadata
 * @returns {Promise<{success: boolean, creditsRemaining: number}>}
 */
export async function addCredits(email, amount, type, metadata = {}) {
  const supabase = getSupabaseClient();

  // Get current balance
  const credits = await getUserCredits(email);
  const creditsBefore = credits?.credits_remaining || 0;
  const creditsAfter = creditsBefore + amount;

  // Update balance
  const { error: updateError } = await supabase
    .from('user_credits')
    .update({
      credits_remaining: creditsAfter,
      updated_at: new Date().toISOString(),
    })
    .eq('email', email);

  if (updateError) {
    console.error('[CreditManager] Failed to add credits:', summarizeErrorForLog(updateError));
    throw new Error('Failed to add credits');
  }

  // Log transaction
  const { error: logError } = await supabase
    .from('credit_transactions')
    .insert({
      email: email,
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
    console.error('[CreditManager] Failed to log credit addition:', summarizeErrorForLog(logError));
  }

  console.log(`[CreditManager] Added ${amount} credits (${type}). Balance: ${creditsBefore} → ${creditsAfter}`);

  return { success: true, creditsRemaining: creditsAfter };
}

