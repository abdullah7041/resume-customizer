-- Create function to auto-initialize credits for new users
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
    15,  -- Start with 15 free credits per month
    15,
    0,
    0,
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_credits();

-- Initialize credits for existing users who don't have records yet
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
  id,
  15,
  15,
  0,
  0,
  NOW(),
  NOW(),
  NOW()
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_credits)
ON CONFLICT (user_id) DO NOTHING;
