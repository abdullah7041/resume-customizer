-- Create waitlist table for users interested in paid plans
CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  plan_type TEXT NOT NULL DEFAULT 'pro',
  language TEXT NOT NULL DEFAULT 'en',
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  metadata JSONB,

  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_subscribed_at ON public.waitlist(subscribed_at DESC);

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anyone to join the waitlist (INSERT only)
CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist
  FOR INSERT
  WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE public.waitlist IS 'Users who want to be notified when paid plans launch';
COMMENT ON COLUMN public.waitlist.email IS 'User email address (unique constraint enforced)';
COMMENT ON COLUMN public.waitlist.plan_type IS 'Which plan they are interested in (pro, enterprise, etc.)';
COMMENT ON COLUMN public.waitlist.language IS 'User UI language when they signed up (en or ar)';
COMMENT ON COLUMN public.waitlist.notified_at IS 'When they were notified about launch (null = not yet notified)';
COMMENT ON COLUMN public.waitlist.metadata IS 'Additional data like source page, timestamp, etc.';
