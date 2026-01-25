# Supabase Migration Execution Order

## Critical: Order Matters!

The credit system migrations must run in this specific order because of **table dependencies**:

```
1. user_credits table (base table)
   ↓ (other tables depend on this)
2. credit_transactions table (references user_credits via FK)
   ↓ (trigger depends on tables)
3. initialize_user_credits trigger (creates rows in user_credits)
   ↓ (other migrations reference user_credits)
4. Other migrations (referral code, feedback system, RPC functions)
```

## Migration Sequence

### Phase 1: Core Tables (MUST RUN FIRST)

| # | File | Purpose | Dependencies |
|---|------|---------|--------------|
| 1 | `20260125_create_user_credits_table.sql` | Main credit ledger | auth.users |
| 2 | `20260125_create_credit_transactions_table.sql` | Audit trail | user_credits |
| 3 | `20260125_create_credit_initialization_trigger.sql` | Auto-init trigger | user_credits |

**Why**: Tables must exist before they can be referenced by FK or triggers.

### Phase 2: Extensions (Can Run After Phase 1)

| # | File | Purpose | Dependencies |
|---|------|---------|--------------|
| 4 | `20260125_add_referral_code.sql` | Adds referral_code column | user_credits (existing) |
| 5 | `20260125_add_consume_credits_rpc.sql` | Atomic credit consumption | user_credits (existing) |
| 6 | `20260125_create_feedback_system.sql` | Feedback rewards system | user_credits, credit_transactions (existing) |

**Why**: These can run after tables exist, as they just add to them.

## How to Execute

### Using Supabase CLI (Automatic Order)

```bash
# Navigate to project root
cd /path/to/resume-customizer

# Check pending migrations
supabase migration list

# Apply all migrations (will run in filename order - which is correct!)
supabase migration up

# Or preview first
supabase migration up --dry-run
```

**Note**: Supabase CLI applies migrations in alphabetical filename order, which we've ensured by using the same date prefix (20260125) with sequential suffixes.

### Manual Execution in Supabase Dashboard

1. Go to https://app.supabase.com → Your Project → SQL Editor
2. Create new query for each file
3. Run in this order (copy-paste entire file content):

```
First:  20260125_create_user_credits_table.sql
Then:   20260125_create_credit_transactions_table.sql
Then:   20260125_create_credit_initialization_trigger.sql
Then:   20260125_add_referral_code.sql
Then:   20260125_add_consume_credits_rpc.sql
Then:   20260125_create_feedback_system.sql
```

### Verification After Each Phase

After Phase 1, verify tables exist:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('user_credits', 'credit_transactions')
ORDER BY table_name;

-- Check trigger
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_schema = 'public' AND trigger_name = 'on_auth_user_created';

-- Initialize existing users
SELECT COUNT(*) as credit_records_created
FROM user_credits;
```

After Phase 2, verify functions:

```sql
-- Check RPC functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name LIKE '%credit%'
ORDER BY routine_name;

-- Check feedback table
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('feedback');
```

## Troubleshooting Migration Failures

### Error: "relation 'user_credits' does not exist"

**Cause**: Trying to run Phase 2 migration before Phase 1

**Fix**: Run Phase 1 migrations first:
```bash
supabase migration up --type=1  # Hypothetical - run migrations 1-3 first
```

### Error: "duplicate trigger name 'on_auth_user_created'"

**Cause**: Trigger already exists from previous run

**Fix**: The migration includes `DROP TRIGGER IF EXISTS` - safe to re-run
```bash
supabase migration up  # Safe to retry
```

### Error: "ON CONFLICT not supported"

**Cause**: Using older PostgreSQL version

**Fix**: Supabase uses PostgreSQL 14+, so this shouldn't happen. If it does, you need to upgrade.

### Credits Still Show 0/15 After Migration

**Checklist**:

1. ✅ Did migration run without errors?
   ```sql
   SELECT COUNT(*) FROM user_credits;
   -- Should return > 0
   ```

2. ✅ Does the user have a credit record?
   ```sql
   SELECT * FROM user_credits WHERE user_id = 'YOUR_USER_ID';
   -- Should show 15/15
   ```

3. ✅ Is RLS blocking the query?
   ```sql
   -- Check RLS policies
   SELECT policyname FROM pg_policies WHERE tablename = 'user_credits';
   ```

4. ✅ Is the hook catching an error silently?
   - Open DevTools → Console
   - Look for `[useUserCredits]` error logs
   - Fix any auth issues

## Rollback (If Needed)

To remove tables (⚠️ WARNING: DESTRUCTIVE):

```sql
-- Drop in reverse order
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.initialize_user_credits() CASCADE;
DROP TABLE IF EXISTS public.credit_transactions CASCADE;
DROP TABLE IF EXISTS public.user_credits CASCADE;
```

**Never do this in production without backup!**

## Migration File Details

### Phase 1 Files

**20260125_create_user_credits_table.sql** (2.1 KB)
- Creates `user_credits` table with columns:
  - user_id (PK, FK to auth.users)
  - credits_remaining, credits_total
  - feedback_credits_earned, referral_credits_earned
  - last_reset_date, created_at, updated_at
- Enables RLS with 2 policies
- Creates 3 indexes

**20260125_create_credit_transactions_table.sql** (2.0 KB)
- Creates `credit_transactions` table with columns:
  - id (PK)
  - user_id (FK), feature, amount, credits_before/after
  - transaction_type (CHECK constraint)
  - metadata (JSONB), created_at
- Enables RLS with 2 policies
- Creates 3 indexes

**20260125_create_credit_initialization_trigger.sql** (2.2 KB)
- Creates `initialize_user_credits()` function
- Creates `on_auth_user_created` trigger on auth.users
- Initializes existing users (INSERT...SELECT)

### Phase 2 Files

**20260125_add_referral_code.sql** (449 B)
- ALTERs user_credits to add referral_code column
- Adds unique constraint and index

**20260125_add_consume_credits_rpc.sql** (1.5 KB)
- Creates `consume_user_credits(uuid, int)` RPC function
- Atomic row-locking for race condition prevention
- Returns new balance as INTEGER

**20260125_create_feedback_system.sql** (5.0 KB)
- Creates `feedback` table
- Enables RLS
- Creates `add_feedback_credits(uuid)` RPC function
- Adds constraints to user_credits.feedback_credits_earned

## Summary

✅ All migrations are ready in `supabase/migrations/`
✅ Filenames ensure correct execution order
✅ Each migration is idempotent (safe to re-run)
✅ RLS policies included for security
✅ Indexes created for performance

Run with: `supabase migration up`

---

**Last Updated**: 2026-01-25
**Status**: Ready for execution
