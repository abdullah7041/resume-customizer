/**
 * Referral Management System
 * Handles referral tracking and credit distribution
 */

import { createClient } from '@supabase/supabase-js';
import { addCredits } from './credit-manager.js';

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
 * Track a new referral (referee just signed up)
 * @param {string} referrerId - ID of the user who referred
 * @param {string} refereeId - ID of the new user (referee)
 * @param {string} [refereeEmail] - Email of the new user
 * @returns {Promise<{success: boolean, referralId: string}>}
 */
export async function trackReferral(referrerId, refereeId, refereeEmail = null) {
  const supabase = getSupabaseClient();

  // Verify both users exist
  const { data: referrerData, error: referrerError } = await supabase
    .from('user_credits')
    .select('user_id')
    .eq('user_id', referrerId)
    .single();

  if (referrerError || !referrerData) {
    console.warn(`[ReferralManager] Referrer ${referrerId} not found or not initialized`);
    // Don't fail - referrer might not have credits initialized yet
  }

  // Insert referral record
  const { data: referralData, error: referralError } = await supabase
    .from('referrals')
    .insert({
      referrer_id: referrerId,
      referee_id: refereeId,
      referee_email: refereeEmail,
      status: 'pending', // Changes to 'completed' after first purchase/use
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (referralError) {
    console.error('[ReferralManager] Failed to track referral:', referralError);
    throw new Error('Failed to track referral');
  }

  console.log(`[ReferralManager] Tracked referral: ${referrerId} → ${refereeId}`);

  return { success: true, referralId: referralData.id };
}

/**
 * Complete a referral and distribute credits
 * Call this after the referee has used a paid feature
 * @param {string} referrerId - ID of the referrer
 * @param {string} refereeId - ID of the referee
 * @returns {Promise<{success: boolean, creditsAwarded: number}>}
 */
export async function completeReferral(referrerId, refereeId) {
  const supabase = getSupabaseClient();
  const REFERRAL_REWARD = 5; // Credits for the referrer

  try {
    // Find the referral record
    const { data: referralData, error: fetchError } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_id', referrerId)
      .eq('referee_id', refereeId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !referralData) {
      console.warn(`[ReferralManager] No pending referral found for ${referrerId} → ${refereeId}`);
      return { success: false, creditsAwarded: 0 };
    }

    // Update referral status
    const { error: updateError } = await supabase
      .from('referrals')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', referralData.id);

    if (updateError) {
      console.error('[ReferralManager] Failed to update referral status:', updateError);
      throw new Error('Failed to complete referral');
    }

    // Award credits to referrer
    await addCredits(
      referrerId,
      REFERRAL_REWARD,
      'referral_reward',
      { referee_id: refereeId, referral_id: referralData.id }
    );

    console.log(`[ReferralManager] Completed referral: awarded ${REFERRAL_REWARD} credits to ${referrerId}`);

    return { success: true, creditsAwarded: REFERRAL_REWARD };
  } catch (error) {
    console.error('[ReferralManager] Error completing referral:', error);
    throw error;
  }
}

/**
 * Get referral stats for a user
 * @param {string} userId - User ID
 * @returns {Promise<{totalReferrals: number, completedReferrals: number, creditsEarned: number}>}
 */
export async function getReferralStats(userId) {
  const supabase = getSupabaseClient();

  const { data: referrals, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_id', userId);

  if (error) {
    console.error('[ReferralManager] Failed to fetch referral stats:', error);
    throw new Error('Failed to fetch referral stats');
  }

  const completed = referrals?.filter((r) => r.status === 'completed') || [];
  const REFERRAL_REWARD = 5;

  return {
    totalReferrals: referrals?.length || 0,
    completedReferrals: completed.length,
    creditsEarned: completed.length * REFERRAL_REWARD,
  };
}

/**
 * Get referral by code (for deep linking)
 * @param {string} referralCode - Unique referral code
 * @returns {Promise<{referrerId: string, referrerEmail: string} | null>}
 */
export async function getReferralByCode(referralCode) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('referrals')
    .select('referrer_id')
    .eq('referral_code', referralCode)
    .single();

  if (error) {
    console.warn(`[ReferralManager] Referral code not found: ${referralCode}`);
    return null;
  }

  return data;
}
