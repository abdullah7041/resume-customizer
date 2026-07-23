# Plan 007: Use constant-time comparison for the admin secret

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- netlify/lib/admin-gates.ts netlify/lib/__tests__/admin-gates.test.ts`
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

> **Scope note (read this first — the plan was narrowed during review):** an
> earlier draft of this plan ALSO tightened the scheduled-function cron gate to
> require `CRON_SECRET` (finding SEC-07). That change was **removed** after
> verifying a platform fact: Netlify scheduled functions **cannot be invoked
> via a public URL in production** (Netlify docs: "You can't invoke scheduled
> functions directly with a URL"). So the `x-netlify-internal-functions`
> header-only path is not externally reachable — SEC-07 is not exploitable — and
> requiring `CRON_SECRET` would have *broken* the crons, because the native
> Netlify scheduler cannot attach a custom `x-cron-secret` header. **Do NOT
> modify `requireScheduledFunctionGate` in this plan.** See
> `plans/README.md` → "Rejected / confirmed clean this round" for the full
> rationale. This plan now covers only the constant-time admin-secret fix
> (SEC-08).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (behavior-preserving swap)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

The `ADMIN_SECRET` that guards `dev-reset-credits`, `dev-celebration-bonus`, and
`notify-waitlist` (mass credit mutation + mass email) is compared with a plain
JavaScript `!==` at `admin-gates.ts:101`, which short-circuits on the first
differing character — a theoretical timing side-channel. The same file already
defines and uses a constant-time helper (`timingSafeEqualStrings`) for the cron
secret, so the admin path is inconsistent with the file's own established
pattern. Remote exploitation is impractical (network jitter dwarfs the signal),
but this is a trivially fixable defense-in-depth gap with the safe primitive
already present one function away.

After this plan: both secret comparisons in `admin-gates.ts` are constant-time.

## Current state

Relevant file:

- `netlify/lib/admin-gates.ts` — auth gates for scheduled/admin functions.
  - `timingSafeEqualStrings(a, b)` helper at lines 44–48 (already present; hashes
    both inputs to a fixed 32-byte SHA-256 digest, so it is safe on unequal-length
    inputs).
  - `requireAdminMutationGate` at lines 76–110, with the non-constant-time
    compare at line 101.
- `netlify/lib/__tests__/admin-gates.test.ts` — existing tests for both gates.

Callers of `requireAdminMutationGate` (do not modify — the gate's signature and
return type are unchanged): `netlify/functions/dev-reset-credits.ts:18`,
`netlify/functions/dev-celebration-bonus.ts:23`,
`netlify/functions/notify-waitlist.ts:38`.

Excerpts as of commit `ceed480`:

`netlify/lib/admin-gates.ts:44-48`:
```ts
function timingSafeEqualStrings(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}
```

`netlify/lib/admin-gates.ts:92-109` (the block to change is line 101):
```ts
  const configuredSecret = getConfiguredAdminSecret();
  if (!configuredSecret) {
    return {
      ok: false,
      statusCode: 500,
      error: 'Admin secret is not configured',
    };
  }

  if (getRequestAdminSecret(event) !== configuredSecret) {
    return {
      ok: false,
      statusCode: 401,
      error: 'Unauthorized',
    };
  }

  return { ok: true };
```

Conventions: `[ComponentName]` log prefixes; never log secret values.
`createHash`/`timingSafeEqual` are already imported from `node:crypto` at line 2 —
no new imports needed.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run type:check` | exit 0, no errors |
| Focused tests | `npm run test -- netlify/lib/__tests__/admin-gates.test.ts` | all pass |
| Lint | `npm run lint:fix` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `netlify/lib/admin-gates.ts` — line 101 comparison only.
- `netlify/lib/__tests__/admin-gates.test.ts` — confirm/extend the admin-gate
  cases.

**Out of scope** (do NOT touch):
- `requireScheduledFunctionGate` (lines 50–74) — leave it exactly as-is (see the
  Scope note at the top; the cron change was deliberately removed).
