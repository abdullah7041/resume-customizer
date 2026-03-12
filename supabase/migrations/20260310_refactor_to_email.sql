-- 1. Ensure user_profiles has email
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Populate existing user_profiles with emails from auth.users
UPDATE user_profiles
SET email = auth.users.email
FROM auth.users
WHERE auth.users.id::text = user_profiles.id::text;

-- Make email unique
DELETE FROM user_profiles WHERE email IS NULL;
ALTER TABLE user_profiles ALTER COLUMN email SET NOT NULL;
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_email_key;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_email_key UNIQUE (email);

-- 2. Clean up user_profiles
ALTER TABLE user_profiles 
  DROP COLUMN IF EXISTS nationality,
  DROP COLUMN IF EXISTS iqama_number,
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS industry_preference VARCHAR(255);

-- 3. Add email columns to all tracking tables and populate them
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS email VARCHAR(255);
UPDATE user_credits SET email = auth.users.email FROM auth.users WHERE auth.users.id = user_credits.user_id;

ALTER TABLE resumes ADD COLUMN IF NOT EXISTS email VARCHAR(255);
UPDATE resumes SET email = auth.users.email FROM auth.users WHERE auth.users.id = resumes.user_id;

ALTER TABLE job_matches ADD COLUMN IF NOT EXISTS email VARCHAR(255);
UPDATE job_matches SET email = auth.users.email FROM auth.users WHERE auth.users.id = job_matches.user_id;

ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS email VARCHAR(255);
UPDATE credit_transactions SET email = auth.users.email FROM auth.users WHERE auth.users.id = credit_transactions.user_id;

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS email VARCHAR(255);
UPDATE feedback SET email = auth.users.email FROM auth.users WHERE auth.users.id = feedback.user_id;

-- Ensure non-null emails for data integrity (assuming all rows had valid auth users)
ALTER TABLE user_credits ALTER COLUMN email SET NOT NULL;
ALTER TABLE resumes ALTER COLUMN email SET NOT NULL;

-- 4. Consolidate job_applications -> resumes / job_matches
DROP TABLE IF EXISTS job_applications CASCADE;

-- Add target fields to resumes
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS target_job_title VARCHAR(255);
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS target_company VARCHAR(255);

-- 5. Drop old user_id dependencies in tables
-- We drop indexes and constraints first
DROP INDEX IF EXISTS idx_user_credits_user_id;
DROP INDEX IF EXISTS idx_credit_transactions_user_id;
DROP INDEX IF EXISTS idx_feedback_user_id;

ALTER TABLE user_credits DROP CONSTRAINT IF EXISTS user_credits_user_id_fkey;
ALTER TABLE resumes DROP CONSTRAINT IF EXISTS resumes_user_id_fkey;
ALTER TABLE job_matches DROP CONSTRAINT IF EXISTS job_matches_user_id_fkey;
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_user_id_fkey;
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_user_id_fkey;

-- Now drop the user_id column
ALTER TABLE user_credits DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS referred_by_email VARCHAR(255);
ALTER TABLE resumes DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE job_matches DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE credit_transactions DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE feedback DROP COLUMN IF EXISTS user_id CASCADE;

-- user_credits uses 'email' as primary key conceptually, though id is the actual PK 
-- Make email unique so we can look up user credits by email
ALTER TABLE user_credits ADD CONSTRAINT user_credits_email_key UNIQUE (email);

-- Recreate needed indexes on email
CREATE INDEX IF NOT EXISTS idx_user_credits_email ON public.user_credits(email);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_email ON public.credit_transactions(email);
CREATE INDEX IF NOT EXISTS idx_feedback_email ON public.feedback(email);

-- 6. Rewrite RPC Functions

