-- Migration to increase default credits from 15 to 20
-- This fixes the credit number bug where users were getting 15 instead of 20

-- 1. Update the default value for new rows
ALTER TABLE public.user_credits ALTER COLUMN credits_total SET DEFAULT 20;
ALTER TABLE public.user_credits ALTER COLUMN credits_remaining SET DEFAULT 20;

-- 2. Update the initialization function to give 20 credits to new users
CREATE OR REPLACE FUNCTION public.initialize_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_credits (
    user_id,
    credits_remaining,
    credits_total,
    feedback_credits_earned,
    referral_credits_earned,
    last_reset_date,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    20,  -- Start with 20 free credits per month (updated from 15)
    20,
    0,
    0,
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update existing users who are on the default 15 plan
-- Increase their total to 20 and add 5 to their remaining credits to reflect the increase
UPDATE public.user_credits 
SET 
  credits_total = 20,
  credits_remaining = credits_remaining + 5
WHERE credits_total = 15;
