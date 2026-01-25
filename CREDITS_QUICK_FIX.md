# Quick Fix: Credits Show 0/15

## Problem
Users see "0/15 credits" in the header even though they should have 15/15.

## Root Cause
The **`initialize_user_credits` trigger** (which auto-assigns 15 credits on signup) was **never created**. You created the table manually via Supabase UI, but the trigger is missing.

## Solution: 2 Steps

### Step 1: Run Migrations
```bash
supabase migration up
```

This will:
- ✅ Create the `on_auth_user_created` trigger on auth.users
- ✅ Auto-initialize 15 credits for all new users
- ✅ Initialize existing users with 15 credits
- ✅ Create credit_transactions audit table

### Step 2: Verify in App
```bash
npm run dev:netlify
```

1. Sign in with your user
2. Header should now show **"15 / 15"** (not 0/15) ✅
3. Click on credits to see the details

---

## What the Migration Does

**File**: `supabase/migrations/20260126_create_credit_initialization_trigger.sql`

1. **Creates function** `initialize_user_credits()`
   - Runs automatically when a new user signs up
   - Inserts a row in `user_credits` with 15 credits
   - Sets `last_reset_date` to TODAY

2. **Creates trigger** `on_auth_user_created` on auth.users
   - Fires AFTER each new user signup
   - Calls `initialize_user_credits()`

3. **Initializes existing users**
   - Any user already signed up without credits gets 15 credits
   - Uses `ON CONFLICT...DO NOTHING` to prevent duplicates

---

## Verify It Worked

Run this in **Supabase SQL Editor**:

```sql
-- Check trigger exists
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
-- Expected: 1 row (trigger found)

-- Check user credits
SELECT user_id, credits_remaining, credits_total
FROM user_credits LIMIT 5;
-- Expected: All show 15 / 15
```

---

## If Credits Still Show 0/15

**Option 1: Clear Browser Cache**
- Open DevTools → Application → Storage → IndexedDB → Delete
- Refresh page

**Option 2: Check Supabase Logs**
- Go to Supabase Dashboard → Functions → View Logs
- Look for `initialize_user_credits` errors

**Option 3: Run Migrations Again**
```bash
supabase migration repair
supabase migration up
```

---

## What Changed

| Before | After |
|--------|-------|
| "0 / 15" 😞 | "15 / 15" ✅ |
| New users stuck | New users auto-get 15 credits |
| No audit trail | Credit transactions logged |

---

## Next Steps

After migrations run:
1. ✅ Test with existing user → Should show 15/15
2. ✅ Test signup with new user → Should auto-get 15/15
3. ✅ Try features (optimize, match) → Credits should deduct
4. ✅ Check upgrade modal appears → At 0 credits

Then you can run `npm run quality:check` and commit:
```bash
git add -A
git commit -m "feat: apply credit initialization migration (fixes 0/15 display)"
```
