-- Create atomic credit consumption function
-- This prevents race conditions when multiple requests try to consume credits simultaneously

CREATE OR REPLACE FUNCTION consume_user_credits(
  p_user_id UUID,
  p_amount INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_credits INTEGER;
BEGIN
  -- Lock the row for update to prevent concurrent modifications
  SELECT credits_remaining INTO v_current_credits
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Check if user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User credits record not found';
  END IF;

  -- Check if sufficient credits
  IF v_current_credits < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits: % available, % required', v_current_credits, p_amount;
  END IF;

  -- Calculate new balance
  v_new_credits := v_current_credits - p_amount;

  -- Update credits
  UPDATE user_credits
  SET
    credits_remaining = v_new_credits,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Return new balance
  RETURN v_new_credits;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION consume_user_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_user_credits(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION consume_user_credits IS 'Atomically consume credits from user account with row-level locking to prevent race conditions';
