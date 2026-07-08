# Plan 005: Harden abuse-facing surfaces (cron gate, batch beta gate, dead parse endpoints, email HTML escaping)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat baebbd7..HEAD -- netlify/lib/admin-gates.ts netlify/functions/batch-api.ts netlify/functions/parse-arabic-resume.ts netlify/lib/email-templates.js netlify/lib/rate-limiter.ts`
> On any mismatch with the "Current state" excerpts, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (one decision point requires a platform-behavior check; escape hatches below)
- **Depends on**: none
- **Category**: security (defensive hardening)
- **Planned at**: commit `baebbd7`, 2026-07-08

## Why this matters

Four independent, small hardening gaps on internet-facing surfaces:

1. **Cron gate**: the scheduled functions (`cron-reset-credits`, `cron-monthly-summary`) are authorized solely by the request header `x-netlify-internal-functions: true`. If that header is deliverable by an external caller on this platform, anyone can reset every user's credits to the free-tier amount and mass-send branded emails (Resend cost + sender-reputation damage). The repo's own trigger doc (`netlify/functions/scheduled-functions.md:105-109`) shows a bearer-token curl for production — an auth check the code never implements.
2. **Batch beta gate**: removed by owner request. Child tasks are protected by their own JWT checks.
3. **Dead parse surface**: `parse-arabic-resume.ts` has no caller anywhere in the repo (frontend parses via `extract-resume-json`; `batch-api` maps `parse` to `parse-resume`). Dead deployed functions are unmonitored attack/maintenance surface.
4. **Email HTML injection**: `email-templates.js` interpolates `${userName}` (user-set `full_name` signup metadata) into HTML emails with no escaping.

Deliberately NOT in this plan: `parse-resume.ts`'s lack of auth. Guest (unauthenticated) parsing is a product feature — `extract-resume-json.ts:58-88` explicitly allows an unauthenticated guest-preview path with stricter rate limits — so unauthenticated parse is by-design, not a defect. The `parse-resume.ts` question is whether it should exist at all (see Step 3's escape hatch).

## Current state

Relevant files:

- `netlify/lib/admin-gates.ts` — auth gates for scheduled/admin functions. `requireScheduledFunctionGate` at lines 43–54.
- `netlify/functions/cron-reset-credits.ts` (gate call at line 22) and `netlify/functions/cron-monthly-summary.ts` (gate call ~line 29) — both scheduled natively via `netlify.toml:79-85` (`schedule = "0 23 * * *"` and `"0 7 28 * *"`).
- `netlify/functions/batch-api.ts` — beta gate at lines 181–187; endpoint map at lines 38–44.
- `netlify/functions/parse-arabic-resume.ts` — dead function; only references are its own test and a rate-limit config entry at `netlify/lib/rate-limiter.ts:292`.
- `netlify/lib/email-templates.js` — HTML email builders; unescaped `${userName}` interpolations (first at ~line 50: `<p style="...">Hi <strong>${userName}</strong>,</p>`).
- `netlify/lib/email-service.js` — passes `userName` into the templates.

Excerpts as of commit `baebbd7`:

`netlify/lib/admin-gates.ts:43-54`:
```ts
export function requireScheduledFunctionGate(event: HandlerEvent): GateResult {
  const isScheduledCall = getHeader(event, 'x-netlify-internal-functions') === 'true';
  if (isScheduledCall || isLocalDevelopment()) {
    return { ok: true };
  }

  return {
    ok: false,
    statusCode: 403,
    error: 'Unauthorized',
  };
}
```

`netlify/functions/batch-api.ts:38-44` (endpoint map — `parse` maps to the legacy function, not the live one):
```ts
const INTERNAL_ENDPOINTS: Record<TaskType, string> = {
  parse: "/.netlify/functions/parse-resume",
  optimize: "/.netlify/functions/optimize",
  "predict-questions": "/.netlify/functions/predict-questions",
  "generate-cover-letter": "/.netlify/functions/generate-cover-letter",
};
```
Note: `grep -rn "batch-api" src/` returns nothing — the shipped frontend never calls `batch-api` (it was built for beta/API users).

`netlify/lib/email-templates.js:~50`:
```js
<p style="color: #333; font-size: 16px;">Hi <strong>${userName}</strong>,</p>
```
`grep -n "escape\|sanitiz" netlify/lib/email-templates.js` → no matches (no escaping helper exists in the file).

