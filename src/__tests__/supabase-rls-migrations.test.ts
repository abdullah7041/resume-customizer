import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Supabase RLS migration hardening', () => {
  it('restores UUID ownership for legacy email-keyed account tables', () => {
    const migrationSql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260602105031_restore_uuid_rls_for_legacy_account_tables.sql'),
      'utf8'
    ).toLowerCase();

    for (const tableName of [
      'user_credits',
      'credit_transactions',
      'resumes',
      'job_matches',
      'feedback',
    ]) {
      expect(migrationSql).toContain(`alter table public.${tableName} add column if not exists user_id uuid`);
      expect(migrationSql).toContain(`create index if not exists idx_${tableName}_user_id`);
      expect(migrationSql).toContain(`on public.${tableName}(user_id)`);
    }

    expect(migrationSql).toContain('create or replace function public.set_legacy_account_user_id_from_email()');
    expect(migrationSql).toContain('from auth.users');
    expect(migrationSql).toContain('revoke execute on function public.set_legacy_account_user_id_from_email()');
    expect(migrationSql).toContain('from public, anon, authenticated, service_role');
  });

  it('replaces email-claim ownership policies with auth.uid policies', () => {
    const migrationSql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260602105031_restore_uuid_rls_for_legacy_account_tables.sql'),
      'utf8'
    ).toLowerCase();

    expect(migrationSql).not.toContain("auth.jwt()->>'email'");
    expect(migrationSql).not.toContain("auth.jwt() ->> 'email'");
    expect(migrationSql).not.toContain('current_setting(\'request.jwt.claims\'');

    for (const policyName of [
      'user_credits_select_own_user_id',
      'credit_transactions_select_own_user_id',
      'resumes_select_own_user_id',
      'job_matches_select_own_user_id',
      'feedback_select_own_user_id',
    ]) {
      expect(migrationSql).toContain(`create policy "${policyName}"`);
    }

    expect(migrationSql.match(/\(select auth\.uid\(\)\) = user_id/g)?.length).toBeGreaterThanOrEqual(10);
    expect(migrationSql).toContain('(select auth.uid()) = id');
  });
});
