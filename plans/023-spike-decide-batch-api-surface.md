# Plan 023: SPIKE — decide whether `batch-api` is a product surface or dead weight

> **Executor instructions**: This is a **decision spike**. Its deliverable is a
> written recommendation with evidence — **not** a deletion and **not** a
> feature. Do not remove `batch-api` in this plan even if the evidence points
> that way; removal is the maintainer's call and would be its own plan. Follow
> the steps in order and honour the STOP conditions. When done, update the
> status row for this plan in `plans/README.md` — unless a reviewer dispatched
> you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat d2fba38..HEAD -- netlify/functions/batch-api.ts netlify/lib/rate-limiter.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `d2fba38`, 2026-08-08

## Why this matters

`netlify/functions/batch-api.ts` is a fully built, tested, rate-limited endpoint
that **nothing in the application calls**. A search for `batch-api` across
`src/` returns zero matches; the Bulk Analysis feature
(`src/components/sections/BulkAnalysisSection.tsx`) has its own separate
implementation and never touches it.

It is not free to keep. It is a 1→N AI fan-out endpoint that has already
consumed a security finding (SEC-09) and a dedicated remediation plan
(`plans/012-rate-limit-batch-api-fanout.md`) to add throttling, it carries its
own entry in the rate-limit registry, and it will keep drawing review attention
in every future security pass — all for a surface with no known consumer.

This candidate has now been deferred **twice** (`plans/README.md:118`). Deferring
a third time costs more than deciding. The point of this spike is to produce
enough evidence that the maintainer can settle it in one reading.

Note the framing: "decide, don't build". Both outcomes are cheap. What is
expensive is leaving it undecided.

## Current state

### No callers

- `grep -rl "batch-api" src` → no matches.
- The only non-test references are the function's own file, its test file, and
  `netlify/lib/rate-limiter.ts:302`.

### It is wired up and hardened

`netlify/functions/batch-api.ts:272`:

```ts
export const handler = withRateLimit("batch-api", baseHandler);
```

`netlify/lib/rate-limiter.ts:301-302`:

```ts
  // Fan-out endpoint: 1 request → up to 10 downstream AI calls, so keep tight.
  "batch-api": { maxRequests: 5 },
```

It has a test file at `netlify/functions/__tests__/batch-api.test.ts`.

### It does not authenticate at its own level

`netlify/functions/batch-api.ts:162-180`:

```ts
const baseHandler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Extract auth header from headers
  const authHeader = event.headers["authorization"] || event.headers["Authorization"];

  // Note: No separate batch quota check needed here.
  // Child tasks (extract, match, etc.) consume their own quotas when called.
```

The auth header is read and forwarded, but this handler performs no JWT
verification of its own — it relies entirely on each child task enforcing auth
and credits. That design is defensible for a pure fan-out, but it is a
meaningful fact for the "expose it as a public API" branch: the security
posture of the batch surface is exactly the union of its children's, and nobody
has audited it as a *product* surface because it was never treated as one.

### The prior record

`plans/README.md:118` lists it as an open decision:

```
- **DECISION: `batch-api` surface** — zero frontend callers; Bulk Analysis uses its own path. Keep for API users or delete.
```

`plans/012-rate-limit-batch-api-fanout.md` is the landed plan that added the
rate limit.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Caller search | `npx vitest --version` is not needed here; use ripgrep via your tooling | — |
| Typecheck | `npm run type:check` | exit 0 |
| Full suite | `npm run test` | exit 0 (181 files) |

This spike changes no runtime code, so the suite should be untouched. Run it
once at the end only to confirm you changed nothing that matters.

## Scope

**In scope:**
- `docs/plans/batch-api-decision.md` (create) — **the deliverable**
- `plans/README.md` — status row, and move the `batch-api` line out of
  "Candidates not planned" into a pointer at your new doc
- **Read-only** inspection of `netlify/functions/batch-api.ts`,
  `netlify/functions/__tests__/batch-api.test.ts`,
  `src/components/sections/BulkAnalysisSection.tsx`, `netlify/lib/rate-limiter.ts`

**Out of scope** (do NOT do these, whatever you conclude):
- **Deleting `batch-api.ts`, its test, or its rate-limit entry.** Removal is the
  maintainer's decision and a separate plan. Your job is the recommendation.
- Adding authentication, changing the fan-out logic, or "hardening" it.
- Writing public API documentation, an OpenAPI spec, or a developer portal page.
- Refactoring `BulkAnalysisSection.tsx` to route through `batch-api`. If your
  recommendation is "keep and adopt it internally", that is a *proposal* in your
  write-up, not work you do here.
- Any change to `netlify.toml`.

## Git workflow

- Branch: `advisor/023-spike-batch-api-decision`
- Conventional commits, matching `git log` style.
  Suggested: `docs: record the batch-api keep-or-delete decision inputs`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Establish, with evidence, that there is no internal consumer

Search the whole repo — not just `src/` — for any reference to the endpoint,
including its deployed path. Cover at least: `batch-api`, `batch_api`,
`/api/batch`, `.netlify/functions/batch`, and `batch` in any fetch/axios call
site. Check `src/services/api.js` specifically, since that is where the app's
HTTP calls are centralised.

Record every hit with `file:line`, and classify each as: the function itself,
its tests, rate-limit config, or a real caller.

