# Plan 016 (spike): User attribution on ai_usage_events to unblock the job-variant ADR

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- netlify/lib/ai-usage-logger.js netlify/lib/openrouter-client.js netlify/lib/ai-contracts/ netlify/functions/optimize.ts netlify/functions/optimize-stream.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: MED (telemetry table's privacy posture must not weaken)
- **Depends on**: none
- **Category**: direction (design/instrumentation spike)
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

`docs/adr/ADR-job-specific-resume-builder.md` (Status: Proposed) gates the entire job-variant feature on a measurable signal — §9: build Phase 1 only if "≥20–25% of users who complete one optimize run start a second optimize with a **different** JD on the same base resume within 14 days", and Action Item #1 requires confirming this is queryable **before** committing to build. It is not queryable today: `ai_usage_events` has no user column at all, and its only writer never passes one. This spike adds pseudonymous user attribution plus a JD fingerprint to optimize telemetry, and ships the kill-criteria query — turning the ADR's go/no-go from a guess into a number. It deliberately builds **no** variant feature.

## Current state

- `supabase/migrations/20260521_add_ai_usage_events.sql` (verified, full schema): columns `id, feature_name, model, provider, prompt_tokens, completion_tokens, reasoning_tokens, total_tokens, estimated_cost_usd, latency_ms, success, error_code, created_at`. **No user column.** RLS enabled; all privileges revoked from `anon`/`authenticated`; `grant insert ... to service_role` only. Comment: "Server-side logging uses SUPABASE_SERVICE_ROLE_KEY." This deny-by-default posture must be preserved.
- `netlify/lib/ai-usage-logger.js` (verified, full read) — `recordAiUsageEvent(event)`: inserts the event object into `ai_usage_events` with a 1.5s timeout race; failures logged, never thrown; honors `BENCHMARK_DISABLE_USAGE_LOGGING`.
- `netlify/lib/openrouter-client.js:80-92` (verified) — the sole call site builds the event:

  ```js
  await recordAiUsageEvent({
    feature_name: options.featureName || 'unknown',
    model, provider,
    prompt_tokens: promptTokens, completion_tokens: completionTokens,
    reasoning_tokens: reasoningTokens, total_tokens: usage.total_tokens || 0,
    estimated_cost_usd: estimatedCost, latency_ms: Date.now() - startTime,
    success, error_code: errorCode,
  });
  ```

- `netlify/lib/ai-contracts/executor.js:16-27` (verified) — `buildCallOptions(contract, options)` whitelists which options reach `callOpenRouter` (`temperature, maxTokens, timeoutMs, reasoningBudget, schemaName, featureName, responseFormat, modelId`). New fields must be added here or they're dropped.
- Callers to thread from: `netlify/functions/optimize.ts` and `optimize-stream.ts` both authenticate (`userEmail`, user id from Supabase auth) and both already compute a **cache key** = SHA-256 over (resume, JD, language, mode) via `buildCacheKey` in `netlify/lib/redis-cache.ts` — a ready-made JD-involving fingerprint. The ADR (§5, Redis section) itself points at this: "optimize v1/v2 caches already key on a SHA-256 of (resume, JD, language, mode)". Note the cache key hashes resume+JD together — for "different JD on same resume" a **JD-only** hash is needed; compute `sha256(jobDescription)` truncated to 16 hex chars separately.
- Privacy constraints (ADR §5 + repo posture): log counts/lengths/ids only — never raw JD or resume text. A user UUID (auth id) + a truncated one-way JD hash satisfy this; do NOT store email on this table.
- Env-toggle convention: plan 015 documents toggles in `.env.example`; this plan adds one (`AI_USAGE_USER_ATTRIBUTION`).
- Tests: `netlify/lib/__tests__/ai-usage-logger.test.js` and `openrouter-client.test.js` exist — extend, don't restructure.
- Migration rule: SQL files are written for the maintainer to run in the Supabase dashboard — **never applied by an agent**.

## Commands you will need

| Purpose   | Command                                                        | Expected on success |
|-----------|----------------------------------------------------------------|---------------------|
| Typecheck | `npm run type:check`                                           | exit 0              |
| Focused tests | `npx vitest run netlify/lib/__tests__/ai-usage-logger.test.js netlify/lib/__tests__/openrouter-client.test.js netlify/functions/__tests__/optimize.test.ts netlify/functions/__tests__/optimize-stream.test.ts` | all pass |
| Lint      | `npm run lint`                                                 | exit 0              |

## Scope

**In scope**:
- `supabase/migrations/20260722000000_ai_usage_user_attribution.sql` (create — file only)
- `netlify/lib/ai-usage-logger.js`, `netlify/lib/openrouter-client.js`, `netlify/lib/ai-contracts/executor.js`
- `netlify/functions/optimize.ts`, `netlify/functions/optimize-stream.ts` (option threading only)
- `.env.example` (one toggle line)
- `docs/adr/ADR-job-specific-resume-builder.md` (append the query + a one-line status note under Action Item #1)
- Test files listed above
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Any variant-feature code (store slices, UI) — the ADR explicitly gates building on this measurement.
- Other AI functions (ai-match, parse, etc.) — optimize-family attribution is sufficient for the metric; broaden later if wanted.
- Any RLS/grant loosening on `ai_usage_events` — read access stays dashboard/service-role only.
- Applying the migration.

## Git workflow

- Branch: `advisor/016-usage-attribution-spike`
- Suggested commit: `feat(telemetry): pseudonymous user + JD-hash attribution on optimize usage events`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Migration file (never apply)

Create `supabase/migrations/20260722000000_ai_usage_user_attribution.sql` (with the standard "Run this in the Supabase dashboard SQL editor" header):

```sql
alter table public.ai_usage_events
  add column if not exists user_ref uuid null,
  add column if not exists jd_fingerprint text null;
comment on column public.ai_usage_events.user_ref is
  'Supabase auth user id (pseudonymous). Nullable: guest/unattributed events.';
comment on column public.ai_usage_events.jd_fingerprint is
  'Truncated one-way SHA-256 of the job description. Never reversible to content.';
create index if not exists ai_usage_events_user_feature_idx
  on public.ai_usage_events (user_ref, feature_name, created_at)
  where user_ref is not null;
```

No grant/RLS changes.

**Verify**: file exists; nothing applied.

### Step 2: Gated event enrichment

- `ai-usage-logger.js`: no structural change needed (it inserts whatever event object it gets) — but add a guard: only include `user_ref`/`jd_fingerprint` keys when `process.env.AI_USAGE_USER_ATTRIBUTION === 'true'` (strip them otherwise). This makes deploys safe **before** the maintainer runs the migration (a Postgres insert with an unknown column fails; the logger swallows it, but then ALL usage logging silently degrades — the flag prevents that window).
- `openrouter-client.js:80-92`: extend the event with `user_ref: options.userRef || null, jd_fingerprint: options.jdFingerprint || null`.
- `executor.js` `buildCallOptions`: pass through `userRef: options.userRef` and `jdFingerprint: options.jdFingerprint`.

**Verify**: `npx vitest run netlify/lib/__tests__/ai-usage-logger.test.js netlify/lib/__tests__/openrouter-client.test.js` → pass (add cases: fields stripped when flag off; passed when on).

### Step 3: Thread from the optimize endpoints

In `optimize.ts` and `optimize-stream.ts`, where `executeAiContract`/the AI call is invoked with options (find the `featureName` option they already pass — same call), add `userRef: <authenticated user id or null>` and `jdFingerprint: sha256hex(jobDescription).slice(0, 16)` (use node `crypto.createHash('sha256')`; guests → still fingerprint the JD, `userRef` null). Use the auth user's **UUID**, not email.

**Verify**: `npx vitest run netlify/functions/__tests__/optimize.test.ts netlify/functions/__tests__/optimize-stream.test.ts` → pass unchanged (options additions are transparent to response shape); `npm run type:check` → 0.

### Step 4: The kill-criteria query

Append to the ADR under Action Item #1 (and duplicate in the migration file as a comment) the measurement query, e.g.:

```sql
-- Repeat re-targeting rate (ADR §9): of users with ≥1 successful optimize event,
-- the share with ≥2 DISTINCT jd_fingerprints within any 14-day window.
with optimizers as (
  select user_ref, jd_fingerprint, created_at
  from ai_usage_events
  where feature_name in ('optimize', 'optimize_stream')  -- match the real featureName values: verify via `select distinct feature_name`
    and success and user_ref is not null and jd_fingerprint is not null
),
firsts as (select user_ref, min(created_at) as first_at from optimizers group by user_ref)
select
  count(*) filter (where retargeted) as retargeting_users,
  count(*) as measured_users,
  round(100.0 * count(*) filter (where retargeted) / greatest(count(*), 1), 1) as pct
from (
  select f.user_ref,
    (select count(distinct o.jd_fingerprint) from optimizers o
      where o.user_ref = f.user_ref and o.created_at <= f.first_at + interval '14 days') >= 2 as retargeted
  from firsts f
  where f.first_at <= now() - interval '14 days'
) t;
```

Adjust `feature_name` values to what the contracts actually set (grep `featureName` in `netlify/lib/ai-contracts/contracts/index.js`). Add one status line under Action Item #1: "Instrumentation shipped <date> (plan 016); metric computable ~14 days after the maintainer applies migration 20260722000000 and sets `AI_USAGE_USER_ATTRIBUTION=true`."

**Verify**: query included in both places; `feature_name` values match the contracts file (quote the grep evidence in your report).

### Step 5: Document the toggle

Add `AI_USAGE_USER_ATTRIBUTION=` (empty default, comment: "set true AFTER applying migration 20260722000000") to `.env.example`. Coordinate with plan 015's edits if both run (trivial append merge).

**Verify**: `grep -n "AI_USAGE_USER_ATTRIBUTION" .env.example` → present, no value.

## Test plan

- ai-usage-logger: flag off → inserted event has no `user_ref`/`jd_fingerprint` keys; flag on → passed through.
- openrouter-client: event carries `user_ref`/`jd_fingerprint` from options; absent options → nulls.
- optimize/optimize-stream suites unchanged and green (threading is response-invisible).
- Pattern: existing tests in each file.

## Done criteria

- [ ] Migration file exists, unapplied, with the query comment
- [ ] `grep -n "jd_fingerprint" netlify/lib/openrouter-client.js netlify/lib/ai-usage-logger.js netlify/lib/ai-contracts/executor.js` → all three thread it
- [ ] Neither raw JD nor email appears anywhere in the event payload (`grep -n "jobDescription" netlify/lib/ai-usage-logger.js` → no match; `user_ref` is a UUID)
- [ ] Focused vitest runs + `npm run type:check` + `npm run lint` all exit 0
- [ ] ADR Action Item #1 carries the query + status line
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The optimize endpoints don't call through `executeAiContract`/`buildCallOptions` (e.g. a direct `callOpenRouter` path) — map the real call chain first and report if it diverges from "Current state".
- You'd need to loosen any grant/policy on `ai_usage_events` to make something work — never; that table stays write-only from service role.
- The `featureName` values for optimize contracts are absent/ambiguous in `contracts/index.js`.
- Anyone (including plan text elsewhere) suggests applying the migration — file only.

## Maintenance notes

- **Deploy order**: code (flag off) → maintainer applies migration → maintainer sets `AI_USAGE_USER_ATTRIBUTION=true` in Netlify env → data accrues → run the query after ≥14 days → ADR go/no-go.
- The JD-only fingerprint is intentionally NOT the Redis cache key (that hash mixes in the resume); don't "reuse" it later without re-reading the metric definition.
- If the metric clears the ADR threshold, the variant Phase 1 plan should come back through `/improve plan` with the ADR as its design doc; if it doesn't clear, the ADR's kill criteria say shelve it — either way this table now answers per-feature cost-per-user questions too.
