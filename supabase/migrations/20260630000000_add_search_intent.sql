-- Onboarding: persist job-search intent (target role / location) on the resume row.
-- See docs/onboarding-v1.md (item 1).
--
-- DO NOT auto-apply. Run this in the Supabase dashboard SQL editor.

alter table public.resumes add column if not exists search_intent jsonb;
