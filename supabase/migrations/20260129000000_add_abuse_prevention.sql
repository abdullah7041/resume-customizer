-- Add anti-abuse tracking to user_credits table

-- Add signup metadata column
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS signup_metadata JSONB DEFAULT '{}'::jsonb;

-- Add created_at for tracking account age
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add index for IP abuse detection
CREATE INDEX IF NOT EXISTS idx_user_credits_signup_metadata
  ON public.user_credits USING GIN (signup_metadata);

-- Add index for created_at queries
CREATE INDEX IF NOT EXISTS idx_user_credits_created_at
  ON public.user_credits(created_at DESC);

-- Comments for documentation
COMMENT ON COLUMN public.user_credits.signup_metadata IS 'Anti-abuse tracking: IP address, email verification status, device fingerprint, etc.';
COMMENT ON COLUMN public.user_credits.created_at IS 'When the user account was created (for abuse detection)';
