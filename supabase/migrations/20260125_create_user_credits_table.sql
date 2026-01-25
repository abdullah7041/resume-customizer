-- Create user_credits table
-- Main credit ledger for all users. Every user gets 15 free credits at signup.

CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_remaining INTEGER NOT NULL DEFAULT 15,
  credits_total INTEGER NOT NULL DEFAULT 15,
  feedback_credits_earned INTEGER NOT NULL DEFAULT 0 CHECK (feedback_credits_earned <= 3),
  referral_credits_earned INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT UNIQUE,
  last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own credits
CREATE POLICY user_credits_select_own ON public.user_credits
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can do anything (for admin operations and RPC functions)
CREATE POLICY user_credits_service_role ON public.user_credits
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_referral_code ON public.user_credits(referral_code);
CREATE INDEX IF NOT EXISTS idx_user_credits_feedback_earned ON public.user_credits(feedback_credits_earned);

-- Add comments for documentation
COMMENT ON TABLE public.user_credits IS 'Main credit ledger tracking user credit balance, earnings, and history';
COMMENT ON COLUMN public.user_credits.credits_remaining IS 'Credits available for use (0-15)';
COMMENT ON COLUMN public.user_credits.credits_total IS 'Total credits allocated (15 free monthly)';
COMMENT ON COLUMN public.user_credits.feedback_credits_earned IS 'Feedback credits earned this month (max 3)';
COMMENT ON COLUMN public.user_credits.referral_credits_earned IS 'Credits earned from referrals (lifetime)';
COMMENT ON COLUMN public.user_credits.last_reset_date IS 'When monthly credits were last reset (for audit trail)';
