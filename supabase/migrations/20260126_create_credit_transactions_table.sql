-- Create credit_transactions table for audit trail
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  credits_amount INT NOT NULL,
  credits_before INT NOT NULL,
  credits_after INT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_action ON public.credit_transactions(action);
CREATE INDEX idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own transactions
CREATE POLICY "Users can view their own credit transactions"
  ON public.credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can do everything
CREATE POLICY "Service role can manage all credit transactions"
  ON public.credit_transactions
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Add comments
COMMENT ON TABLE public.credit_transactions IS 'Audit trail for all credit transactions (usage, rewards, refunds)';
COMMENT ON COLUMN public.credit_transactions.action IS 'Action type: optimize, match, vision2030, interview, feedback_reward, referral_reward, monthly_reset';
COMMENT ON COLUMN public.credit_transactions.credits_amount IS 'Number of credits used (negative) or earned (positive)';
