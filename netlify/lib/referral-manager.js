/**
 * Referral Management System
 *
 * Handles referral tracking, completion, and reward distribution.
 * Rewards: 5 credits to referrer + 5 credits to referee on first paid action.
 * Uses user_credits table columns: referred_by_user_id, referral_completed, referral_completed_at
 */

import { createClient } from '@supabase/supabase-js';
import { addCredits } from './credit-manager.js';
import { redactForLog } from './sentry.js';

const REFERRER_REWARD = 5;
const REFEREE_REWARD = 5;
const MISSING_CONFIG_ERROR = '[ReferralManager] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY';
const REFERRAL_EMAIL_RECIPIENT_NAME = 'Watheq user';
const REFERRAL_COUNTERPART_NAME = 'a Watheq user';

function isMissingConfigError(error) {
  return error instanceof Error && error.message === MISSING_CONFIG_ERROR;
}

function summarizeErrorForLog(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactForLog(error.message)
    };
  }

  return redactForLog(error);
}

/**
 * Get Supabase client for referral operations
 */
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(MISSING_CONFIG_ERROR);
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Track a referral relationship when a new user signs up with a referral code.
 * Awards credits immediately to both referrer and referee.
 *
 * @param {string} referrerCode - The referral code (format: USR-XXXXX)
 * @param {string} refereeEmail - Email of the new user being referred
 * @param {string} refereeUserId - Auth user ID of the new user being referred
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function trackReferral(referrerCode, refereeEmail, refereeUserId) {
  try {
    const supabase = getSupabaseClient();

    if (!refereeUserId) {
      return { success: false, error: 'Missing referee user ID' };
    }

    // Find referrer by code
    const { data: referrerData, error: referrerError } = await supabase
      .from('user_credits')
      .select('email, user_id')
      .eq('referral_code', referrerCode)
      .single();

    if (referrerError || !referrerData?.user_id) {
      console.warn('[ReferralManager] Invalid referral code');
      return { success: false, error: 'Invalid referral code' };
    }

    const referrerEmail = referrerData.email;
    const referrerUserId = referrerData.user_id;

    if (referrerEmail === refereeEmail || referrerUserId === refereeUserId) {
      console.warn('[ReferralManager] Self-referral blocked');
      return { success: false, error: 'Cannot use your own referral code' };
    }

    // Atomically claim the referral relationship. Rewards are only paid when this
    // conditional write returns the referee row, preventing retry/double-award races.
    const { data: trackedReferral, error: updateError } = await supabase
      .from('user_credits')
      .update({
        referred_by_user_id: referrerUserId,
        referral_completed: true,
        referral_completed_at: new Date().toISOString()
      })
      .eq('user_id', refereeUserId)
      .is('referred_by_user_id', null)
      .is('referred_by_email', null)
      .select('email')
      .maybeSingle();

    if (updateError) {
      console.error('[ReferralManager] Failed to track referral:', summarizeErrorForLog(updateError));
      return { success: false, error: 'Failed to track referral' };
    }

    if (!trackedReferral) {
      const { data: existingReferral, error: existingReferralError } = await supabase
        .from('user_credits')
        .select('referred_by_user_id, referred_by_email')
        .eq('user_id', refereeUserId)
        .single();

      if (existingReferralError || !existingReferral) {
        console.warn('[ReferralManager] Referee credit record not found');
        return { success: false, error: 'Referral record not found' };
      }

      if (existingReferral.referred_by_user_id || existingReferral.referred_by_email) {
        console.warn('[ReferralManager] User already has a referrer');
        return { success: false, error: 'Already referred by another user' };
      }

      console.warn('[ReferralManager] Referral was not tracked');
      return { success: false, error: 'Failed to track referral' };
    }

    console.log(`[ReferralManager] Tracked referral: ${redactForLog(referrerEmail)} -> ${redactForLog(refereeEmail)}`);

    // Award credits to referrer using credit-manager (avoids RPC migration dependency)
    try {
      await addCredits(referrerEmail, REFERRER_REWARD, 'referral_reward', {
        description: 'Referral bonus: new user signed up',
        referee_user_id: refereeUserId,
      });
      console.log(`[ReferralManager] Awarded ${REFERRER_REWARD} credits to referrer ${redactForLog(referrerEmail)}`);
    } catch (referrerRewardError) {
      console.error('[ReferralManager] Failed to reward referrer:', summarizeErrorForLog(referrerRewardError));
    }

    // Award credits to referee using credit-manager (avoids RPC migration dependency)
    try {
      await addCredits(refereeEmail, REFEREE_REWARD, 'referral_reward', {
        description: 'Referral bonus: welcome reward',
        referrer_user_id: referrerUserId,
      });
      console.log(`[ReferralManager] Awarded ${REFEREE_REWARD} credits to referee ${redactForLog(refereeEmail)}`);
    } catch (refereeRewardError) {
      console.error('[ReferralManager] Failed to reward referee:', summarizeErrorForLog(refereeRewardError));
    }

    // Send email notifications (non-blocking)
    try {
      const { sendReferralRewardReferrer, sendReferralRewardReferee } = await import('./email-service.js');

      // Send email to referrer
      sendReferralRewardReferrer(referrerEmail, REFERRAL_EMAIL_RECIPIENT_NAME, REFERRAL_COUNTERPART_NAME, 'en').catch(err => {
        console.warn('[ReferralManager] Failed to send referrer email:', summarizeErrorForLog(err));
      });

      // Send email to referee
      sendReferralRewardReferee(refereeEmail, REFERRAL_EMAIL_RECIPIENT_NAME, REFERRAL_COUNTERPART_NAME, 'en').catch(err => {
        console.warn('[ReferralManager] Failed to send referee email:', summarizeErrorForLog(err));
      });
    } catch (emailError) {
      console.warn('[ReferralManager] Email service unavailable:', summarizeErrorForLog(emailError));
    }

    return { success: true };
  } catch (error) {
    if (isMissingConfigError(error)) {
      throw error;
    }

    console.error('[ReferralManager] trackReferral error:', summarizeErrorForLog(error));
    return { success: false, error: error.message };
  }
}