-- add_credits
DROP FUNCTION IF EXISTS public.add_credits(UUID, INTEGER, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.add_credits(
  p_email VARCHAR,
  p_amount INTEGER,
  p_description TEXT,
  p_transaction_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_total INTEGER;
  v_new_total INTEGER;
  v_current_remaining INTEGER;
  v_new_remaining INTEGER;
BEGIN
  SELECT credits_total, credits_remaining
  INTO v_current_total, v_current_remaining
  FROM public.user_credits
  WHERE email = p_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User credits record not found for email: %', p_email;
  END IF;

  v_new_total := v_current_total + p_amount;
  v_new_remaining := v_current_remaining + p_amount;

  UPDATE public.user_credits
  SET
    credits_total = v_new_total,
    credits_remaining = v_new_remaining,
    updated_at = NOW()
  WHERE email = p_email;

  INSERT INTO public.credit_transactions (
    email,
    transaction_type,
    credits_before,
    credits_after,
    amount,
    metadata
  ) VALUES (
    p_email,
    p_transaction_type,
    v_current_remaining,
    v_new_remaining,
    p_amount,
    jsonb_build_object('description', p_description)
  );

  RETURN jsonb_build_object(
    'success', true,
    'credits_added', p_amount,
    'total', v_new_total,
    'remaining', v_new_remaining
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_credits(VARCHAR, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(VARCHAR, INTEGER, TEXT, TEXT) TO service_role;

-- initialize_user_credits (trigger adjusted for email)
CREATE OR REPLACE FUNCTION public.initialize_user_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, is_premium)
  VALUES (NEW.id, NEW.email, false)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_credits (email, credits_remaining, credits_total)
  VALUES (NEW.email, 15, 15)
  ON CONFLICT (email) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- consume_credits_atomic
DROP FUNCTION IF EXISTS public.consume_credits_atomic(UUID, TEXT, INTEGER, JSONB);
CREATE OR REPLACE FUNCTION public.consume_credits_atomic(
  p_email VARCHAR,
  p_feature TEXT,
  p_amount INTEGER,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(credits_remaining INTEGER)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credits_before INTEGER;
  v_credits_after INTEGER;
BEGIN
  SELECT user_credits.credits_remaining INTO v_credits_before
  FROM user_credits
  WHERE email = p_email
  FOR UPDATE;

  IF v_credits_before < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits: have %, need %', v_credits_before, p_amount;
  END IF;

  UPDATE user_credits
  SET credits_remaining = credits_remaining - p_amount,
      updated_at = NOW()
  WHERE email = p_email
  RETURNING user_credits.credits_remaining INTO v_credits_after;

  INSERT INTO credit_transactions (email, feature, amount, credits_before, credits_after, transaction_type, metadata)
  VALUES (p_email, p_feature, -p_amount, v_credits_before, v_credits_after, 'consumption', p_metadata);

  RETURN QUERY SELECT v_credits_after;
END;
$$;

-- award_credits_atomic
DROP FUNCTION IF EXISTS public.award_credits_atomic(UUID, INTEGER, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.award_credits_atomic(
  p_email VARCHAR,
  p_amount INTEGER,
  p_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(credits_remaining INTEGER)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credits_before INTEGER;
  v_credits_after INTEGER;
BEGIN
  SELECT user_credits.credits_remaining INTO v_credits_before
  FROM user_credits
  WHERE email = p_email
  FOR UPDATE;

  UPDATE user_credits
  SET credits_remaining = credits_remaining + p_amount,
      updated_at = NOW()
  WHERE email = p_email
  RETURNING user_credits.credits_remaining INTO v_credits_after;

  IF p_type = 'feedback_reward' THEN
    UPDATE user_credits
    SET feedback_credits_earned = feedback_credits_earned + 1
    WHERE email = p_email;
  ELSIF p_type = 'referral_reward' THEN
    UPDATE user_credits
    SET referral_credits_earned = COALESCE(referral_credits_earned, 0) + 1
    WHERE email = p_email;
  END IF;

  INSERT INTO credit_transactions (email, feature, amount, credits_before, credits_after, transaction_type, metadata)
  VALUES (p_email, 'system', p_amount, v_credits_before, v_credits_after, p_type, p_metadata);

  RETURN QUERY SELECT v_credits_after;
END;
$$;

-- reset_monthly_credits
DROP FUNCTION IF EXISTS public.reset_monthly_credits(UUID);
CREATE OR REPLACE FUNCTION public.reset_monthly_credits(
  p_email VARCHAR
)
RETURNS TABLE(reset BOOLEAN, new_balance INTEGER)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credits_before INTEGER;
BEGIN
  SELECT user_credits.credits_remaining INTO v_credits_before
  FROM user_credits
  WHERE email = p_email
  FOR UPDATE;

  UPDATE user_credits
  SET credits_remaining = 15,
      credits_total = 15,
      last_reset_date = NOW(),
      updated_at = NOW()
  WHERE email = p_email;

  INSERT INTO credit_transactions (email, feature, amount, credits_before, credits_after, transaction_type)
  VALUES (p_email, 'system', 15, v_credits_before, 15, 'monthly_reset');

  RETURN QUERY SELECT TRUE, 15;
END;
$$;

-- add_feedback_credits
DROP FUNCTION IF EXISTS public.add_feedback_credits(UUID);
CREATE OR REPLACE FUNCTION public.add_feedback_credits(
  p_email VARCHAR
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_feedback_credits_earned INTEGER;
  v_credits_remaining INTEGER;
  v_credits_total INTEGER;
  v_max_feedback_credits CONSTANT INTEGER := 3;
  v_result JSON;
BEGIN
  SELECT
    feedback_credits_earned,
    credits_remaining,
    credits_total
  INTO
    v_feedback_credits_earned,
    v_credits_remaining,
    v_credits_total
  FROM public.user_credits
  WHERE email = p_email
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User credits record not found for email: %', p_email;
  END IF;

  IF v_feedback_credits_earned >= v_max_feedback_credits THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', 'max_feedback_credits_reached',
      'message', 'Maximum feedback credits already earned',
      'credits_awarded', 0,
      'feedback_credits_earned', v_feedback_credits_earned,
      'credits_remaining', v_credits_remaining
    );
    RETURN v_result;
  END IF;

  v_credits_remaining := v_credits_remaining + 1;
  v_feedback_credits_earned := v_feedback_credits_earned + 1;

  UPDATE public.user_credits
  SET
    credits_remaining = v_credits_remaining,
    feedback_credits_earned = v_feedback_credits_earned,
    updated_at = NOW()
  WHERE email = p_email;

  INSERT INTO public.credit_transactions (
    email,
    feature,
    amount,
    credits_before,
    credits_after,
    transaction_type,
    metadata
  ) VALUES (
    p_email,
    'feedback_reward',
    1,
    v_credits_remaining - 1,
    v_credits_remaining,
    'feedback_reward',
    jsonb_build_object(
      'timestamp', NOW()::TEXT,
      'feedback_credits_earned', v_feedback_credits_earned
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'credits_awarded', 1,
    'feedback_credits_earned', v_feedback_credits_earned,
    'credits_remaining', v_credits_remaining
  );

  RETURN v_result;
END;
$$;

-- consume_user_credits
DROP FUNCTION IF EXISTS public.consume_user_credits(UUID, INTEGER);
CREATE OR REPLACE FUNCTION public.consume_user_credits(
  p_email VARCHAR,
  p_amount INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_credits INTEGER;
BEGIN
  SELECT credits_remaining INTO v_current_credits
  FROM user_credits
  WHERE email = p_email
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User credits record not found';
  END IF;

  IF v_current_credits < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits: % available, % required', v_current_credits, p_amount;
  END IF;

  v_new_credits := v_current_credits - p_amount;

  UPDATE user_credits
  SET
    credits_remaining = v_new_credits,
    updated_at = NOW()
  WHERE email = p_email;

  RETURN v_new_credits;
END;
$$;

-- 7. RLS Policy Updates
-- user_credits
DROP POLICY IF EXISTS "user_credits_select_policy" ON public.user_credits;
DROP POLICY IF EXISTS "user_credits_insert_policy" ON public.user_credits;
DROP POLICY IF EXISTS "user_credits_update_policy" ON public.user_credits;
DROP POLICY IF EXISTS "user_credits_delete_policy" ON public.user_credits;

CREATE POLICY "user_credits_select_policy_email" ON public.user_credits
  FOR SELECT
  USING (
    email = (auth.jwt()->>'email') OR
    (SELECT auth.role()) = 'service_role'
  );

-- credit_transactions
DROP POLICY IF EXISTS "credit_transactions_select_policy" ON public.credit_transactions;

CREATE POLICY "credit_transactions_select_policy_email" ON public.credit_transactions
  FOR SELECT
  USING (
    email = (auth.jwt()->>'email') OR
    (SELECT auth.role()) = 'service_role'
  );

-- feedback
DROP POLICY IF EXISTS "feedback_insert_policy" ON public.feedback;
DROP POLICY IF EXISTS "feedback_select_policy" ON public.feedback;
DROP POLICY IF EXISTS "feedback_update_policy" ON public.feedback;
DROP POLICY IF EXISTS "feedback_delete_policy" ON public.feedback;

CREATE POLICY "feedback_insert_policy_email" ON public.feedback
  FOR INSERT
  WITH CHECK (
    email = (auth.jwt()->>'email') OR
    (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "feedback_select_policy_email" ON public.feedback
  FOR SELECT
  USING (
    email = (auth.jwt()->>'email') OR
    (SELECT auth.role()) = 'service_role'
  );

-- resumes
DROP POLICY IF EXISTS "resumes_insert_policy" ON public.resumes;
DROP POLICY IF EXISTS "resumes_select_policy" ON public.resumes;
DROP POLICY IF EXISTS "resumes_update_policy" ON public.resumes;
DROP POLICY IF EXISTS "resumes_delete_policy" ON public.resumes;

CREATE POLICY "resumes_insert_policy_email" ON public.resumes FOR INSERT WITH CHECK (email = (auth.jwt()->>'email') OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
CREATE POLICY "resumes_select_policy_email" ON public.resumes FOR SELECT USING (email = (auth.jwt()->>'email') OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
CREATE POLICY "resumes_update_policy_email" ON public.resumes FOR UPDATE USING (email = (auth.jwt()->>'email') OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
CREATE POLICY "resumes_delete_policy_email" ON public.resumes FOR DELETE USING (email = (auth.jwt()->>'email') OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- job_matches
DROP POLICY IF EXISTS "job_matches_insert_policy" ON public.job_matches;
DROP POLICY IF EXISTS "job_matches_select_policy" ON public.job_matches;
DROP POLICY IF EXISTS "job_matches_update_policy" ON public.job_matches;
DROP POLICY IF EXISTS "job_matches_delete_policy" ON public.job_matches;

CREATE POLICY "job_matches_insert_policy_email" ON public.job_matches FOR INSERT WITH CHECK (email = (auth.jwt()->>'email') OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
CREATE POLICY "job_matches_select_policy_email" ON public.job_matches FOR SELECT USING (email = (auth.jwt()->>'email') OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
CREATE POLICY "job_matches_update_policy_email" ON public.job_matches FOR UPDATE USING (email = (auth.jwt()->>'email') OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
CREATE POLICY "job_matches_delete_policy_email" ON public.job_matches FOR DELETE USING (email = (auth.jwt()->>'email') OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
