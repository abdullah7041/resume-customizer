# Decision: is `netlify/functions/batch-api.ts` a product surface or dead weight?

Spike for plan `plans/023-spike-decide-batch-api-surface.md`. Planned at commit
`d2fba38`; this spike ran at the same commit (no drift).

## 1. The question

Should `batch-api` — a fully built, rate-limited, 1→10 AI fan-out endpoint with
**zero known callers** — be kept as a public/API-user-facing surface, adopted
internally by Bulk Analysis, or deleted?

## 2. Evidence

### 2a. Classified hit list (internal search)

Search tools used: **Grep tool** and **Glob tool** (dedicated tools, not a
shell `grep`/`rg` pipeline — per the plan's warning that shell `grep` produced
false negatives during the audit that spawned this plan). Patterns searched
across the whole repo: `batch-api`, `batch_api`, `/api/batch`,
`.netlify/functions/batch`, and a broad case-insensitive `batch` sweep of
`src/` (to catch a differently-named fetch call site), plus a dedicated look
at `src/services/api.js`.

| File:line | Classification |
|---|---|
| `netlify/functions/batch-api.ts` (all internal hits: 102, 197, 216, 240, 255, 257, 272) | the function itself |
| `netlify/functions/__tests__/batch-api.test.ts:14,30,107` | its test |
| `netlify/lib/rate-limiter.ts:302` | rate-limit registry entry |
| `plans/README.md:13,50,77,84,89,118` | plan-index prose (this decision, plan 012, SEC-09) |
| `plans/015-docs-dx-hygiene.md:32,38,84,132` | prose noting it as an open maintainer decision |
| `plans/013-analytics-and-error-hygiene.md` (multiple) | a landed plan about error-message hygiene inside the function |
| `plans/012-rate-limit-batch-api-fanout.md` (multiple) | the landed plan that added the rate limit |
| `plans/005-harden-abuse-facing-surfaces.md:28,39,62,71,93,152,154,156` | a landed plan that removed its beta-code gate, explicitly noting `grep -rn "batch-api" src/` returns nothing |
| `CLAUDE.md:101` | one-line mention in the function inventory list |
| `README.md:93` | architecture-diagram table listing it among 25 functions, no special callout |

**Additional patterns, zero hits anywhere in the repo** (confirmed with the
Grep tool, each run separately): `batch_api`, `/api/batch`,
`.netlify/functions/batch`.

**`src/` broad `batch` sweep** (case-insensitive, Grep tool): 6 files matched;
each hit was individually content-verified with a follow-up Grep call
(not just classified by filename), none of them a caller —
- `src/locales/en/sections/bulkAnalysis.json:8`, `src/locales/en/sections/bulk.json:20` — both the identical i18n string `"Upload multiple files for batch processing"`, the "Bulk Analysis" feature's own copy, unrelated to this endpoint.
- `src/lib/utils/resumeText.ts:575-590` — PDF-page-text-extraction concurrency batching (`batchSize`, `batch = await Promise.all(...)`) — a local variable name, not a network call.
- `src/components/sections/SaveJobToPipelineCard.tsx:69` — comment about React 19 render batching.
- `src/components/sections/BulkAnalysisSection.tsx:310,352` — comments about a client-side confirmation-modal "batch" of pending IDs — its own local concept, not this endpoint.
- `src/__tests__/bug-bulk-analysis.test.tsx:271` — comment `// Confirm the batch`, referring to the same client-side confirmation modal above, not this endpoint.

**`src/services/api.js`** (explicitly checked per the plan's instruction,
since it centralizes the app's HTTP calls): zero matches for `batch` in any
casing. `BulkAnalysisSection.tsx` imports `parseResume` from this file
(line 23, used at line 225) and calls `ai-match` directly via `fetch('/.netlify/functions/ai-match', …)` at line 258 — its own separate path, confirming the plan's premise.

**Conclusion: no real caller exists anywhere in the repo**, in `src/` or
otherwise. This matches the plan's premise; the Step-1 STOP condition ("a real
caller is found") did not trigger.

### 2b. History — was this built for a named external consumer?

`git log --follow` on `netlify/functions/batch-api.ts` traces back through
`353f779` (rate-limit hardening, plan 012) to its origin:

> `5d68c6e` — **"Add DEEPSEEK OCR batch API and related updates"**

That commit's own guide (`DEEPSEEK_OCR_BATCH_API_GUIDE.md`, since deleted,
read via `git show 5d68c6e:DEEPSEEK_OCR_BATCH_API_GUIDE.md`) describes the
original intent plainly:

> "Process multiple operations in a single API call: Parse resume + analyze
> match + optimize = 1 request... Reduces latency (3 separate calls → 1 batch
> call)"

