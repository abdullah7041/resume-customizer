# Job Feed — how to try it

Branch `feat/job-feed`, worktree `.worktrees/job-feed`. Design doc: the plan file this
was built from.

## Before it can run

**1. Apply the migration.** Open `supabase/migrations/20260829000000_add_job_feed.sql`
and run it in the Supabase dashboard SQL editor. It is not applied automatically and
nothing here works until it is: four tables plus two columns on `user_profiles`.

**2. Set one env var** in Netlify (and in `.env` for local function testing):

```bash
JOB_CRAWL_SECRET=<any long random string>
```

The background crawler is invocable by URL, unlike a scheduled function, so it refuses
to run without this and rejects any call that does not present it.

## What runs where

| Piece | Where | Budget |
| --- | --- | --- |
| `cron-job-crawl` | scheduled, 06:00 Riyadh | 30s — leases and hands off, fetches nothing |
| `crawl-jobs-background` | invoked by the cron | 15 min — reads boards, upserts postings |
| `job-sources-api` | user action | 30s — probes boards, tracks/untracks |
| Everything else | the browser, under RLS | filtering and scoring, next to the CV |

Scheduled functions run **only on published production deploys** — never locally or on a
deploy preview. To exercise the crawl before deploying, call the background function
directly with a company id from `ats_companies`.

## Checking the board readers without any of the above

```bash
npx tsx scripts/ats-smoke.ts
```

Hits the real public APIs, no keys. It prints a control probe (every provider must MISS a
nonsense token — that guard is what stops the resolver inventing companies), then reads
six live boards. Last run: HALA 15 roles, Tamara 38, Lean 4, Salla 28, Tabby 38, NVIDIA
(Workday) 500. It also asserts that a bad token and an unsafe token both come back
unsuccessful rather than as an empty board.

## Trying the UI

The Job Feed tab lives under **More tools**, behind the `jobFeed` flag (on by default,
toggleable at `/dev/flags`). Like every other tab it needs a resume uploaded first.

1. Add a company by name (`salla`, `hala`, `tabby`) or paste a careers URL. A Workday
   employer must be added by URL — a tenant alone cannot name its site.
2. Tracking triggers an immediate crawl, so roles appear without waiting for the cron.
3. The feed filters and scores against your target role from onboarding. With no target
   role set, it says so rather than showing an empty list.

## Worth poking at deliberately

- **Follow a company with no Saudi roles.** Everything should be filtered out with the
  rule that did it named, not a blank screen.
- **Follow a company whose board 404s.** Nothing should be marked closed. A failed fetch
  and an empty board both return no postings, and only the second one means the roles are
  gone.
- **Search for a company that is on none of the boards.** It should say so and point at
  pasting a job link, never return silently empty.

## Not built

Email digests, saved keyword searches, a pre-filled company roster, and auto-tailoring —
the last one deliberately: the feed routes into Match, Optimize and Cover Letter, and the
user applies changes there. Nothing here rewrites a CV on its own.
