# Job Feed — how to try it

Shipped and merged to `main`; live on watheqai.app. This file is the record of how to
exercise it, what is verified, and what is not.

## Setup — already done in production

Both steps below are complete on the live project. They are recorded because a fresh
environment needs them again.

**1. The migration.** `supabase/migrations/20260829000000_add_job_feed.sql` — four
tables, two columns on `user_profiles`, and the `claim_job_crawl_batch` RPC. Migrations
are never applied automatically here; run it in the Supabase SQL editor.

**2. `JOB_CRAWL_SECRET`.** Not a vendor key — generate one and set it in Netlify (and in
`.env` for local function testing):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Background functions are invocable by URL, unlike scheduled ones, so the crawler refuses
to run without it and rejects any call that does not present it.

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

1. Add a company by name (`salla`, `hala`, `tabby`), in Arabic (`سلة`, `تامارا`), or by
   pasting a careers URL. A Workday employer must be added by URL — a tenant alone
   cannot name its site. Thirteen verified Saudi employers are offered as one-tap chips.
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

## What is verified, and how

Verification here means the thing was watched working, not that a test asserted it.

| Behaviour | Verified by |
| --- | --- |
| Six board readers return real postings | Live fetch against HALA, Tamara, Lean, Salla, Tabby and a Workday tenant (`scripts/ats-smoke.ts`) |
| The control guard rejects invented companies | All five name-probeable providers miss all three control shapes, live |
| A failed board closes nothing | Live crawl with a 404 token: `last_status=failed`, zero postings closed |
| The crawl lease is real | `claim_job_crawl_batch` claims 4, an immediate second call claims 0 |
| RLS denies anonymous access | Anon client gets `42501` on all four tables, and on insert |
| The background function runs under Netlify | Tapping a chip on watheqai.app fired the cold-start crawl; Careem landed 20 postings |
| The resolver works in production | Typing `deel` on watheqai.app returned a Pinpoint candidate |
| Arabic company search | `سلة` resolved to Salla in the browser and the follow landed in the database |
| Score colour bands | Live feed showed 82 amber and 65 red, not uniform green |
| Type scale and hit targets | Looked at in a signed-in browser after the restyle |
| Posting-date coverage per provider | Live fetch, 2026-08-31: Greenhouse, Workable and Ashby date every posting; Pinpoint dates none (Tabby, 33 roles) |
| A seven-day window is too narrow alone | Same run: Careem 0 of 20 roles inside 7 days, HALA 4 of 16, Tamara 3 of 36, Salla 3 of 27, Lean 1 of 4 — which is why the feed widens itself once to 30 days rather than opening empty |

## Not proven yet

Read this before assuming the feature is fully exercised.

**The cron has never fired.** Every crawl so far was triggered by hand or by the
cold-start path. Netlify scheduled functions only run on published production deploys,
so `cron-job-crawl` at `0 3 * * *` (06:00 Riyadh) has not yet run once on its own. The
handler behind it *has* run under Netlify's runtime via cold start, so what is unproven
is the scheduler firing and the lease/claim path under it — not the crawl itself. Check
`ats_companies.last_fetched_at` after 06:00 Riyadh; if the timestamps moved without
anyone clicking, this is closed.

**Optimistic remove was verified by test only.** Two tests cover it — one holds the
delete request unresolved and asserts the row is already gone, one asserts it returns on
failure — but browser tab navigation kept failing under automation, so nobody has
watched an (x) click in a real browser. The risk is low (it is local state) but it is
the one user-facing behaviour in this feature with no human confirmation.

**Closure reconciliation has never actually closed anything.** Every crawl so far
reported `closed: 0`, because no tracked board has dropped a posting yet. The logic that
decides what to close is the most dangerous code here — it deletes rows from a user's
feed — and it has only been exercised in the direction that closes nothing. The first
real closure is worth watching.

**The feed's filters and dates have never been seen rendered.** Company filter
chips, the age window, the posting-date labels and the Refresh control have unit
and component coverage only — 41 tests across `jobFeed.age.test.ts` and
`JobFeedSection.test.tsx`, all in jsdom. The Job Feed sits behind `isGuestMode`,
so reaching it in a browser needs a signed-in session, and nobody has looked at
the result. What is unproven is the rendering: layout at the 25-company cap, the
chips under RTL, and whether the widened-window notice reads as reassurance or
as an error.

**Nothing has run at more than one user.** Load, the 25-company cap, and crawl timing
are all reasoned about rather than observed. Distinct companies drive cost, not users,
so this should hold — but it is arithmetic, not evidence.

**No Workday employer is actually tracked.** The Workday reader was verified against
NVIDIA's tenant, which is not a Saudi employer and is not in the starter registry. The
provider works; nobody has followed a real Workday company through the UI.

## Known limits, deliberately

**Coverage stops at company ATS boards.** Every Saudi job platform checked either blocks
datacenter IPs (Bayt and GulfTalent return 403) or renders client-side (Taqat, Qiwa,
Jadarat). LinkedIn and Indeed are not scraped, and will not be: no open API, an auth
wall, and terms that `hiQ v. LinkedIn` upheld. Pasting a single posting URL already
works through `import-job-url`.

**The `jsonld` reader finds nothing on the employers it was built for.** See the section
below. It stays because it is cheap and catches any site that server-renders, but it is
not the answer for stc, NEOM or Aramco.

**Reaching the big Saudi employers is an open problem.** The only remaining routes are a
licensed aggregator (JSearch via RapidAPI — costs money, ruled out at this user count)
or evading a deliberate IP block, which is not on the table.

## Tier 2 is built, and it does not reach the big employers

The `jsonld` reader is implemented and wired into the resolver as the last step before
giving up. It is SSRF-guarded, it follows a bounded set of same-origin links when the
listing page carries no structured data, and its absence of results is never trusted as
closure — a careers page with no JSON-LD means "unreadable today", not "every role gone".

**But measured against real sites on 2026-08-29, it does not close the coverage gap it was
meant to close.** Ten career sites across eight platforms were checked for a server-rendered
`JobPosting` block — Greenhouse and Ashby board pages, Workable and Pinpoint posting pages,
SmartRecruiters, `careers.stc.com.sa`, `saudia.com/careers`, Microsoft, Tesla. Every one
returned zero. These sites emit their structured data client-side for Googlebot, so a plain
fetch cannot see it, and reading it would need a headless browser — hundreds of megabytes
and minutes per run, which this project refuses on the same grounds it refuses scraping.

So the honest position: the reader is worth keeping because it is cheap and will pick up any
employer that does server-render, but **stc, NEOM and Aramco are still out of reach.** Do
not plan around Tier 2 rescuing them. Reaching those employers is an open problem.

`npx tsx scripts/jsonld-smoke.ts` re-runs that check, including the SSRF guard cases.

## Not built, on purpose

Email digests, saved keyword searches, a pre-filled company roster, and auto-tailoring —
the last one deliberately: the feed routes into Match, Optimize and Cover Letter, and the
user applies changes there. Nothing here rewrites a CV on its own.