- Any function under `netlify/functions/` — the gate signature is unchanged.
- `.env.example` — no new env var is introduced by this plan.
- The `isLocalDevelopment()` bypass and the `getConfiguredAdminSecret()` guard —
  leave both unchanged.

## Git workflow

- Branch: `advisor/007-constant-time-admin-secret`
- Single commit; message e.g. `fix: use constant-time comparison for admin secret`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make the admin-secret comparison constant-time

Replace the plain `!==` compare at line 101 with the constant-time helper already
in the file. Target shape:

```ts
  const provided = getRequestAdminSecret(event);
  if (!provided || !timingSafeEqualStrings(provided, configuredSecret)) {
    return {
      ok: false,
      statusCode: 401,
      error: 'Unauthorized',
    };
  }
```

Keep the surrounding `getConfiguredAdminSecret()` guard (the `500` branch) and
the final `return { ok: true }` unchanged. The `statusCode` for a wrong secret
must stay `401`.

**Verify**: `npm run type:check` → exit 0; `npm run lint:fix` → exit 0.

### Step 2: Confirm the admin-gate tests still pass (extend if thin)

The change is behavior-preserving, so the existing `requireAdminMutationGate`
tests in `netlify/lib/__tests__/admin-gates.test.ts` should stay green. Confirm
these cases exist (add any that are missing, modeled on the file's existing
`buildEvent` helper and setup/teardown that restores `process.env`):

- Correct `x-admin-secret` (with the allow-flag env var set where the existing
  tests require it, and a configured `ADMIN_SECRET`) → `ok === true`.
- Wrong `x-admin-secret` → `ok === false`, `statusCode === 401`.
- Missing `x-admin-secret` header → `ok === false`, `statusCode === 401`.

Do NOT hardcode a real secret — any placeholder string works for the test.

**Verify**: `npm run test -- netlify/lib/__tests__/admin-gates.test.ts` → all pass.

## Test plan

- Confirm/extend the three `requireAdminMutationGate` cases in Step 2. The
  wrong-secret and missing-secret cases together prove the constant-time swap
  preserved the reject path and its `401` status.
- Structural pattern: reuse the existing `buildEvent(...)` helper and
  describe/it blocks already in the file.
- Verification: `npm run test -- netlify/lib/__tests__/admin-gates.test.ts` →
  all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run type:check` exits 0
- [ ] `npm run lint` exits 0 on `netlify/lib/admin-gates.ts`
- [ ] `npm run test -- netlify/lib/__tests__/admin-gates.test.ts` passes
- [ ] `grep -n "!== configuredSecret" netlify/lib/admin-gates.ts` returns no
      matches (the plain compare is gone)
- [ ] `grep -n "timingSafeEqualStrings" netlify/lib/admin-gates.ts` shows it used
      in BOTH the cron path and the admin path
- [ ] `git diff netlify/lib/admin-gates.ts` shows NO change to
      `requireScheduledFunctionGate`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match the live code (drift since
  `ceed480`).
- Any existing admin-gates test fails after Step 1 and the failure is NOT simply
  a stale expectation you can correctly update to match constant-time behavior —
  report it rather than loosening the gate to make a test pass.
- You are tempted to also change `requireScheduledFunctionGate` — do not; that is
  explicitly out of scope for the reason documented in the Scope note.

## Maintenance notes

- Reviewer should confirm the swap did not change the returned `statusCode` for
  the wrong-secret case (still `401`) and that `requireScheduledFunctionGate` is
  untouched.
- Context for future maintainers: the scheduled-function gate's header-only path
  is intentional and safe — Netlify does not expose scheduled functions to public
  URL invocation, so the `x-netlify-internal-functions` header cannot be spoofed
  from outside. Do NOT "harden" that gate by requiring `CRON_SECRET`: the native
  scheduler cannot send a custom header, so requiring the secret would 403 the
  real scheduled runs and silently disable `cron-reset-credits` and
  `cron-monthly-summary`. (Plan 005's maintenance note suggesting the header-only
  branch be removed once `CRON_SECRET` is set is incorrect for the same reason.)