Conventions: gates live in `admin-gates.ts` (see `requireAdminMutationGate` in the same file, which already rejects unsafe default secrets — use it as the style exemplar); `[ComponentName]` log prefixes; never log secret values.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run type:check` | exit 0 |
| Focused tests | `npm run test -- netlify/lib/__tests__ netlify/functions/__tests__/batch-api.test.ts` | all pass (adjust to actual test filenames found) |
| Lint | `npm run lint:fix` | exit 0 |

## Scope

**In scope**:
- `netlify/lib/admin-gates.ts`
- `netlify/functions/batch-api.ts`
- `netlify/functions/parse-arabic-resume.ts` (delete) + its test file + `netlify/lib/rate-limiter.ts:292` (remove the one config entry ONLY)
- `netlify/lib/email-templates.js`
- `.env.example` (document the two new env vars)
- `CLAUDE.md` (remove `parse-arabic-resume` from the functions list in "Key File Locations" if present)
- Corresponding test files

**Out of scope**:
- `netlify/functions/parse-resume.ts` — do not delete or add auth in this plan (see Step 3 escape hatch; deletion needs an owner decision about external beta callers).
- `netlify/functions/extract-resume-json.ts` — guest parsing is by-design.
- Any other entry in `rate-limiter.ts` beyond the single `parse-arabic-resume` config line.
- `waitlist-confirm.ts` CAPTCHA (separate, unplanned finding).

## Git workflow

- Branch: `advisor/005-harden-abuse-surfaces`
- Commit per step (4 logical units). Short imperative subjects.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a secret-based path to the scheduled-function gate

In `netlify/lib/admin-gates.ts`, extend `requireScheduledFunctionGate`:

```ts
export function requireScheduledFunctionGate(event: HandlerEvent): GateResult {
  const isScheduledCall = getHeader(event, 'x-netlify-internal-functions') === 'true';
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = getHeader(event, 'x-cron-secret');
  const secretMatches = Boolean(
    cronSecret && providedSecret && timingSafeEqualStrings(providedSecret, cronSecret)
  );

  if (secretMatches || isLocalDevelopment()) {
    return { ok: true };
  }
  if (isScheduledCall) {
    if (!cronSecret) {
      // Back-compat: header-only until CRON_SECRET is configured.
      console.warn('[AdminGates] Scheduled call accepted via header only — set CRON_SECRET to harden');
      return { ok: true };
    }
    return { ok: true }; // platform-scheduled invocation
  }
  return { ok: false, statusCode: 403, error: 'Unauthorized' };
}
```

Add a `timingSafeEqualStrings(a, b)` helper in the same file using `crypto.timingSafeEqual` over equal-length buffers (return false on length mismatch — compare hashes of both inputs, e.g. `timingSafeEqual(sha256(a), sha256(b))`, to avoid length leaks).

Rationale for keeping the header path: these functions are natively scheduled (`netlify.toml:79-85`) and Netlify's own scheduler cannot send a custom secret header. The secret path exists for the documented manual production trigger, and the warning makes the header-only state visible in logs.

Also add `CRON_SECRET=change-me-in-production` under "Optional Services" in `.env.example` with a one-line comment ("manual trigger auth for cron-* functions").

**Verify**: `npm run type:check` → exit 0. If `netlify/lib/__tests__/admin-gates.test.ts` exists, extend it: valid secret → ok; wrong secret without header → 403; header without secret configured → ok (with warning).

### Step 2: Remove the batch beta gate

In `netlify/functions/batch-api.ts`, remove the `X-Beta-Code` extraction and validation entirely. Do not forward `X-Beta-Code` to child endpoints. The shipped frontend does not call `batch-api`, and child tasks keep their own auth/JWT checks.

Additionally, remove the `parse` entry from `TaskType`/`INTERNAL_ENDPOINTS` (lines 38–44) **only if** `grep -rn '"parse"' src/` and `grep -rn "'parse'" src/` show no batch-task usage (expected — the frontend never calls batch-api). If any usage appears, leave the map alone and note it in your report.

**Verify**: `npm run test -- netlify/functions/__tests__/batch-api.test.ts` (if present) → pass; add tests: request with no `X-Beta-Code` reaches normal request validation; request with a stale `X-Beta-Code` header also reaches normal request validation.

### Step 3: Delete the dead parse-arabic-resume function

1. Confirm deadness: `grep -rn "parse-arabic-resume" src/ netlify/ --include="*.ts" --include="*.js" --include="*.tsx"` → expected matches ONLY in `netlify/functions/parse-arabic-resume.ts`, its test file, and `netlify/lib/rate-limiter.ts:292`.
2. Delete `netlify/functions/parse-arabic-resume.ts` and its test (`netlify/functions/__tests__/parse-arabic-resume.test.ts` or similar — locate by glob).
3. Remove the `"parse-arabic-resume": { ... }` entry from `ENDPOINT_RATE_LIMITS` in `netlify/lib/rate-limiter.ts` (~line 292). Touch nothing else in that file.
4. If `CLAUDE.md`'s "Key File Locations" functions list names `parse-arabic-resume`, remove that name from the list.

ESCAPE HATCH: if step 3.1's grep shows any OTHER caller (or a route rewrite in `netlify.toml` referencing it), STOP and report instead of deleting. Do NOT extend this step to `parse-resume.ts` — flag it in your report as "candidate for the same treatment pending owner confirmation of external beta/API callers".

**Verify**: `npm run type:check` → exit 0; `npm run test` scoped to `netlify/` → pass; `grep -rn "parse-arabic-resume" netlify/ src/` → no matches.

### Step 4: Escape interpolated values in email templates

In `netlify/lib/email-templates.js`, add one helper at the top:

```js
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

