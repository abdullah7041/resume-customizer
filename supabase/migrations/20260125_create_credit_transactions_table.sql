-- Create credit_transactions table
-- Audit log for all credit transactions (consumption, rewards, resets)

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  amount INTEGER NOT NULL,
  credits_before INTEGER NOT NULL,
  credits_after INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('consumption', 'referral_reward', 'feedback_reward', 'monthly_reset')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own transactions
CREATE POLICY credit_transactions_select_own ON public.credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can insert (for automatic logging)
CREATE POLICY credit_transactions_insert_service ON public.credit_transactions
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON public.credit_transactions(user_id, created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE public.credit_transactions IS 'Immutable audit log of all credit transactions for compliance and debugging';
COMMENT ON COLUMN public.credit_transactions.transaction_type IS 'Type of transaction: consumption (feature use), referral_reward (referral bonus), feedback_reward (feedback bonus), monthly_reset (monthly allocation)';
COMMENT ON COLUMN public.credit_transactions.metadata IS 'Additional context (e.g., which feature, emoji_rating for feedback)';
