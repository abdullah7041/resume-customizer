-- Add referral tracking columns to user_credits table
-- This migration enables automatic referral completion tracking

-- Add columns for referral tracking
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS referral_completed_at TIMESTAMPTZ;

-- Add index for efficient referral queries
CREATE INDEX IF NOT EXISTS idx_user_credits_referred_by
  ON public.user_credits(referred_by_user_id)
  WHERE referred_by_user_id IS NOT NULL;

-- Add index for finding incomplete referrals
CREATE INDEX IF NOT EXISTS idx_user_credits_referral_incomplete
  ON public.user_credits(referred_by_user_id, referral_completed)
  WHERE referred_by_user_id IS NOT NULL AND referral_completed = FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.user_credits.referred_by_user_id IS 'UUID of the user who referred this user (null if not referred)';
COMMENT ON COLUMN public.user_credits.referral_completed IS 'Whether the referral has been completed (referee performed first paid action)';
COMMENT ON COLUMN public.user_credits.referral_completed_at IS 'Timestamp when the referral was marked complete';
