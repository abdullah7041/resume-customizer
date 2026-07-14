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

  it('keeps internal metadata tables service-role-only without direct browser policies', () => {
    const migrationSql = readMigrationSql('20260702000000_confirm_internal_table_service_role_boundaries.sql');

    expect(migrationSql).toContain('alter table public.ai_usage_events enable row level security');
    expect(migrationSql).toContain('alter table public.strategic_reality_checks enable row level security');

    expect(migrationSql).toContain('revoke all on public.ai_usage_events from public, anon, authenticated, service_role');
    expect(migrationSql).toContain('grant insert on public.ai_usage_events to service_role');
    expect(migrationSql).toContain('revoke all on public.strategic_reality_checks from public, anon, authenticated, service_role');
    expect(migrationSql).toContain('grant insert, select, delete on public.strategic_reality_checks to service_role');

    expect(migrationSql).not.toContain('create policy');
    expect(migrationSql).toContain('no anon/authenticated policies by design');
  });

  it('adds a covering index for the canonical UUID referral foreign key', () => {
    const migrationSql = readMigrationSql('20260703000000_index_user_credits_referral_uuid.sql');

    expect(migrationSql).toContain('create index if not exists idx_user_credits_referred_by_user_id');
    expect(migrationSql).toContain('on public.user_credits(referred_by_user_id)');
    expect(migrationSql).toContain('user_credits_referred_by_user_id_fkey');
  });

  it('backfills UUID referral relationships from legacy referral emails', () => {
    const migrationSql = readMigrationSql('20260703000002_backfill_legacy_referral_user_ids.sql');

    expect(migrationSql).toContain('update public.user_credits referee');
    expect(migrationSql).toContain('set referred_by_user_id = referrer.user_id');
    expect(migrationSql).toContain('from public.user_credits referrer');
    expect(migrationSql).toContain('lower(referee.referred_by_email::text) = lower(referrer.email::text)');
    expect(migrationSql).toContain('where referee.referred_by_user_id is null');
    expect(migrationSql).toContain('and referee.referred_by_email is not null');
  });

  it('optimizes only active feedback report RLS auth helpers behind initplans', () => {
    const migrationSql = readMigrationSql('20260703000001_optimize_feedback_reports_rls_initplans.sql');

    for (const policyName of [
      'feedback_reports_insert_own',
      'feedback_reports_admin_select',
      'feedback_reports_admin_update',
    ]) {
      expect(migrationSql).toContain(`drop policy if exists ${policyName} on public.feedback_reports`);
      expect(migrationSql).toContain(`create policy ${policyName}`);
    }

    expect(migrationSql).toContain('(select auth.uid()) = user_id');
    expect(migrationSql).toContain("user_email = ((select auth.jwt()) ->> 'email')");
    expect(migrationSql).toContain("(((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')");

    expect(migrationSql).not.toContain("select auth.jwt() ->> 'email'");
    expect(migrationSql).not.toContain("select auth.jwt() -> 'app_metadata'");
    expect(migrationSql).not.toContain('auth.jwt()->');
    expect(migrationSql).not.toContain('current_setting(');
    expect(migrationSql).not.toContain('grant ');
    expect(migrationSql).not.toContain('revoke ');

    expect(migrationSql).not.toContain('public.ai_usage_events');
    expect(migrationSql).not.toContain('public.strategic_reality_checks');
    expect(migrationSql).not.toContain('public.feedback ');
  });

  it('keeps future referral credit rows bound to the auth UUID', () => {
    const migrationSql = readMigrationSql('20260714000000_repair_referral_user_id_trigger.sql');

    expect(migrationSql).toContain('create or replace function public.initialize_user_credits()');
    expect(migrationSql).toContain('insert into public.user_credits (user_id, email, credits_remaining, credits_total)');
    expect(migrationSql).toContain('values (new.id, new.email, 15, 15)');
    expect(migrationSql).toContain('on conflict (email) do update');
    expect(migrationSql).toContain('user_id = excluded.user_id');
  });
});
