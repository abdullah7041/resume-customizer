# Supabase User Credits System - Root Cause Analysis

## Executive Summary

Credits show as **0/15** when they should show **15/15** because the required database tables and trigger do **not exist**. Three critical pieces were missing from the codebase:

1. **user_credits table** - Main credit ledger (referenced but never created)
2. **credit_transactions table** - Audit log (referenced but never created)
3. **initialize_user_credits trigger** - Auto-initialization on signup (documented but not implemented)

## Diagnosis

### What the Code Expects (But Doesn't Have)

The application assumes three database objects exist:

| Object | File | Purpose | Status |
|--------|------|---------|--------|
| `user_credits` table | Entire credit system | Store user balances | ❌ MISSING |
| `credit_transactions` table | `credit-manager.js`, feedback system | Audit trail | ❌ MISSING |
| `initialize_user_credits()` trigger | SUPABASE_SETUP.md (doc only) | Auto-init on signup | ❌ MISSING |

### Evidence Trail

#### 1. useUserCredits Hook Tries to Fetch Non-Existent Table
**File**: `src/hooks/useUserCredits.tsx` (Line 36-48)

```typescript
const { data, error: fetchError } = await supabase
  .from('user_credits')  // ← Table doesn't exist!
  .select('credits_remaining, credits_total, feedback_credits_earned, referral_credits_earned, last_reset_date')
  .eq('user_id', user.id)
  .single();
```

**Error Response**: `PGRST116 - "One or more rows returned"` or missing table error

#### 2. Credit Manager Falls Back to Insert (Catches Missing Table Error)
**File**: `netlify/lib/credit-manager.js` (Lines 45-66)

```javascript
if (error) {
  // If user doesn't exist, initialize their credits
  if (error.code === 'PGRST116') {
    console.log(`[CreditManager] Initializing credits for user ${userId}`);
    const { data: newCredits, error: insertError } = await supabase
      .from('user_credits')  // ← Still trying to insert to non-existent table!
      .insert({...})
      .single();
  }
}
```

**Result**: INSERT fails silently → Credits return as `null` → Hook shows nothing → UI defaults to "0/15"

#### 3. Referral Migration Tries to ALTER Non-Existent Table
**File**: `supabase/migrations/20260125_add_referral_code.sql` (Line 3)

```sql
ALTER TABLE user_credits
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
```

**Status**: This migration never runs because the table doesn't exist

#### 4. Feedback System Inserts to Non-Existent Transactions Table
**File**: `supabase/migrations/20260125_create_feedback_system.sql` (Lines 99-115)

```sql
INSERT INTO credit_transactions (...)  -- ← Table doesn't exist!
```

**Status**: Transaction logging silently fails (non-fatal, but breaks audit trail)

### The Missing Trigger (Documented But Not Implemented)

**File**: `SUPABASE_SETUP.md` - Contains complete SQL but never run:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_credits();
```

**Status**: Manual setup document exists, but trigger never created in database

## SQL Diagnostic Queries

Run these in Supabase Dashboard → SQL Editor to verify the problem:

### Query 1: Check if user_credits table exists
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'user_credits'
);
-- Expected: FALSE (table is missing!)
```

### Query 2: Check if credit_transactions table exists
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'credit_transactions'
);
-- Expected: FALSE (table is missing!)
```

### Query 3: Check if initialize_user_credits trigger exists
```sql
SELECT trigger_name, event_object_table, trigger_definition
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
AND event_object_schema = 'public';
-- Expected: No rows (trigger is missing!)
```

### Query 4: Check all existing users (if you added them manually)
```sql
SELECT id, email, created_at FROM auth.users;
-- These users have no credit records because:
-- 1. The table doesn't exist
-- 2. The trigger doesn't exist
```

## Why "0/15" Appears

Flow when user logs in:

```
1. useUserCredits hook runs
   ↓
2. Tries: SELECT FROM user_credits WHERE user_id = ?
   ↓
3. Error: "relation 'user_credits' does not exist"
   ↓
