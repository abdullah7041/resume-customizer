/**
 * Referral Management System
 *
 * Handles referral tracking, completion, and reward distribution.
 * Rewards: 5 credits to referrer + 5 credits to referee on first paid action.
 * Uses user_credits table columns: referred_by_user_id, referral_completed, referral_completed_at
 */

import { createClient } from '@supabase/supabase-js';
import { addCredits } from './credit-manager.js';

const REFERRER_REWARD = 5;
const REFEREE_REWARD = 5;

/**
 * Get Supabase client for referral operations
 */
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('[ReferralManager] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
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
 * @param {string} refereeUserId - UUID of the new user being referred
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function trackReferral(referrerCode, refereeUserId) {
  try {
    const supabase = getSupabaseClient();

    // Find referrer by code
    const { data: referrerData, error: referrerError } = await supabase
      .from('user_credits')
      .select('user_id')
      .eq('referral_code', referrerCode)
      .single();

    if (referrerError || !referrerData) {
      console.warn('[ReferralManager] Invalid referral code:', referrerCode);
      return { success: false, error: 'Invalid referral code' };
    }

    const referrerId = referrerData.user_id;

    // Check if referee was already referred
    const { data: existingReferral } = await supabase
      .from('user_credits')
      .select('referred_by_user_id, referral_completed')
      .eq('user_id', refereeUserId)
      .single();

    if (existingReferral?.referred_by_user_id) {
      console.warn('[ReferralManager] User already has a referrer');
      return { success: false, error: 'Already referred by another user' };
    }

    // Update referee's record with referrer relationship
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({
        referred_by_user_id: referrerId,
        referral_completed: true,
        referral_completed_at: new Date().toISOString()
      })
      .eq('user_id', refereeUserId);

    if (updateError) {
      console.error('[ReferralManager] Failed to track referral:', updateError);
      return { success: false, error: 'Failed to track referral' };
    }

    console.log(`[ReferralManager] Tracked referral: ${referrerId} → ${refereeUserId}`);

    // Award credits immediately to both parties
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const referrer = authUsers?.users?.find(u => u.id === referrerId);
    const referee = authUsers?.users?.find(u => u.id === refereeUserId);

    // Award credits to referrer using credit-manager (avoids RPC migration dependency)
    try {
      await addCredits(referrerId, REFERRER_REWARD, 'referral_reward', {
        description: `Referral bonus: ${referee?.email || 'friend'} signed up`,
        referee_email: referee?.email,
      });
      console.log(`[ReferralManager] Awarded ${REFERRER_REWARD} credits to referrer ${referrerId}`);
    } catch (referrerRewardError) {
      console.error('[ReferralManager] Failed to reward referrer:', referrerRewardError);
    }

    // Award credits to referee using credit-manager (avoids RPC migration dependency)
    try {
      await addCredits(refereeUserId, REFEREE_REWARD, 'referral_reward', {
        description: `Referral bonus: welcome reward`,
        referrer_email: referrer?.email,
      });
      console.log(`[ReferralManager] Awarded ${REFEREE_REWARD} credits to referee ${refereeUserId}`);
    } catch (refereeRewardError) {
      console.error('[ReferralManager] Failed to reward referee:', refereeRewardError);
    }

    // Send email notifications (non-blocking)
    try {
      const { sendReferralRewardReferrer, sendReferralRewardReferee } = await import('./email-service.js');

      // Send email to referrer
      if (referrer?.email) {
        const referrerName = referrer.user_metadata?.full_name || referrer.email.split('@')[0];
        const refereeName = referee?.user_metadata?.full_name || referee?.email?.split('@')[0];
        const language = referrer.user_metadata?.language || 'en';

        sendReferralRewardReferrer(referrer.email, referrerName, refereeName, language).catch(err => {
          console.warn('[ReferralManager] Failed to send referrer email:', err);
        });
      }

      // Send email to referee
      if (referee?.email) {
        const refereeName = referee.user_metadata?.full_name || referee.email.split('@')[0];
        const referrerName = referrer?.user_metadata?.full_name || referrer?.email?.split('@')[0];
        const language = referee.user_metadata?.language || 'en';

        sendReferralRewardReferee(referee.email, refereeName, referrerName, language).catch(err => {
          console.warn('[ReferralManager] Failed to send referee email:', err);
        });
      }
    } catch (emailError) {
      console.warn('[ReferralManager] Email service unavailable:', emailError);
    }

    return { success: true };
  } catch (error) {
    console.error('[ReferralManager] trackReferral error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete a referral when the referee performs their first paid action.
 * Awards credits to both referrer and referee and sends email notifications.
 *
 * @param {string} refereeUserId - UUID of the referee who performed the action
 * @returns {Promise<{completed: boolean, referrerReward?: number, refereeReward?: number, error?: string}>}
 */
export async function completeReferral(refereeUserId) {
  try {
    const supabase = getSupabaseClient();

    // Check if referral exists and is incomplete
    const { data: refereeData, error: fetchError } = await supabase
      .from('user_credits')
      .select('referred_by_user_id, referral_completed')
      .eq('user_id', refereeUserId)
      .single();

    if (fetchError || !refereeData) {
      // No referral relationship - this is normal
      return { completed: false };
    }

    const { referred_by_user_id: referrerId, referral_completed: alreadyCompleted } = refereeData;

    // Skip if no referrer or already completed
    if (!referrerId || alreadyCompleted) {
      return { completed: false };
    }

    console.log(`[ReferralManager] Completing referral for referee ${refereeUserId}`);

    // Get user details for emails
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const referrer = authUsers?.users?.find(u => u.id === referrerId);
    const referee = authUsers?.users?.find(u => u.id === refereeUserId);

    // Award credits to referrer
    const { error: referrerError } = await supabase.rpc('add_credits', {
      p_user_id: referrerId,
      p_amount: REFERRER_REWARD,
      p_description: `Referral bonus: friend completed first action`,
      p_transaction_type: 'referral_reward'
    });

    if (referrerError) {
      console.error('[ReferralManager] Failed to reward referrer:', referrerError);
      return { completed: false, error: 'Failed to reward referrer' };
    }

    // Award credits to referee
    const { error: refereeError } = await supabase.rpc('add_credits', {
      p_user_id: refereeUserId,
      p_amount: REFEREE_REWARD,
      p_description: `Referral bonus: welcome reward`,
      p_transaction_type: 'referral_reward'
    });

    if (refereeError) {
      console.error('[ReferralManager] Failed to reward referee:', refereeError);
      return { completed: false, error: 'Failed to reward referee' };
    }

    // Mark referral as completed
    const { error: completeError } = await supabase
      .from('user_credits')
      .update({
        referral_completed: true,
        referral_completed_at: new Date().toISOString()
      })
      .eq('user_id', refereeUserId);

    if (completeError) {
      console.error('[ReferralManager] Failed to mark referral complete:', completeError);
      return { completed: false, error: 'Failed to mark complete' };
    }

    console.log(`[ReferralManager] Referral completed: ${referrerId} (+${REFERRER_REWARD}) and ${refereeUserId} (+${REFEREE_REWARD})`);

    // Send email notifications (non-blocking)
    try {
      const { sendReferralRewardReferrer, sendReferralRewardReferee } = await import('./email-service.js');

      // Send email to referrer
      if (referrer?.email) {
        const referrerName = referrer.user_metadata?.full_name || referrer.email.split('@')[0];
        const refereeName = referee?.user_metadata?.full_name || referee?.email?.split('@')[0];
        const language = referrer.user_metadata?.language || 'en';

        sendReferralRewardReferrer(referrer.email, referrerName, refereeName, language).catch(err => {
          console.warn('[ReferralManager] Failed to send referrer email:', err);
        });
      }

      // Send email to referee
      if (referee?.email) {
        const refereeName = referee.user_metadata?.full_name || referee.email.split('@')[0];
        const referrerName = referrer?.user_metadata?.full_name || referrer?.email?.split('@')[0];
        const language = referee.user_metadata?.language || 'en';

        sendReferralRewardReferee(referee.email, refereeName, referrerName, language).catch(err => {
          console.warn('[ReferralManager] Failed to send referee email:', err);
        });
      }
    } catch (emailError) {
      console.warn('[ReferralManager] Email service unavailable:', emailError);
      // Don't fail the entire operation if emails fail
    }

    return {
      completed: true,
      referrerReward: REFERRER_REWARD,
      refereeReward: REFEREE_REWARD
    };
  } catch (error) {
    console.error('[ReferralManager] completeReferral error:', error);
    return { completed: false, error: error.message };
  }
}

/**
 * Get referral statistics for a user.
 *
 * @param {string} userId - UUID of the user
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
      console.error('[ReferralManager] Failed to fetch stats:', error);
      return { total: 0, completed: 0, pending: 0, creditsEarned: 0 };
    }

    const total = data.length;
    const completed = data.filter(r => r.referral_completed).length;
    const pending = total - completed;
    const creditsEarned = completed * REFERRER_REWARD;

    return { total, completed, pending, creditsEarned };
  } catch (error) {
    console.error('[ReferralManager] getReferralStats error:', error);
    return { total: 0, completed: 0, pending: 0, creditsEarned: 0 };
  }
}