/**
 * Complete a referral when the referee performs their first paid action.
 * Awards credits to both referrer and referee and sends email notifications.
 *
 * @param {string} refereeEmail - Email of the referee who performed the action
 * @returns {Promise<{completed: boolean, referrerReward?: number, refereeReward?: number, error?: string}>}
 */
export async function completeReferral(refereeEmail) {
  try {
    const supabase = getSupabaseClient();

    const reopenClaimForRetry = async () => {
      const { error: reopenError } = await supabase
        .from('user_credits')
        .update({
          referral_completed: false,
          referral_completed_at: null
        })
        .eq('email', refereeEmail);

      if (reopenError) {
        console.error('[ReferralManager] Failed to reopen referral completion after reward failure:', summarizeErrorForLog(reopenError));
      }
    };

    // Atomically claim completion. Rewards are only paid when this conditional
    // write returns the row, preventing concurrent double-award races.
    const { data: claimed, error: claimError } = await supabase
      .from('user_credits')
      .update({
        referral_completed: true,
        referral_completed_at: new Date().toISOString()
      })
      .eq('email', refereeEmail)
      .eq('referral_completed', false)
      .not('referred_by_user_id', 'is', null)
      .select('referred_by_user_id')
      .maybeSingle();

    if (claimError) {
      console.error('[ReferralManager] Failed to claim referral completion:', summarizeErrorForLog(claimError));
      return { completed: false, error: 'Failed to claim completion' };
    }

    if (!claimed) {
      return { completed: false };
    }

    const referrerUserId = claimed.referred_by_user_id;

    const { data: referrerData, error: referrerFetchError } = await supabase
      .from('user_credits')
      .select('email')
      .eq('user_id', referrerUserId)
      .single();

    if (referrerFetchError || !referrerData?.email) {
      console.error('[ReferralManager] Failed to resolve referrer:', summarizeErrorForLog(referrerFetchError));
      return { completed: false, error: 'Failed to resolve referrer' };
    }

    const referrerEmail = referrerData.email;

    console.log(`[ReferralManager] Completing referral for referee ${redactForLog(refereeEmail)}`);

    // Award credits to referrer
    const { error: referrerError } = await supabase.rpc('add_credits', {
      p_email: referrerEmail,
      p_amount: REFERRER_REWARD,
      p_description: `Referral bonus: friend completed first action`,
      p_transaction_type: 'referral_reward'
    });

    if (referrerError) {
      console.error('[ReferralManager] Failed to reward referrer:', summarizeErrorForLog(referrerError));
      await reopenClaimForRetry();
      return { completed: false, error: 'Reward payment failed; referral can be retried' };
    }

    // Award credits to referee
    const { error: refereeError } = await supabase.rpc('add_credits', {
      p_email: refereeEmail,
      p_amount: REFEREE_REWARD,
      p_description: `Referral bonus: welcome reward`,
      p_transaction_type: 'referral_reward'
    });

    if (refereeError) {
      console.error('[ReferralManager] Failed to reward referee:', summarizeErrorForLog(refereeError));
      return { completed: false, error: 'Reward payment failed after claim' };
    }

    console.log(`[ReferralManager] Referral completed: ${redactForLog(referrerEmail)} (+${REFERRER_REWARD}) and ${redactForLog(refereeEmail)} (+${REFEREE_REWARD})`);

    // Send email notifications (non-blocking)
    try {
      const { sendReferralRewardReferrer, sendReferralRewardReferee } = await import('./email-service.js');

      // Send email to referrer
      sendReferralRewardReferrer(referrerEmail, REFERRAL_EMAIL_RECIPIENT_NAME, REFERRAL_COUNTERPART_NAME, 'en').catch(err => {
        console.warn('[ReferralManager] Failed to send referrer email:', summarizeErrorForLog(err));
      });

      // Send email to referee
      sendReferralRewardReferee(refereeEmail, REFERRAL_EMAIL_RECIPIENT_NAME, REFERRAL_COUNTERPART_NAME, 'en').catch(err => {
        console.warn('[ReferralManager] Failed to send referee email:', summarizeErrorForLog(err));
      });
    } catch (emailError) {
      console.warn('[ReferralManager] Email service unavailable:', summarizeErrorForLog(emailError));
      // Don't fail the entire operation if emails fail
    }

    return {
      completed: true,
      referrerReward: REFERRER_REWARD,
      refereeReward: REFEREE_REWARD
    };
  } catch (error) {
    if (isMissingConfigError(error)) {
      throw error;
    }

    console.error('[ReferralManager] completeReferral error:', summarizeErrorForLog(error));
    return { completed: false, error: error.message };
  }
}

/**
 * Get referral statistics for a user.
 *
 * @param {string} userId - Auth user ID of the user
 * @returns {Promise<{total: number, completed: number, pending: number, creditsEarned: number}>}
 */
export async function getReferralStats(userId) {
  try {
    const supabase = getSupabaseClient();

    // Count referrals by status
    const { data, error } = await supabase
      .from('user_credits')
      .select('referral_completed')
      .eq('referred_by_user_id', userId);

    if (error) {
      console.error('[ReferralManager] Failed to fetch stats:', summarizeErrorForLog(error));
      return { total: 0, completed: 0, pending: 0, creditsEarned: 0 };
    }

    const total = data.length;
    const completed = data.filter(r => r.referral_completed).length;
    const pending = total - completed;
    const creditsEarned = completed * REFERRER_REWARD;

    return { total, completed, pending, creditsEarned };
  } catch (error) {
    if (isMissingConfigError(error)) {
      throw error;
    }

    console.error('[ReferralManager] getReferralStats error:', summarizeErrorForLog(error));
    return { total: 0, completed: 0, pending: 0, creditsEarned: 0 };
  }
}
