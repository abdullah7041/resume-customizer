-- ============================================================================
-- CRITICAL FIXES: Security, Performance, and Duplicate Cleanup (v2)
-- ============================================================================

-- ============================================================================
-- PART 1: Fix all functions - add search_path (Security Fix)
-- ============================================================================

-- Fix: add_credits (correct column names + search_path)
DROP FUNCTION IF EXISTS public.add_credits(UUID, INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
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
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User credits record not found for user_id: %', p_user_id;
  END IF;

  v_new_total := v_current_total + p_amount;
  v_new_remaining := v_current_remaining + p_amount;

  UPDATE public.user_credits
  SET
    credits_total = v_new_total,
    credits_remaining = v_new_remaining,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    credits_before,
    credits_after,
    amount,
    metadata
  ) VALUES (
    p_user_id,
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

GRANT EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER, TEXT, TEXT) TO service_role;

-- Fix: initialize_user_credits (has trigger dependency, use CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.initialize_user_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Fix: consume_credits_atomic (with proper signature)
DROP FUNCTION IF EXISTS public.consume_credits_atomic(UUID, TEXT, INTEGER, JSONB);

CREATE OR REPLACE FUNCTION public.consume_credits_atomic(
  p_user_id UUID,
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
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_credits_before < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits: have %, need %', v_credits_before, p_amount;
  END IF;

  UPDATE user_credits
  SET credits_remaining = credits_remaining - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING user_credits.credits_remaining INTO v_credits_after;

  INSERT INTO credit_transactions (user_id, feature, amount, credits_before, credits_after, transaction_type, metadata)
  VALUES (p_user_id, p_feature, -p_amount, v_credits_before, v_credits_after, 'consumption', p_metadata);

  RETURN QUERY SELECT v_credits_after;
END;
$$;

-- Fix: award_credits_atomic (with proper signature)
DROP FUNCTION IF EXISTS public.award_credits_atomic(UUID, INTEGER, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.award_credits_atomic(
  p_user_id UUID,
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
  WHERE user_id = p_user_id
  FOR UPDATE;

  UPDATE user_credits
  SET credits_remaining = credits_remaining + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING user_credits.credits_remaining INTO v_credits_after;

  IF p_type = 'feedback_reward' THEN
    UPDATE user_credits
    SET feedback_credits_earned = feedback_credits_earned + 1
    WHERE user_id = p_user_id;
  ELSIF p_type = 'referral_reward' THEN
    UPDATE user_credits
    SET referral_credits_earned = referral_credits_earned + 1
    WHERE user_id = p_user_id;
  END IF;

  INSERT INTO credit_transactions (user_id, feature, amount, credits_before, credits_after, transaction_type, metadata)
  VALUES (p_user_id, 'system', p_amount, v_credits_before, v_credits_after, p_type, p_metadata);

  RETURN QUERY SELECT v_credits_after;
END;
$$;

-- Fix: reset_monthly_credits (with proper signature)
DROP FUNCTION IF EXISTS public.reset_monthly_credits(UUID);

CREATE OR REPLACE FUNCTION public.reset_monthly_credits(
  p_user_id UUID
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
  WHERE user_id = p_user_id
  FOR UPDATE;

  UPDATE user_credits
  SET credits_remaining = 15,
      credits_total = 15,
      last_reset_date = NOW(),
      updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, feature, amount, credits_before, credits_after, transaction_type)
  VALUES (p_user_id, 'system', 15, v_credits_before, 15, 'monthly_reset');

  RETURN QUERY SELECT TRUE, 15;
END;
$$;

-- Fix: add_feedback_credits (keep existing complex logic, just add search_path)
DROP FUNCTION IF EXISTS public.add_feedback_credits(UUID);

CREATE OR REPLACE FUNCTION public.add_feedback_credits(
  p_user_id UUID
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
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User credits record not found for user_id: %', p_user_id;
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
  WHERE user_id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id,
    feature,
    amount,
    credits_before,
    credits_after,
    transaction_type,
    metadata
  ) VALUES (
    p_user_id,
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

-- Fix: consume_user_credits
DROP FUNCTION IF EXISTS public.consume_user_credits(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.consume_user_credits(
  p_user_id UUID,
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
  WHERE user_id = p_user_id
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
  WHERE user_id = p_user_id;

  RETURN v_new_credits;
END;
$$;

-- ============================================================================
-- PART 2: Drop duplicate referrals table
-- ============================================================================

DROP TABLE IF EXISTS public.referrals CASCADE;

COMMENT ON TABLE public.user_credits IS
  'Unified credits and referral tracking. Referral system is built into this table via referral_code, referred_by_user_id, and referral_completed columns.';

-- ============================================================================
-- PART 3: Fix RLS Policies - Performance Optimization
-- ============================================================================

-- Fix user_credits policies
DROP POLICY IF EXISTS "Users can read own credits" ON public.user_credits;
DROP POLICY IF EXISTS "user_credits_service_role_select" ON public.user_credits;
DROP POLICY IF EXISTS "user_credits_service_role_insert" ON public.user_credits;
DROP POLICY IF EXISTS "user_credits_service_role_update" ON public.user_credits;
DROP POLICY IF EXISTS "user_credits_service_role_delete" ON public.user_credits;

CREATE POLICY "user_credits_select_policy" ON public.user_credits
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid()) OR
    (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "user_credits_insert_policy" ON public.user_credits
  FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');

CREATE POLICY "user_credits_update_policy" ON public.user_credits
  FOR UPDATE
  USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "user_credits_delete_policy" ON public.user_credits
  FOR DELETE
  USING ((SELECT auth.role()) = 'service_role');

-- Fix credit_transactions policies
DROP POLICY IF EXISTS "Users can read own transactions" ON public.credit_transactions;

CREATE POLICY "credit_transactions_select_policy" ON public.credit_transactions
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid()) OR
    (SELECT auth.role()) = 'service_role'
  );

-- Fix feedback policies
DROP POLICY IF EXISTS "feedback_insert_own" ON public.feedback;
DROP POLICY IF EXISTS "feedback_select_own" ON public.feedback;
DROP POLICY IF EXISTS "feedback_service_role" ON public.feedback;

CREATE POLICY "feedback_insert_policy" ON public.feedback
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid()) OR
    (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "feedback_select_policy" ON public.feedback
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid()) OR
    (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "feedback_update_policy" ON public.feedback
  FOR UPDATE
  USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "feedback_delete_policy" ON public.feedback
  FOR DELETE
  USING ((SELECT auth.role()) = 'service_role');

-- ============================================================================
-- PART 4: Drop unused indexes
-- ============================================================================

DROP INDEX IF EXISTS public.idx_user_credits_feedback_earned;
DROP INDEX IF EXISTS public.idx_user_credits_referral_code;
DROP INDEX IF EXISTS public.idx_user_credits_referred_by;
DROP INDEX IF EXISTS public.idx_user_credits_referral_incomplete;
DROP INDEX IF EXISTS public.idx_user_credits_signup_metadata;
DROP INDEX IF EXISTS public.idx_user_credits_created_at;
DROP INDEX IF EXISTS public.idx_credit_transactions_created_at;
DROP INDEX IF EXISTS public.idx_referrals_referral_code;
DROP INDEX IF EXISTS public.idx_job_applications_resume_id;
DROP INDEX IF EXISTS public.idx_waitlist_email;
DROP INDEX IF EXISTS public.idx_waitlist_subscribed_at;
DROP INDEX IF EXISTS public.idx_feedback_created_at;
DROP INDEX IF EXISTS public.idx_feedback_emoji_rating;

-- Create essential indexes
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_notified_at ON public.waitlist(notified_at) WHERE notified_at IS NULL;

-- ============================================================================
-- PART 5: Improve waitlist RLS policy
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;

CREATE POLICY "waitlist_insert_policy" ON public.waitlist
  FOR INSERT
  WITH CHECK (
    email IS NOT NULL AND
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

CREATE POLICY "waitlist_select_policy" ON public.waitlist
  FOR SELECT
  USING ((SELECT auth.role()) = 'service_role');

-- ============================================================================
-- PART 6: Add helpful comments
-- ============================================================================

COMMENT ON FUNCTION public.add_credits IS 'Safely adds credits to a user account and logs the transaction. SECURITY: search_path is set.';
COMMENT ON FUNCTION public.consume_credits_atomic IS 'Atomically consumes credits with validation. SECURITY: search_path is set.';
COMMENT ON FUNCTION public.award_credits_atomic IS 'Atomically awards credits to a user. SECURITY: search_path is set.';
COMMENT ON FUNCTION public.initialize_user_credits IS 'Trigger function to initialize user credits on signup. SECURITY: search_path is set.';
COMMENT ON FUNCTION public.add_feedback_credits IS 'Awards feedback credits (max 3). SECURITY: search_path is set.';
COMMENT ON FUNCTION public.consume_user_credits IS 'Simple credit consumption function. SECURITY: search_path is set.';
COMMENT ON FUNCTION public.reset_monthly_credits IS 'Resets monthly credits to 15. SECURITY: search_path is set.';
