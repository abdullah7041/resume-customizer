-- Migration: Rename tables for GDPR compliance and consistency
-- Date: 2026-01-08
-- Description: Renames legacy tables to follow GDPR naming conventions

-- Rename profiles to user_profiles (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    ALTER TABLE IF EXISTS public.profiles RENAME TO user_profiles;
    RAISE NOTICE 'Renamed profiles to user_profiles';
  END IF;
END $$;

-- Rename consent_records to consent_logs (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'consent_records') THEN
    ALTER TABLE IF EXISTS public.consent_records RENAME TO consent_logs;
    RAISE NOTICE 'Renamed consent_records to consent_logs';
  END IF;
END $$;

-- Rename analyses to job_matches (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'analyses') THEN
    ALTER TABLE IF EXISTS public.analyses RENAME TO job_matches;
    RAISE NOTICE 'Renamed analyses to job_matches';
  END IF;
END $$;

-- Create job_applications table if it doesn't exist
-- Note: job_match_id is optional and FK is added conditionally below
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_match_id UUID,
  company_name TEXT,
  position TEXT,
  status TEXT DEFAULT 'applied',
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Ensure job_match_id column exists if table was already created (e.g. from previous partial run)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_applications') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_applications' AND column_name='job_match_id') THEN
      ALTER TABLE public.job_applications ADD COLUMN job_match_id UUID;
      RAISE NOTICE 'Added missing column job_match_id to job_applications';
    END IF;
  END IF;
END $$;

-- Conditionally add FK constraint for job_match_id if job_matches table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_matches') THEN
    -- Check if constraint already exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'job_applications_job_match_id_fkey' 
      AND conrelid = 'public.job_applications'::regclass
    ) THEN
      ALTER TABLE public.job_applications 
        ADD CONSTRAINT job_applications_job_match_id_fkey 
        FOREIGN KEY (job_match_id) REFERENCES public.job_matches(id) ON DELETE SET NULL;
      RAISE NOTICE 'Added FK constraint to job_matches';
    END IF;
  ELSE
    RAISE NOTICE 'job_matches table does not exist, skipping FK constraint';
  END IF;
END $$;

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON public.job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_match_id ON public.job_applications(job_match_id);

-- Add RLS policies for job_applications
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own applications
-- Using DROP IF EXISTS + CREATE pattern since PostgreSQL doesn't support CREATE POLICY IF NOT EXISTS
DROP POLICY IF EXISTS "Users can view own applications" ON public.job_applications;
CREATE POLICY "Users can view own applications"
  ON public.job_applications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own applications" ON public.job_applications;
CREATE POLICY "Users can insert own applications"
  ON public.job_applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own applications" ON public.job_applications;
CREATE POLICY "Users can update own applications"
  ON public.job_applications
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own applications" ON public.job_applications;
CREATE POLICY "Users can delete own applications"
  ON public.job_applications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create deletion_log table for GDPR compliance tracking
CREATE TABLE IF NOT EXISTS public.deletion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_hash TEXT NOT NULL,
  deletion_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  deleted_by TEXT
);

-- Add comment to explain purpose
COMMENT ON TABLE public.deletion_log IS 'GDPR compliance: Logs user data deletion requests';

-- Note: This migration is idempotent and safe to run multiple times