4. Hook catches error and returns null
   ↓
5. CreditBalance component shows nothing OR defaults to "0/15"
   ↓
6. User sees broken state
```

## Solution: Create Missing Database Objects

Three new migrations have been created in `supabase/migrations/`:

1. **20260125_create_user_credits_table.sql** - Main credit ledger
2. **20260125_create_credit_transactions_table.sql** - Audit log
3. **20260125_create_credit_initialization_trigger.sql** - Auto-init trigger

### How to Apply Migrations

#### Option A: Using Supabase CLI (Recommended)
```bash
supabase migration list          # See all migrations
supabase migration up            # Apply all pending migrations
supabase migration up --dry-run  # Preview without applying
```

#### Option B: Manual SQL in Dashboard (For Testing)

Run in order:

1. **Create user_credits table**
   - Go to SQL Editor → New Query
   - Copy content from `supabase/migrations/20260125_create_user_credits_table.sql`
   - Click RUN

2. **Create credit_transactions table**
   - New Query
   - Copy content from `supabase/migrations/20260125_create_credit_transactions_table.sql`
   - Click RUN

3. **Create initialization trigger**
   - New Query
   - Copy content from `supabase/migrations/20260125_create_credit_initialization_trigger.sql`
   - Click RUN

### Verification After Migration

```sql
-- 1. Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'user_%';
-- Expected: user_credits, user_audit_log

-- 2. Verify trigger exists
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_schema = 'public' AND trigger_name = 'on_auth_user_created';
-- Expected: on_auth_user_created

-- 3. Check existing users got credits
SELECT user_id, credits_remaining, credits_total FROM user_credits LIMIT 5;
-- Expected: All existing users have 15 / 15

-- 4. Create new test user and verify trigger works
-- (In Auth dashboard, create a new user)
-- Then run: SELECT * FROM user_credits WHERE user_id = 'NEW_USER_ID';
-- Expected: 15 credits automatically assigned
```

## Root Cause Summary

| Issue | Cause | Impact | Fix |
|-------|-------|--------|-----|
| No `user_credits` table | Never created in migrations | Hook can't fetch credits | Create table + RLS |
| No `credit_transactions` table | Never created in migrations | Can't log transactions | Create table + RLS |
| No `initialize_user_credits` trigger | Manual setup only in docs | New users get 0 credits | Create trigger + function |
| Existing users show 0/15 | Tables didn't exist when they signed up | No credit records exist | Run initialization SQL |

## Files Modified/Created

### New Migrations Created
- `supabase/migrations/20260125_create_user_credits_table.sql` (2.1 KB)
- `supabase/migrations/20260125_create_credit_transactions_table.sql` (2.0 KB)
- `supabase/migrations/20260125_create_credit_initialization_trigger.sql` (2.2 KB)

### Documentation
- This file: `SUPABASE_CREDITS_DIAGNOSIS.md`

### Existing Files (No Changes Needed)
- `src/hooks/useUserCredits.tsx` - Works correctly once tables exist
- `netlify/lib/credit-manager.js` - Works correctly once tables exist
- `src/components/Credits/CreditBalance.tsx` - Works correctly once data available
- `SUPABASE_SETUP.md` - Already has correct manual instructions

## Next Steps

1. **Run migrations** using Supabase CLI or Dashboard
2. **Verify** using the diagnostic queries above
3. **Test** by creating a new user and checking they get 15/15 credits
4. **Monitor** browser console for `[useUserCredits]` logs

## Testing Checklist

- [ ] User signs up → Gets 15/15 credits automatically (trigger works)
- [ ] Header shows "15 / 15" in green (data visible)
- [ ] Clicking credits opens CreditUsageModal
- [ ] Feature costs correctly deduct credits
- [ ] Credit transactions logged to `credit_transactions` table
- [ ] Existing users with 0 credits can be manually initialized via SQL

---

**Created**: 2026-01-25
**Diagnosis Tool**: Claude Code with Supabase MCP
**Status**: Ready for migration to production database
