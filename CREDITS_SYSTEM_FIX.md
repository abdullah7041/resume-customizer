# Credits System Fix - Complete Documentation

## Quick Start

If you just want to fix the "0/15" credit issue:

```bash
# 1. Run these migrations
supabase migration up

# 2. Refresh your app
npm run dev:netlify

# 3. Sign in - credits should now show "15/15"
```

Done! No other changes needed.

---

## What Was the Problem?

Users were seeing **"0 / 15"** instead of **"15 / 15"** because three critical database objects were missing:

1. **user_credits table** - Stores user credit balances (never created)
2. **credit_transactions table** - Audit log of all transactions (never created)
3. **initialize_user_credits trigger** - Auto-initializes credits on signup (never created)

The code expected these to exist, but they were never created as database migrations.

---

## What Was Fixed?

Three new SQL migrations were created:

### 1. Create user_credits table
**File**: `supabase/migrations/20260125_create_user_credits_table.sql`

Creates the main credit ledger with:
- User credit balances (remaining, total)
- Tracking earned credits (feedback, referrals)
- Reset date for monthly billing cycle
- RLS policies for security
- Indexes for performance

### 2. Create credit_transactions table
**File**: `supabase/migrations/20260125_create_credit_transactions_table.sql`

Creates an audit log for all credit transactions:
- Records every credit consumption, reward, and reset
- Immutable history for compliance
- RLS policies and indexes

### 3. Create initialization trigger
**File**: `supabase/migrations/20260125_create_credit_initialization_trigger.sql`

Sets up automatic credit initialization:
- Function: `initialize_user_credits()` - runs on new signups
- Trigger: `on_auth_user_created` - fires when user is created
- Auto-initializes 15 free credits for every new user
- Initializes existing users who don't have credits yet

---

## Verification

After running migrations, verify everything worked:

### In Supabase Dashboard

Go to **SQL Editor** and run:

```sql
-- 1. Check tables exist
SELECT COUNT(*) as user_credits_rows FROM user_credits;
-- Expected: > 0 (your users)

SELECT COUNT(*) as transaction_rows FROM credit_transactions;
-- Expected: >= 0 (may be empty initially)

-- 2. Check trigger exists
SELECT COUNT(*) FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
-- Expected: 1

-- 3. Check your user
SELECT credits_remaining, credits_total FROM user_credits
WHERE user_id = '<YOUR_USER_ID>';
-- Expected: 15, 15
```

### In Your Browser

1. Start dev server: `npm run dev:netlify`
2. Sign in with your account
3. Look at the top right - should show **"15 / 15"** in green (not 0/15)
4. Click on the credit balance to open the details modal

---

## How It Works Now

### For New Users (After Migration)
1. User signs up
2. `auth.users` row created
3. `on_auth_user_created` trigger fires
4. `initialize_user_credits()` function runs
5. `user_credits` row created with 15 credits
6. User logs in
7. `useUserCredits` hook fetches and shows "15 / 15" ✓

### For Existing Users
1. Migration runs `INSERT...SELECT` to initialize all existing users
2. Every user without credits gets a record with 15 credits
3. On next login, hook fetches and shows "15 / 15" ✓

---

## File References

### Migrations (Run in order)
```
supabase/migrations/
├── 20260125_create_user_credits_table.sql
├── 20260125_create_credit_transactions_table.sql
└── 20260125_create_credit_initialization_trigger.sql
```

### Hooks (No changes needed - they work once tables exist)
```
src/hooks/useUserCredits.tsx
```

### Components (No changes needed)
```
src/components/Credits/CreditBalance.tsx
src/components/Credits/CreditUsageModal.tsx
src/components/Credits/UpgradeModal.tsx
```

### Backend (No changes needed)
```
netlify/lib/credit-manager.js
```

### Documentation
```
SUPABASE_CREDITS_DIAGNOSIS.md    <- Full technical analysis
MIGRATION_ORDER.md               <- Step-by-step migration guide
INVESTIGATION_SUMMARY.txt        <- Investigation findings
CREDITS_SYSTEM_FIX.md            <- This file
SUPABASE_SETUP.md                <- Manual setup instructions
```

---

## Troubleshooting

### I ran migrations but still see "0/15"

1. **Clear browser cache**
   - DevTools → Application → Storage → Clear site data
   - Then refresh

2. **Verify table was created**
   ```sql
   SELECT COUNT(*) FROM user_credits;
   ```
   Should return > 0

3. **Check your user has a record**
   ```sql
   SELECT * FROM user_credits WHERE user_id = '<YOUR_USER_ID>';
   ```
   Should show 15 / 15

4. **Check browser console for errors**
   - Open DevTools → Console
   - Look for `[useUserCredits]` errors
   - Report any errors

### Migration failed with "relation doesn't exist"

This means tables were created out of order. Run them in this order:

1. `20260125_create_user_credits_table.sql` first
2. `20260125_create_credit_transactions_table.sql` second
3. `20260125_create_credit_initialization_trigger.sql` third

If using Supabase CLI, it handles order automatically:
```bash
supabase migration up
```

### I want to rollback

To remove the credit system (⚠️ WARNING: DESTRUCTIVE):

```bash
supabase migration down --num 3
```

Or manually in SQL Editor:
```sql
DROP TRIGGER on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION initialize_user_credits() CASCADE;
DROP TABLE credit_transactions CASCADE;
DROP TABLE user_credits CASCADE;
```

---

## Architecture Overview

```
User Signs Up
    ↓
auth.users row created
    ↓
on_auth_user_created trigger fires
    ↓
initialize_user_credits() function runs
    ↓
user_credits row created (15 credits)
    ↓
User logs in
    ↓
useUserCredits hook fetches data
    ↓
SELECT FROM user_credits WHERE user_id = ?
    ↓
CreditBalance component displays: "15 / 15" ✓
```

---

## Feature Costs

Once credits are working, features consume credits like this:

| Feature | Cost |
|---------|------|
| Resume Parsing | FREE (0) |
| AI Match Analysis | 2 credits |
| Vision 2030 Alignment | 2 credits |
| Resume Optimization | 5 credits |
| Interview Preparation | 3 credits |
| Cover Letter Generation | 4 credits |
| Template Export | FREE (0) |

Users can earn more credits by:
- Submitting feedback (max +3 credits)
- Referring friends (+variable)
- Monthly reset (+15 credits)

---

## Next Steps

1. ✅ Run migrations: `supabase migration up`
2. ✅ Verify in dashboard (SQL queries above)
3. ✅ Test in browser: Sign in and check credits
4. ✅ Monitor logs for any errors
5. ✅ Enjoy working credit system!

---

## Questions?

Refer to these detailed documents:

- **SUPABASE_CREDITS_DIAGNOSIS.md** - Full technical analysis with SQL queries
- **MIGRATION_ORDER.md** - Detailed migration execution guide
- **INVESTIGATION_SUMMARY.txt** - Complete investigation findings

---

**Status**: ✅ Ready to Deploy
**Date**: 2026-01-25
**Migrations**: 3 new files
**Code Changes**: 0 (no app code changes needed!)
