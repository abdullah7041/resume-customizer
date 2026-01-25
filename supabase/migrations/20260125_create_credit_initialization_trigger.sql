-- Create trigger to initialize user credits on signup
-- Automatically assigns 15 free credits to every new user

-- ============================================
-- 1. CREATE INITIALIZATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.initialize_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert new user credits record (15 free credits to start)
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
    15,  -- Start with 15 free credits
    15,
    0,   -- No feedback credits earned yet
    0,   -- No referral credits earned yet
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (user_id) DO NOTHING;  -- Prevent duplicates if user already exists

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.initialize_user_credits IS 'Automatically initialize 15 free credits for new users on signup';

-- ============================================
-- 2. CREATE TRIGGER ON auth.users
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_credits();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Fires on new user signup to initialize credit record with 15 free credits';

-- ============================================
-- 3. INITIALIZE CREDITS FOR EXISTING USERS
-- ============================================

-- Add credits for any existing users who don't have a credit record yet
-- (in case the table was added after users already existed)
INSERT INTO public.user_credits (
  user_id,
  credits_remaining,
  credits_total,
  feedback_credits_earned,
  referral_credits_earned,
  last_reset_date,
  created_at,
  updated_at
)
SELECT
  u.id,
  15,
  15,
  0,
  0,
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
WHERE u.id NOT IN (SELECT user_id FROM public.user_credits)
ON CONFLICT (user_id) DO NOTHING;
