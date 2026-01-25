-- Create feedback system tables and functions (Session 11-12)
-- Implements feedback submission, credit awards, and constraints

-- ============================================
-- 1. CREATE FEEDBACK TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji_rating TEXT NOT NULL CHECK (emoji_rating IN ('love', 'happy', 'neutral', 'sad', 'terrible')),
  testimonial_text TEXT,
  context TEXT,
  credit_awarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX idx_feedback_emoji_rating ON feedback(emoji_rating);

-- ============================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own feedback
CREATE POLICY feedback_select_own ON feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own feedback
CREATE POLICY feedback_insert_own ON feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Service role can do anything (for admin operations)
CREATE POLICY feedback_service_role ON feedback
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 3. CREATE ADD_FEEDBACK_CREDITS RPC FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION add_feedback_credits(
  p_user_id UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_feedback_credits_earned INTEGER;
  v_credits_remaining INTEGER;
  v_credits_total INTEGER;
  v_max_feedback_credits CONSTANT INTEGER := 3;
  v_result JSON;
BEGIN
  -- Lock the row for update to prevent concurrent modifications
  SELECT
    feedback_credits_earned,
    credits_remaining,
    credits_total
  INTO
    v_feedback_credits_earned,
    v_credits_remaining,
    v_credits_total
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Check if user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User credits record not found';
  END IF;

  -- Check if max feedback credits already reached (hard constraint)
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

  -- Award 1 credit and increment feedback_credits_earned
  v_credits_remaining := v_credits_remaining + 1;
  v_feedback_credits_earned := v_feedback_credits_earned + 1;

  -- Update user_credits
  UPDATE user_credits
  SET
    credits_remaining = v_credits_remaining,
    feedback_credits_earned = v_feedback_credits_earned,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log transaction
  INSERT INTO credit_transactions (
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

  -- Return success response
  v_result := jsonb_build_object(
    'success', true,
    'credits_awarded', 1,
    'feedback_credits_earned', v_feedback_credits_earned,
    'credits_remaining', v_credits_remaining
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION add_feedback_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_feedback_credits(UUID) TO service_role;

COMMENT ON FUNCTION add_feedback_credits IS 'Atomically award +1 credit for positive feedback, with max 3 lifetime constraint. Returns JSON with success status and credit information.';

-- ============================================
-- 4. ADD CONSTRAINTS TO user_credits TABLE
-- ============================================

-- Add constraint to prevent more than 3 feedback credits (if column doesn't have constraint yet)
ALTER TABLE user_credits
ADD CONSTRAINT check_feedback_credits_max CHECK (feedback_credits_earned <= 3);

-- Create index for faster queries on feedback credits
CREATE INDEX IF NOT EXISTS idx_user_credits_feedback_earned ON user_credits(feedback_credits_earned);
