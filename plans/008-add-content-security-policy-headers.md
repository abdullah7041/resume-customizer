# Plan 008: Add Content-Security-Policy and framing/transport hardening headers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- netlify.toml`
> If `netlify.toml` changed since this plan was written, compare the "Current
> state" excerpt against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (an over-tight CSP can break Supabase/Sentry/Mixpanel/OpenRouter calls or inline styles — this plan ships it **report-only** first to avoid that)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

The app renders AI-generated text and uploaded-resume content in the browser and
keeps a Supabase auth JWT plus resume PII (`watheq:resumeData`) in
`localStorage`, but the site sends no `Content-Security-Policy`, no
anti-framing header, no HSTS, and no `Permissions-Policy`. The only security
headers present are `X-Content-Type-Options` and `Referrer-Policy`. Any
script-injection foothold (a compromised dependency, a future
`dangerouslySetInnerHTML`, a third-party script) could exfiltrate the session
token and stored PII with nothing to blunt it, and the page is framable
(clickjacking).

A CSP is the highest-value missing control here, but a mis-scoped CSP silently
breaks real requests. So this plan ships CSP in **report-only** mode
(`Content-Security-Policy-Report-Only`) — the browser evaluates and logs
violations without enforcing — alongside the framing/transport headers, which
are safe to enforce immediately. The report-only header lets the operator watch
for violations in browser devtools before a later plan flips it to enforcing.

After this plan: every response carries `X-Frame-Options: DENY`,
`Strict-Transport-Security`, `Permissions-Policy`, and a report-only CSP scoped
to the origins the app actually talks to.

## Current state

Relevant file:

- `netlify.toml` — Netlify build/deploy config. The response-header block is at
  lines 89–104.

Excerpt as of commit `ceed480` (`netlify.toml:89-104`):
```toml
# Security and Caching Headers
[[headers]]
  for = "/*"
  [headers.values]
    # Security Headers
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

    # Cache Control (Default for HTML)
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/assets/*"
  [headers.values]
    # Cache Control (Long cache for hashed assets)
    Cache-Control = "public, max-age=31536000, immutable"
```

**Origins the app talks to** (these MUST be in the CSP `connect-src`, or
report-only will show violations for legitimate traffic). Confirm each before
writing the policy:

- **Supabase**: client uses `VITE_SUPABASE_URL` (a `*.supabase.co` origin).
  `grep -rn "VITE_SUPABASE_URL" src/` to confirm usage; the CSP should allow
  `https://*.supabase.co` for `connect-src` (REST + auth + realtime websocket —
  add `wss://*.supabase.co` too).
- **Sentry**: `VITE_SENTRY_DSN` — DSN host is an `*.ingest.sentry.io` (or
  `*.ingest.<region>.sentry.io`) origin; allow `https://*.sentry.io` in
  `connect-src`. `grep -rn "sentry" src/main.tsx`.
- **Mixpanel**: `mixpanel-browser` posts to `https://api.mixpanel.com` (and
  `https://api-js.mixpanel.com`). `grep -rn "mixpanel" src/services/`.
- **OpenRouter/AI and PDF/parse**: these are called from the Netlify functions
  (server-side), NOT the browser — the browser only calls same-origin
  `/.netlify/functions/*` and `/api/*`. Same-origin is covered by `'self'`.
- **Fonts/images**: check `src/index.css` and `index.html` for any external
  font/image host (`grep -rn "https://" index.html src/index.css | grep -i
  "font\|googleapis\|gstatic\|cdn"`). If none, `font-src 'self' data:` and
  `img-src 'self' data: blob:` suffice. If an external font host appears, add it.
- **Inline styles/scripts**: Vite injects a small inline bootstrap and the app
  uses inline styles (template rendering sets `style=`). A strict `script-src`
  without `'unsafe-inline'` may block Vite's inline bootstrap; because this ships
  **report-only**, start permissive on `style-src` (`'self' 'unsafe-inline'`) and
  let the violation reports tell you whether `script-src` needs adjustment before
  any future enforcing flip.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| TOML sanity (build reads it) | `npm run build` | exit 0 (build completes; header block is static config, so a syntax error surfaces here) |
| Lint (unaffected, but run) | `npm run lint` | exit 0 |

Note: there is no unit test for `netlify.toml`. Verification is (a) the build
still succeeds and (b) a manual header check described in the Test plan. Netlify
applies these headers at the edge, so they can only be fully confirmed on a
deploy preview — call that out in your report; do not claim runtime enforcement
you did not observe.

## Scope

**In scope** (the only file you should modify):
- `netlify.toml` — the `[[headers]] for = "/*"` block only.

