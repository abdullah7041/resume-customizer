-- Fix RLS Policy for user_credits table
-- Issue: The original policy didn't explicitly allow INSERT operations for service_role
-- Solution: Split into separate policies for SELECT, INSERT, UPDATE, DELETE

-- Drop the incomplete policy
DROP POLICY IF EXISTS user_credits_service_role ON public.user_credits;

-- Create separate policies for each operation
CREATE POLICY user_credits_service_role_select ON public.user_credits
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY user_credits_service_role_insert ON public.user_credits
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY user_credits_service_role_update ON public.user_credits
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY user_credits_service_role_delete ON public.user_credits
  FOR DELETE
  USING (auth.role() = 'service_role');

-- Verify the policies were created
-- SELECT * FROM pg_policies WHERE tablename = 'user_credits';
