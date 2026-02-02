-- Migration: Fix add_credits() RPC to include feature column
-- This fixes the null constraint violation when awarding referral credits
-- Date: 2026-02-03

-- Drop existing function (all overloads)
DROP FUNCTION IF EXISTS public.add_credits(UUID, INTEGER, TEXT, TEXT);

-- Recreate with feature parameter
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_transaction_type TEXT,
  p_feature TEXT DEFAULT 'system'  -- NEW PARAMETER with default for backwards compatibility
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
  -- Get current credit counts
  SELECT credits_total, credits_remaining
  INTO v_current_total, v_current_remaining
  FROM public.user_credits
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User credits record not found for user_id: %', p_user_id;
  END IF;

  -- Calculate new totals
  v_new_total := v_current_total + p_amount;
  v_new_remaining := v_current_remaining + p_amount;

  -- Update user credits
  UPDATE public.user_credits
  SET
    credits_total = v_new_total,
    credits_remaining = v_new_remaining,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log transaction (NOW WITH FEATURE COLUMN)
  INSERT INTO public.credit_transactions (
    user_id,
    feature,              -- NEW COLUMN
    transaction_type,
    credits_before,
    credits_after,
    amount,
    metadata
  ) VALUES (
    p_user_id,
    p_feature,            -- NEW VALUE
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

-- Grant permissions (new signature includes p_feature)
GRANT EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER, TEXT, TEXT, TEXT) TO service_role;

-- Add comment
COMMENT ON FUNCTION public.add_credits(UUID, INTEGER, TEXT, TEXT, TEXT) IS
  'Adds credits to a user account and logs the transaction with feature tracking. Defaults to "system" feature if not specified.';
