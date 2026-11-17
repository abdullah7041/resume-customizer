-- Owner applies this additive migration. Existing consent remains followed-only.
alter table public.job_alert_preferences
 add column if not exists scope text not null default 'followed' check (scope in ('followed','catalogue')),
 add column if not exists last_completed_check_at timestamptz,
 add column if not exists last_outcome text check (last_outcome in ('empty','accepted','failed','setup_required')),
 add column if not exists last_provider_accepted_at timestamptz;

-- checked_at remains the scheduling claim, never evidence of a completed check.
comment on column public.job_alert_preferences.last_provider_accepted_at is 'Provider accepted the email request; this does not prove inbox delivery.';
