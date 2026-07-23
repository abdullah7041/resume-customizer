# Plan 011: Close the empty-Content-Type gap in safe-fetch and bound the job-extract heuristic regex

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- netlify/lib/safe-fetch.ts netlify/lib/job-page-extract.ts netlify/lib/__tests__/safe-fetch.test.ts netlify/lib/__tests__/job-page-extract.test.ts`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

The job-URL import path fetches a user-supplied URL through an SSRF-guarded
`safeFetch` and extracts the job description from the returned HTML. The SSRF
guard itself is strong (connection-time IP validation, per-hop redirect
re-validation, size/time caps). Two smaller gaps remain on the response-handling
side:

1. **`safeFetch` lets responses with a missing/empty `Content-Type` past the
   text-only filter.** The check is `if (contentType && !TEXT_CONTENT_TYPES…)` —
   the `contentType &&` short-circuit means a response with no `Content-Type`
   header skips the `not_html` rejection and its body (up to 2 MB) is read and
   returned. The module documents a "text-only content types" guarantee it does
   not enforce when the header is absent. Impact is limited (the body only feeds
   the HTML/JSON-LD extractor, never an executor, and IP/redirect guards still
   apply), but the stated contract should hold.

2. **The main-content extraction regex runs unbounded on up to 2 MB of
   attacker-influenced HTML.** `extractFromMainContent` matches
   `/<[a-z]+\b[^>]*role\s*=\s*["']main["'][\s\S]*?>[\s\S]*<\/[a-z]+>/i` (two
   sequential greedy `[\s\S]` quantifiers → ~O(n²) worst case) against the full
   fetched body. On a crafted 2 MB page this can block the function's single
   event loop for seconds — a mild latency/DoS smell (not catastrophic
   exponential backtracking, and the 8 s fetch deadline does not cover the regex).

After this plan: `safeFetch` applies an explicit policy to empty `Content-Type`
(default-deny as `not_html`), and the job-extract heuristics run against a
length-capped slice of HTML so worst-case regex time is bounded.

## Current state

Relevant files:

- `netlify/lib/safe-fetch.ts` — SSRF-guarded fetch. Content-type check at line
  327; `TEXT_CONTENT_TYPES` at line 215; `SafeFetchFailure` union includes
  `'not_html'` (line 30) mapping to status 415.
- `netlify/lib/job-page-extract.ts` — job extraction. `extractFromMainContent`
  at lines 151–168 (the super-linear regex is at line 154); JSON-LD scan at line
  70; the public entry `extractJobFromHtml` at lines 171–173.
- `netlify/lib/__tests__/safe-fetch.test.ts` and
  `netlify/lib/__tests__/job-page-extract.test.ts` — existing tests to extend.

Excerpt as of commit `ceed480` (`safe-fetch.ts:325-331`):
```ts
      const rawContentType = response.headers['content-type'];
      const contentType = (Array.isArray(rawContentType) ? rawContentType[0] : rawContentType ?? '').toLowerCase();
      if (contentType && !TEXT_CONTENT_TYPES.some((allowed) => contentType.startsWith(allowed))) {
        response.abort();
        activeResponse = undefined;
        throw new SafeFetchError('not_html', `content-type ${contentType.split(';')[0]}`);
      }
```

Excerpt (`job-page-extract.ts:151-159`):
```ts
function extractFromMainContent(html: string): ExtractedJob | null {
  const region = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0]
    ?? html.match(/<article\b[\s\S]*?<\/article>/i)?.[0]
    ?? html.match(/<[a-z]+\b[^>]*role\s*=\s*["']main["'][\s\S]*?>[\s\S]*<\/[a-z]+>/i)?.[0]
    ?? null;
  if (!region) return null;

  const jobText = htmlToText(region);
  if (jobText.length < MIN_HEURISTIC_CHARS || jobText.length > MAX_JOB_TEXT_CHARS * 2) return null;
```

Convention: `SafeFetchError(reason, message?)` is the established failure channel
(the caller maps `.code`/`.status`); zero-dependency Node built-ins only; tests
use Vitest. The extractor's public entry is `extractJobFromHtml(html)`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run type:check` | exit 0, no errors |
| Focused tests | `npm run test -- netlify/lib/__tests__/safe-fetch.test.ts netlify/lib/__tests__/job-page-extract.test.ts` | all pass |
| Lint | `npm run lint:fix` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `netlify/lib/safe-fetch.ts` — the content-type check only.
- `netlify/lib/job-page-extract.ts` — bound the HTML length fed to the
  heuristics.
- `netlify/lib/__tests__/safe-fetch.test.ts` and
  `netlify/lib/__tests__/job-page-extract.test.ts` — add cases.

**Out of scope** (do NOT touch):
- The IP-validation logic (`isPrivateAddress`, `createSafeLookup`), redirect
  handling, or size/time caps — all correct, do not change.
- `import-job-url.ts` — the caller; no change needed.
- The `TEXT_CONTENT_TYPES` list itself — do not add/remove allowed types.

## Git workflow

- Branch: `advisor/011-harden-safe-fetch`
- Commit per file/concern; short imperative subjects.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Default-deny empty Content-Type in safe-fetch

In `netlify/lib/safe-fetch.ts`, change the content-type gate so a missing/empty
`Content-Type` is rejected as `not_html` rather than allowed through. Target
shape (replace the `if (contentType && …)` condition):

