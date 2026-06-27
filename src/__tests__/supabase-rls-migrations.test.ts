import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const readMigrationSql = (fileName: string) =>
  readFileSync(join(process.cwd(), 'supabase/migrations', fileName), 'utf8')
    .replace(/\r\n?/g, '\n')
    .toLowerCase();

describe('Supabase RLS migration hardening', () => {
  it('restores UUID ownership for legacy email-keyed account tables', () => {
    const migrationSql = readMigrationSql('20260602105031_restore_uuid_rls_for_legacy_account_tables.sql');

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
    const migrationSql = readMigrationSql('20260602105031_restore_uuid_rls_for_legacy_account_tables.sql');

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

  it('repairs pipeline statuses and removes direct strategic reality browser access', () => {
    const migrationSql = readMigrationSql('20260608180535_repair_pipeline_database_integrity.sql');

    expect(migrationSql).toContain("where status = 'interview'");
    expect(migrationSql).toContain("set\n        status = 'applied'");
    expect(migrationSql).toContain('drop column if exists interview_at');
    expect(migrationSql).toContain("check (status in ('saved', 'applied', 'offer', 'rejected', 'withdrawn'))");
    expect(migrationSql).not.toContain("'interview','offer'");

    expect(migrationSql).toContain('revoke all on public.strategic_reality_checks from public, anon, authenticated');
    expect(migrationSql).toContain('grant insert, select, delete on public.strategic_reality_checks to service_role');
    expect(migrationSql).toContain('drop policy if exists "strategic_reality_checks_select_own_user_id"');
    expect(migrationSql).toContain('drop policy if exists "strategic_reality_checks_delete_own_user_id"');
  });

  it('keeps legacy account tables service-role-only until explicit archival drop', () => {
    const migrationSql = readMigrationSql('20260608180535_repair_pipeline_database_integrity.sql');

    for (const tableName of ['resumes', 'job_matches', 'feedback']) {
      expect(migrationSql).toContain(`revoke all on public.${tableName} from public, anon, authenticated`);
      expect(migrationSql).toContain(`grant select, delete on public.${tableName} to service_role`);
      expect(migrationSql).toContain(`comment on table public.${tableName}`);
    }
  });
});