**Important**: use a proper search tool, not a shell `grep` pipeline. During the
audit that produced this plan, shell `grep` returned false negatives on this
repo; a "no matches" result from it is not trustworthy evidence for a deletion
decision.

**Verify**: you have a complete, classified hit list, and can state whether any
real caller exists.

### Step 2: Check for external consumers

An internal search cannot prove nobody outside the repo calls it. Gather what
the repo *can* tell you:

- Is the endpoint referenced in any doc, README, `.env.example`, or marketing
  copy? (`docs/`, `README.md`, `public/`)
- Does `netlify.toml` give it a custom path or any special configuration?
- Does `git log --follow netlify/functions/batch-api.ts` show why it was
  created, and for whom? Quote the most informative commit message.

State plainly in your write-up that repo evidence **cannot** rule out an
undocumented external consumer, and that confirming that requires production
request logs — which only the maintainer can check.

**Verify**: you have the git history summary and can name the one check only the
maintainer can perform.

### Step 3: Cost out both branches honestly

For **delete**: list exactly what would be removed (the function, its test file,
the `rate-limiter.ts` entry, any `netlify.toml` reference) and what breaks if an
undocumented consumer exists (a hard 404 on their integration, with no
deprecation window).

For **keep**: list what "keeping it properly" actually requires — at minimum,
deciding whether the no-own-auth design (Step 0 evidence above) is acceptable
for a surface offered to third parties, plus documentation, a versioning
posture, and inclusion in future security reviews as a deliberate public API
rather than an incidental one.

Also cost out the **third option** neither prior round named: keep the code but
make Bulk Analysis actually use it, collapsing two implementations of the same
fan-out into one. Note whether `BulkAnalysisSection.tsx`'s current path and
`batch-api`'s task types are close enough for that to be plausible — read both
before answering, and say "unknown" if you cannot tell cheaply.

**Verify**: all three branches costed, each with concrete file-level detail.

### Step 4: Write the recommendation

Create `docs/plans/batch-api-decision.md` with:

1. **The question**, in one sentence.
2. **Evidence**: the classified hit list from Step 1, the history from Step 2,
   and the auth-posture fact from "Current state".
3. **The three options** with their costs, from Step 3.
4. **Your recommendation**, stated plainly, with the reasoning in two or three
   sentences. Give a recommendation — "it depends" is not a useful spike output.
5. **The one thing you could not determine**: whether an external consumer
   exists, and exactly what the maintainer should check (production request logs
   for the endpoint path over a meaningful window) to close it.
6. **A safe sequencing note**: if the decision is delete, the low-risk order is
   to first instrument or log-check for callers over some window, then remove —
   rather than deleting blind.

**Verify**: the file exists and covers all six points.

### Step 5: Update the index and verify nothing else changed

Move the `batch-api` bullet in `plans/README.md` out of "Candidates not planned"
and replace it with a pointer to `docs/plans/batch-api-decision.md`, noting the
decision is now the maintainer's to make with the evidence assembled.

**Verify**:
- `git status --short` → only `docs/plans/batch-api-decision.md` (new) and
  `plans/README.md` (modified)
- `git diff --name-only -- netlify/ src/` → **empty**
- `npm run test` → exit 0

## Test plan

No new tests. This spike changes no runtime code — that is itself the property
to verify, via the `git diff --name-only -- netlify/ src/` check in Step 5.

## Done criteria

ALL must hold:

- [ ] `docs/plans/batch-api-decision.md` exists and covers all six points from Step 4
- [ ] It contains an explicit recommendation, not a summary of options
- [ ] `netlify/functions/batch-api.ts` still exists and is unmodified
- [ ] `netlify/functions/__tests__/batch-api.test.ts` still exists and is unmodified
- [ ] `git diff --name-only d2fba38..HEAD -- netlify/ src/` → empty
- [ ] `plans/README.md` no longer lists `batch-api` as an undecided candidate and points at the new doc
- [ ] `npm run test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 finds a **real caller** — the premise of this spike is wrong and the
  decision is already made (keep it). Report the caller and stop.
- You find documentation, a changelog entry, or a commit message indicating
  `batch-api` was built for a named external partner or customer. That converts
  this from a hygiene decision into a commercial one, which is not yours to make.
- You are tempted to delete the function because the evidence looks
  overwhelming. Do not. Removal is explicitly out of scope; write the
  recommendation instead.
- You are tempted to refactor `BulkAnalysisSection.tsx` onto `batch-api`. Also
  out of scope — propose it, don't do it.

## Maintenance notes

- **The one open question is not answerable from the repo.** Only production
  request logs can show whether an external consumer exists. Whatever the
  write-up recommends, the maintainer should check that before any removal.
- If the decision is **keep as a public surface**, the no-own-auth design at
  `netlify/functions/batch-api.ts:175-179` should get a deliberate review. It is
  reasonable for an internal fan-out whose children each authenticate, but it
  has never been assessed as a third-party-facing contract.
- If the decision is **delete**, the removal plan should also drop the
  `"batch-api"` entry from `ENDPOINT_RATE_LIMITS` (`netlify/lib/rate-limiter.ts:302`)
  and mark `plans/012-rate-limit-batch-api-fanout.md` as superseded in the index
  — otherwise a future audit re-derives a finding about an endpoint that no
  longer exists.
- Whatever is decided, record it in `plans/README.md` so a fourth round does not
  rediscover this as a fresh candidate.