```ts
      const rawContentType = response.headers['content-type'];
      const contentType = (Array.isArray(rawContentType) ? rawContentType[0] : rawContentType ?? '').toLowerCase();
      const isTextType = TEXT_CONTENT_TYPES.some((allowed) => contentType.startsWith(allowed));
      if (!isTextType) {
        response.abort();
        activeResponse = undefined;
        throw new SafeFetchError('not_html', `content-type ${contentType.split(';')[0] || '(none)'}`);
      }
```

This makes the text-only guarantee unconditional: an absent header now yields
`not_html` (415) instead of being read. Legitimate job pages return
`text/html`, so this does not affect the happy path.

**Verify**: `npm run type:check` → exit 0.

### Step 2: Bound the HTML length fed to the job-extract heuristics

In `netlify/lib/job-page-extract.ts`, cap the input length before the
super-linear regex runs. Add a constant near the other size constants (search
for `MAX_JOB_TEXT_CHARS` to find them) and slice in `extractFromMainContent` (and
apply the same cap to the JSON-LD scan input for consistency):

```ts
// Bound regex work on attacker-influenced HTML (safeFetch caps the body at 2 MB;
// the main-content heuristic's nested quantifiers are ~O(n^2), so cap the slice
// the heuristics scan).
const MAX_HTML_SCAN_CHARS = 400_000;
```

In `extractFromMainContent`, operate on `html.slice(0, MAX_HTML_SCAN_CHARS)`
instead of `html` for the region `.match(...)` calls. Cap ONLY the main-content
heuristic — it is the sole super-linear pattern (the `role="main"` alternative at
line 154 has two greedy `[\s\S]` quantifiers → ~O(n²)).

Do NOT slice the input to `parseJsonLdBlocks` / `extractFromJsonLd`: that scan's
`[\s\S]*?` is **lazy (non-greedy) and linear**, so it is not a ReDoS risk, and a
`<script type="application/ld+json">` `JobPosting` block can legitimately appear
late in a large page — slicing it would drop real job data for no security
benefit. Leave JSON-LD scanning on the full HTML.

Keep `pageTitle(html)` on the full HTML too — its regexes are linear and the title
is near the top anyway. Do not change the extraction results for normal pages
(real job pages are far under 400 KB).

**Verify**: `npm run type:check` → exit 0; `npm run lint:fix` → exit 0.

### Step 3: Add tests

In `netlify/lib/__tests__/safe-fetch.test.ts` (use the existing `_requestOnce`
test hook — the file already injects a fake transport; model on the existing
content-type tests):
- A response with NO `content-type` header → `safeFetch` rejects with
  `SafeFetchError` whose `.code === 'not_html'` (status 415). This is the SEC-21
  regression guard.
- A response with `content-type: text/html` → still succeeds (happy path
  unchanged).

In `netlify/lib/__tests__/job-page-extract.test.ts`:
- `extractJobFromHtml` on a normal small `<main>`-containing page still extracts
  the job text (unchanged behavior).
- `extractJobFromHtml` on a ~600 KB string of `role="main"`-style filler
  completes quickly and returns a result or `null` without hanging (a coarse
  timing assertion — e.g. it returns within a generous bound like 1 s — plus a
  correctness assertion that the capped input still yields the same result as the
  first 400 KB would). Keep the fixture generated in-code, not committed as a
  large file.

**Verify**: `npm run test -- netlify/lib/__tests__/safe-fetch.test.ts netlify/lib/__tests__/job-page-extract.test.ts`
→ all pass.

## Test plan

- safe-fetch: empty-Content-Type rejection (regression guard) + happy-path
  text/html still allowed.
- job-page-extract: small-page extraction unchanged + large-input completes
  bounded (the SEC-22 guard).
- Structural pattern: the existing tests in those two files (safe-fetch already
  has a `_requestOnce` injection pattern — reuse it; do not make real network
  calls).
- Verification: focused test command above → all pass; `npm run type:check` exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run type:check` exits 0
- [ ] `npm run lint` exits 0 on both touched lib files
- [ ] `npm run test -- netlify/lib/__tests__/safe-fetch.test.ts netlify/lib/__tests__/job-page-extract.test.ts`
      passes with the new cases
- [ ] `grep -n "isTextType" netlify/lib/safe-fetch.ts` → present (empty
      content-type now default-denied)
- [ ] `grep -n "MAX_HTML_SCAN_CHARS" netlify/lib/job-page-extract.ts` → present
      and used in `extractFromMainContent`
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match the live code (drift since
  `ceed480`).
- Any existing safe-fetch test relied on the old empty-Content-Type pass-through
  behavior (i.e. expected a body from a header-less response) — report it; the
  behavior change is intentional but the owner should know a test encoded the old
  contract.
- Capping the HTML slice changes extraction results for a NORMAL-size page in the
  existing job-page-extract tests — that would mean 400 KB is too small for a
  real fixture; report before lowering results quality.
- A verification fails twice after reasonable fixes.

## Maintenance notes

- `MAX_HTML_SCAN_CHARS` (400 KB) is comfortably above real job pages but well
  under the 2 MB fetch cap; if a legitimate page is ever found truncated, raise
  it — do not remove the cap (the regex is the reason it exists).
- Reviewer should confirm the empty-Content-Type change did not break the
  legitimate `text/plain`/`application/xhtml+xml` job sources (both are in
  `TEXT_CONTENT_TYPES` and still allowed).
- Deliberately out of scope: replacing the super-linear main-content regex with a
  linear parser would be a cleaner long-term fix; the length cap is the low-risk
  mitigation for now.