This was built for the **app's own frontend**, not a named external partner —
the same commit added `batchProcess()`/`processResumeBatch()` to
`src/services/api.js` as the intended caller.

To check for a named external partner or customer (the plan's STOP
condition), all four documentation/example files added by that commit were
extracted with `git show 5d68c6e:<path>` and **read in full, end to end** —
not sampled or filtered through a search pattern, since these files exist
only in git history and a shell-`grep`-style keyword filter is exactly the
tool this task was warned is unreliable on this repo:
- `DEEPSEEK_OCR_BATCH_API_GUIDE.md` (665 lines — every line read)
- `DEEPSEEK_OCR_QUICK_REF.md` (263 lines — every line read)
- `IMPLEMENTATION_COMPLETE.md` (555 lines — every line read)
- `USAGE_EXAMPLES.tsx` (9 worked examples, 484 lines — every line read)

All four are internal engineering documentation: setup steps, API request/
response shapes, rate-limit tuning, a deployment checklist, and nine code
examples that exclusively call `parseResume`/`batchProcess`/
`processResumeBatch` from the app's own `./services/api.js`. None of the four
files contains the words "external," "partner," "third-party," "customer,"
"client" (in a business sense), "SLA," or "beta" as an API-user/tier concept,
and none names an outside organization. **There is no evidence this was
commissioned for or documented to a named external consumer**, so the plan's
"commercial decision" STOP condition does not apply.