Then wrap every user-influenced interpolation in the template literals with `escapeHtml(...)` — at minimum every `${userName}` occurrence (first at ~line 50; enumerate all with `grep -n '\${userName}' netlify/lib/email-templates.js`) and the usage-breakdown feature keys (~lines 309 and 429). Do NOT escape static constants, URLs built from env vars, or numeric values.

**Verify**: `grep -n '\${userName}' netlify/lib/email-templates.js` → every hit reads `${escapeHtml(userName)}`. If an email-templates test file exists, add a case: `userName` containing `<b>` renders as `&lt;b&gt;` in the produced HTML.

## Test plan

- Gate tests (Step 1) in the admin-gates test file: 3 cases listed above. If no test file exists, create `netlify/lib/__tests__/admin-gates.test.ts` modeled on any sibling test in `netlify/lib/__tests__/`.
- Batch gate tests (Step 2): 2 cases (reject wrong code, accept configured code).
- Email escaping test (Step 4): 1 case (markup in name is neutralized).
- Regression: full `npm run test` scoped to `netlify/` passes after the deletion in Step 3.

## Done criteria

- [ ] `npm run type:check` exits 0
- [ ] `npm run lint` exits 0 on touched files
- [ ] Netlify-scoped tests pass, including the new gate/escaping tests
- [ ] `grep -rn "parse-arabic-resume" netlify/ src/` → no matches
- [ ] `grep -n '\${userName}' netlify/lib/email-templates.js` → all occurrences wrapped in `escapeHtml(`
- [ ] `.env.example` contains `CRON_SECRET` and does not contain `BETA_ACCESS_CODES`
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any excerpt mismatch (drift since `baebbd7`).
- Step 3's grep reveals a live caller of `parse-arabic-resume`.
- `requireScheduledFunctionGate` is used by functions other than the two cron functions (grep first: `grep -rn "requireScheduledFunctionGate" netlify/`) — if so, report the full caller list before changing semantics.
- Evidence that Netlify's scheduler delivers invocations WITHOUT the `x-netlify-internal-functions` header (cron tests or docs contradict the gate) — the back-compat branch would then be wrong; report.
- A step's verification fails twice.

## Maintenance notes

- Operator follow-ups after merge (not executor tasks): set `CRON_SECRET` in the Netlify environment.
- The header-only back-compat branch in Step 1 should be removed once `CRON_SECRET` is confirmed set in production — leave a `TODO` comment saying exactly that.
- Open question for the owner (recorded, not blocking): whether Netlify blocks direct external HTTP to natively scheduled functions. If it does, Step 1 is defense-in-depth; if not, it is the only real gate — either way the change is correct.
- Reviewer: check that no `${...}` interpolation in `email-templates.js` was double-escaped (e.g., values already passed through `escapeHtml` upstream — there are none today).
