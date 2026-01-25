# Supabase Setup Instructions

## Credit Initialization for New Users

New users should automatically get 15 free credits when they sign up. This requires a Supabase trigger.

### Step 1: Run SQL in Supabase Dashboard

1. Go to https://app.supabase.com → Your Project
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the SQL below:

```sql
-- Create function to initialize credits for new users
CREATE OR REPLACE FUNCTION public.initialize_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_credits (
    user_id,
    credits_remaining,
    credits_total,
    feedback_credits_earned,
    referral_credits_earned,
    last_reset_date,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    15,  -- Start with 15 free credits
    15,
    0,
    0,
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_credits();

-- Also initialize credits for existing users without records
INSERT INTO public.user_credits (user_id, credits_remaining, credits_total, feedback_credits_earned, referral_credits_earned, last_reset_date)
SELECT id, 15, 15, 0, 0, NOW()
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_credits)
ON CONFLICT (user_id) DO NOTHING;
```

5. Click **RUN** (or Cmd+Enter)
6. You should see a green checkmark ✓

### Step 2: Verify the Trigger Works

1. Go to **Authentication** → **Users**
2. Create a new test user (or use an existing one)
3. Go back to SQL Editor
4. Run this query to verify:

```sql
SELECT user_id, credits_remaining, credits_total FROM public.user_credits LIMIT 5;
```

You should see your user with `credits_remaining: 15` and `credits_total: 15`.

### Step 3: Test in the App

1. Start dev server: `npm run dev:netlify`
2. Sign in with your test user
3. The credits should now show **15 / 15** ✓

---

## If Credits Still Show 0/15

**Check 1: Is the user logged in?**
- Without auth, the hook returns `null` for credits
- Make sure you're signed in to Supabase Auth

**Check 2: Does the row exist in Supabase?**
- Go to **Table Editor**
- Click `user_credits` table
- Search for your user ID
- If missing, run the SQL above again

**Check 3: Clear local cache**
```bash
# Clear browser IndexedDB (Supabase cache)
# In DevTools: Application → Storage → IndexedDB → Delete
# Then refresh the page
```

---

## Background: How It Works

1. **New User Signs Up** → Auth.users row created
2. **Trigger Fires** → `initialize_user_credits()` function runs
3. **Credits Row Created** → user_credits table gets row with 15 credits
4. **Hook Fetches** → useUserCredits fetches the row and displays "15 / 15"

Without this trigger, new users would see "0 / 15" (broken).