**The frontend caller was later deliberately removed, the backend was not.**
`git log -S "processResumeBatch" -- src/services/api.js` shows exactly two
commits touching that string: `5d68c6e` (added it) and `114d01f`
("feat: Implement core resume customization features, AI-powered analysis,
and Netlify functions for backend processing") which **removed** both
`batchProcess` and `processResumeBatch` from `api.js` (confirmed via
`git show 114d01f -- src/services/api.js`, lines showing both functions
deleted) while leaving `netlify/functions/batch-api.ts` in place. This reads
as an orphaning-by-refactor, not a deliberate decision to keep the backend as
a standalone public surface.

**Other repo-visible signals checked:**
- `netlify.toml`: no `batch` reference at all — no custom path, no special
  redirect or header configuration for this function.
- `.env.example:57`: one comment, `# URL (set by Netlify, used as fallback in
  batch-api)` — internal implementation detail, not consumer-facing docs.
- `README.md:93`: lists `batch-api` in an architecture table alongside 24
  other functions, with no elaboration, and no `docs/` file mentions it
  (`docs/**/*batch*` glob: no matches).

**What this cannot prove:** repo evidence cannot rule out an undocumented
external consumer who obtained the endpoint URL out-of-band (e.g., during an
early beta) and still calls it today. **The one check only the maintainer can
perform: pull production request logs (Netlify function invocation logs, or
whatever log sink is wired up) for the `batch-api` function's invocation count
over a meaningful window (e.g., the last 30-90 days).** Zero or near-zero
non-test invocations confirms no live consumer; any nonzero, human-shaped
traffic pattern would contradict this write-up's premise and should reopen
this decision.

### 2c. Auth posture (from the plan's "Current state")

`netlify/functions/batch-api.ts:175-179`: the handler reads and forwards the
`Authorization` header but performs no JWT verification of its own —
"Child tasks (extract, match, etc.) consume their own quotas when called."
This is a defensible design for a pure internal fan-out relying on children's
auth, but it has never been assessed as a contract offered to third parties,
because it was never treated as a product surface.

## 3. The three options, costed

### Option A — Delete

**Removes:**
- `netlify/functions/batch-api.ts` (the function)
- `netlify/functions/__tests__/batch-api.test.ts` (its test)
- the `"batch-api": { maxRequests: 5 }` entry in `netlify/lib/rate-limiter.ts:302`
- no `netlify.toml` entry exists to remove (confirmed above)
- the stale `plans/README.md:118` "DECISION" bullet and a note marking
  `plans/012-rate-limit-batch-api-fanout.md` as superseded, so a future audit
  doesn't re-derive SEC-09 against code that no longer exists

**Breaks, if wrong:** a hard 404 with no deprecation window for any
undocumented consumer (see 2b — this cannot be ruled out from the repo alone).
No graceful degradation exists today (no deprecation header, no sunset notice)
because the endpoint was never treated as a versioned public contract.

**Risk level:** low, conditional entirely on the one unconfirmable fact above.

### Option B — Keep as a deliberate public/API-user surface

Requires, at minimum:
- A decision that the no-own-auth design (2c) is acceptable for third-party
  traffic — today it silently inherits whatever auth posture each child
  endpoint happens to have, which was never audited as a public contract.
- Actual documentation (none exists today — not in `docs/`, `README.md`, or
  `.env.example` beyond one implementation comment).
- A versioning/deprecation posture (there is currently no path-based or
  header-based version at all).
- Inclusion as a named, deliberate surface in future security reviews,
  instead of continuing to surface as a recurring "why does this exist"
  finding (as it already has twice — SEC-09/plan 012, and this being the
  third round to flag it per `plans/README.md:118`).

**Cost:** real, ongoing (docs, versioning discipline, security review scope)
for a surface with no confirmed user today.

### Option C — Keep the code, but make Bulk Analysis actually use it

Read both sides before answering, as instructed:

- `BulkAnalysisSection.tsx` calls `parseResume` (from `src/services/api.js`,
  line 23/225) and then `fetch('/.netlify/functions/ai-match', …)` directly
  (line 258), with its own client-side concurrency logic (the `batchSize`
  variable in `resumeText.ts` is unrelated PDF-page batching, and the
  "batch" comments in `BulkAnalysisSection.tsx:310,352` refer to its own
  confirmation-modal grouping, not a network call).
- `batch-api.ts`'s `TaskType` union (`netlify/functions/batch-api.ts:14`) is
  `"optimize" | "predict-questions" | "generate-cover-letter"` — **it does
  not support `match` or `parse` today.** (A historical plan, 005, references
  a `parse` task type that has since been removed from `INTERNAL_ENDPOINTS`;
  the live code has only the three listed above.)

**This is answerable, not "unknown":** Bulk Analysis's actual bottleneck
operation is `ai-match` (per-resume match scoring), which `batch-api` cannot
run at all in its current form. Adopting `batch-api` for Bulk Analysis would
require **adding new task types** (`match`, and possibly `parse`) to
`INTERNAL_ENDPOINTS` and `executeTask`, not just rewiring a caller — a real
feature addition, not a drop-in swap. That is plausible as future work but is
its own scoped change, explicitly out of this spike.

Worth noting: this isn't a gap that was simply never filled — it was actively
narrowed. All three historical docs from the origin commit (`5d68c6e`) list
the original `TaskType` set as `parse`, `match`, `optimize`,
`predict-questions`, `generate-cover-letter` — five types, including the two
Bulk Analysis would need. Live code has only the last three; `match` and
`parse` were removed at some point with no landed plan in this repo
explaining why (plan 005 only accounts for removing the `parse`
beta-code-gate wiring, not the type entry itself). The child endpoint a
restored `match` task would even call has since been renamed
(`match-score` → `ai-match`, confirmed at `BulkAnalysisSection.tsx:258`).
So Option C is not "finish what was started" — it is "rebuild capability that
was progressively stripped out of a surface nobody was maintaining," which
weighs against Option C being cheap and reinforces the delete recommendation
below rather than complicating it.

## 4. Recommendation

**Delete `batch-api.ts`, its test, and its rate-limiter entry — but only
after a maintainer log check confirms zero real invocations over a
meaningful window (see Section 5).** Reasoning: the endpoint has no internal
caller (2a), was orphaned by a refactor rather than deliberately kept as a
public contract (2b), has never been documented, versioned, or security-audited
as a third-party surface (2c, Option B), and has already cost two rounds of
review attention (SEC-09/plan 012, this spike) for a surface nobody is known
to use. Option C is real but is new feature work, not a reason to keep
today's unused, unaudited code sitting live in production in the meantime.

## 5. The one thing this spike could not determine

Whether an undocumented external consumer calls `batch-api` today. Repo
evidence cannot settle this. **What the maintainer should check:** production
invocation logs for the `batch-api` function (Netlify function logs or
whatever log/metrics sink is configured) over a meaningful window — e.g., the
last 30-90 days — filtered to non-test traffic. Zero or near-zero hits
confirms the delete recommendation; any real, human-shaped traffic pattern
should reopen this decision before anything is removed.

## 6. Safe sequencing note (if delete is chosen)

Do not delete blind. Low-risk order:
1. Maintainer checks production request logs for `batch-api` invocations over
   a meaningful window (Section 5).
2. If confirmed cold, optionally add temporary instrumentation/logging (or
   rely on existing Netlify function logs) for one more short window as a
   final confirmation, especially if log retention is short.
3. Only then remove `netlify/functions/batch-api.ts`,
   `netlify/functions/__tests__/batch-api.test.ts`, and the `"batch-api"`
   entry in `netlify/lib/rate-limiter.ts:302`, in a dedicated removal plan
   that also marks `plans/012-rate-limit-batch-api-fanout.md` as superseded
   and updates the `plans/README.md:118` bullet — so a future audit doesn't
   re-derive this finding against code that no longer exists.