**Out of scope** (do NOT touch):
- The `for = "/assets/*"` cache block — leave it unchanged.
- Any function code, any `src/` code — no code change is needed for this plan.
- Do NOT switch CSP to enforcing mode (`Content-Security-Policy` without
  `-Report-Only`) in this plan — that is a deliberate follow-up after the
  operator reviews violation reports.
- Do NOT move the Supabase session out of `localStorage` — that is a separate,
  larger decision (tracked, not in this plan).

## Git workflow

- Branch: `advisor/008-csp-headers`
- Single commit; message e.g. `feat: add report-only CSP and framing/transport headers`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the connect-src origin list

Run the greps in "Current state" to confirm the exact Supabase/Sentry/Mixpanel
origins and whether any external font/image/script host is used. Write down the
final origin list you will put in `connect-src`, `font-src`, `img-src`,
`style-src`, `script-src`. If you find an external host not anticipated above
(e.g. a Google Fonts CDN, a third-party analytics script), add it to the
appropriate directive — do not omit it, or report-only will flag legitimate
traffic as a violation.

**Verify**: you have a written origin list; no command.

### Step 2: Add the headers to the `/*` block

In `netlify.toml`, add to the existing `[headers.values]` under `for = "/*"`
(keep the two existing security headers and the Cache-Control line). Add:

```toml
    X-Frame-Options = "DENY"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
    Permissions-Policy = "camera=(), microphone=(), geolocation=(), payment=()"
    Content-Security-Policy-Report-Only = "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.mixpanel.com https://api-js.mixpanel.com; worker-src 'self' blob:"
```

Adjust the `connect-src`/`font-src`/`script-src` origins to match the list you
confirmed in Step 1 (add anything extra you found; the values above are the
expected baseline). Keep the entire CSP on one line — TOML string values do not
wrap. `frame-ancestors 'none'` in the CSP plus `X-Frame-Options: DENY` together
cover framing across browsers.

**Verify**: `npm run build` → exit 0 (a TOML syntax error in the header block
would fail the build's config read). Then `grep -n "Content-Security-Policy-Report-Only\|X-Frame-Options\|Strict-Transport-Security\|Permissions-Policy" netlify.toml`
→ all four present in the `/*` block.

## Test plan

- No automated test (this is static edge config). Verification is:
  1. `npm run build` succeeds (config parses).
  2. Manual, on a Netlify deploy preview (operator or reviewer): open devtools →
     Network → any document response → confirm the four headers are present, and
     the Console shows CSP violation reports (report-only) rather than blocked
     requests. Record whatever violations appear so the enforcing follow-up can
     tighten the policy.
- Because report-only cannot break the app, shipping it is safe even if the
  origin list is slightly incomplete — the reports are exactly how you find the
  gaps.

## Done criteria

Machine-checkable where possible. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `grep -c "Content-Security-Policy-Report-Only" netlify.toml` returns 1
- [ ] `grep -n "X-Frame-Options\|Strict-Transport-Security\|Permissions-Policy" netlify.toml`
      shows all three in the `for = "/*"` block
- [ ] The CSP contains, at minimum, `'self'` plus the Supabase, Sentry, and
      Mixpanel origins in `connect-src`, and `frame-ancestors 'none'`
- [ ] `grep -n "Content-Security-Policy " netlify.toml` (note trailing space,
      i.e. the ENFORCING header) returns nothing — CSP is report-only only
- [ ] The `for = "/assets/*"` block is unchanged (`git diff` shows edits only in
      the `/*` block)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `netlify.toml` header block doesn't match the "Current state" excerpt
  (drift since `ceed480`).
- Step 1 reveals the app loads scripts or connects to an origin you cannot
  confidently identify (e.g. an opaque third-party host) — report it; guessing an
  incomplete `connect-src` for an eventual enforcing policy is worse than
  documenting the unknown now.
- You find an existing `Content-Security-Policy` (enforcing) header anywhere —
  this plan assumes none exists; if one does, report it and do not add a second.

## Maintenance notes

- Follow-up (separate plan, after operator reviews report-only violations):
  flip `Content-Security-Policy-Report-Only` to `Content-Security-Policy`
  (enforcing) once the reports are clean, and consider adding a `report-uri`/
  `report-to` endpoint to collect violations centrally.
- Reviewer should scrutinize the `connect-src` list against every external
  service the frontend actually calls — a missing origin becomes a broken feature
  the day CSP is enforced.
- Related, deliberately out of scope: the Supabase JWT lives in `localStorage`
  (supabase-js default). The CSP is the defense-in-depth that a missing header
  currently fails to provide; moving the token to a more protected store is a
  bigger change tracked separately.
