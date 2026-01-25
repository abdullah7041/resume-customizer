-- Add referral_code column to user_credits table
-- This enables users to generate unique referral links

ALTER TABLE user_credits
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_credits_referral_code ON user_credits(referral_code);

-- Comment for documentation
COMMENT ON COLUMN user_credits.referral_code IS 'Unique referral code for sharing (e.g., ABC123XY)';
