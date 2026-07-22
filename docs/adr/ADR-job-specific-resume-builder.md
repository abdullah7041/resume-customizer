# ADR: Job-Specific Resume Builder

**Status:** Proposed
**Date:** 2026-07-05
**Deciders:** Product owner + engineering (Watheq)
**Related:** engineering plan §5.1 (deleted in `dee2ee3`; its persistence/retention constraints are restated in §5 of this ADR), `CLAUDE.md` (truth-preservation rules), memory `future-plan.md` (job tracker roadmap)

> **Schema/contract-change legend:** every place this design would force a change to a persisted shape, DB schema, or function contract is marked **⚑ SCHEMA/CONTRACT**. Search this document for `⚑` to find them all.

---

## 1. Context

Today Watheq treats one resume + one job description as a single throwaway session. A user pastes a JD, runs Match, runs Optimize, picks a template, exports, and the run is gone. Re-targeting the same resume at a second job means re-doing the whole flow with no memory of the first.

The **Job-Specific Resume Builder** is a guided flow that captures a single job's context and builds a *variant* of the base resume tuned for that job — reusing the existing parse, match, optimize, and template systems rather than adding a parallel pipeline. The core question this ADR answers: **how does a job-specific variant relate to the base resume, and where does it live, without breaking Watheq's single-source-of-truth and truth-preservation guarantees?**

Forces at play:

- The store is *already* an overlay engine (`originalResume` + `applied`-gated optimization cards). A variant is a natural fit for this model, not a new document type.
- Watheq's trust posture (§5 of this ADR, `CLAUDE.md`) is strict: no fabricated content, `applied: true` gating, skills never auto-injected, resume PII minimized in every storage tier. A variant feature must inherit all of it, not weaken it.
- We have no evidence yet that users *want* multi-job re-targeting. The design must let us ship a small, local-only Phase 1 to measure demand before paying for server persistence.

---

## 2. Decision

**A job-specific variant is an applied-cards-replay overlay on the single canonical base resume — not a fork and not a JSON patch.**

A variant is a lightweight record:

```ts
// ⚑ SCHEMA/CONTRACT (frontend persisted state) — new type; see §5 for the
// resume-storage migration this implies.
interface JobVariant {
  id: string;                          // uuid
  label: string;                       // user-facing, e.g. "Senior PM @ Aramco"
  jobTitle?: string;
  jobDescription: string;              // truncated for storage (see §5)
  jobDescriptionHash: string;          // reuses generateCacheKey() fingerprint
  createdAt: string;
  updatedAt: string;
  // The variant's own optimization card set — same shape the store already uses.
  optimizations: OptimizationResult[]; // each carries original/optimized/applied/rationale
  keywordSuggestions: KeywordSuggestion[];
  optimizationMetrics: OptimizationMetrics;
  baselineMatchScore: number | null;
  selectedTemplate: TemplateId;
}
```

Rendering a variant = calling the store's existing `getActiveResume()` logic **parameterized by that variant's card set** instead of the global `optimizations` array. The base `originalResume` is shared and immutable across all variants. Nothing about a variant duplicates resume facts — it only holds job context plus the AI-proposed, user-gated edits scoped to that job.

This is the smallest possible addition: the store already replays `applied: true` cards over an immutable base via fuzzy match (`resumeStore.ts` `getActiveResume` / merge logic). We are giving that machinery a second, named home per job.

---

## 3. Options Considered

### Option A — Fork (deep-copy the resume per job)

Each variant stores a full independent `ResumeSchema`.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low to build, high to live with |
| Storage cost | High — full PII duplicated per job |
| Truth model | **Breaks single-source-of-truth** |
| Reuse | Poor — bypasses the overlay engine |

**Pros:** conceptually trivial; each variant is self-contained.
**Cons:** Base-resume corrections (fix a typo, update a date) do **not** propagate to existing variants — they silently drift. Full resume PII is duplicated into every storage tier, multiplying the export/delete and redaction surface (contradicts the minimization constraints restated in §5 of this ADR). Discards the `original`/`applied`/`rationale` provenance the card model gives us for free.

### Option B — Overlay via JSON patch (diff per variant)

Each variant stores a JSON-patch diff against the base.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium-high |
| Storage cost | Low |
| Truth model | Weak — loses card provenance |
| Reuse | Poor — new merge path |

**Pros:** compact; base edits mostly propagate.
**Cons:** A raw patch loses *why* each change exists — no `original`, no `applied` toggle, no `rationale`/`issue` audit fields that the UI and truth-preservation rules depend on. Patches are brittle when the base changes shape (a re-parse renumbers work entries). Introduces a second merge algorithm alongside the existing fuzzy-merge, doubling the surface for merge bugs.

### Option C — Applied-cards-replay (CHOSEN)

Variant = job context + its own `OptimizationResult[]`, replayed over the shared immutable base by the existing engine.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — reuses existing replay |
| Storage cost | Low — no PII duplication |
| Truth model | **Strongest** — cards *are* the audit trail |
| Reuse | Highest — same `getActiveResume` path |

**Pros:** Zero new merge algorithm. Base stays canonical; base edits propagate to every variant on next render because variants never copy base facts. Each card already carries `original` (ground truth), `applied` (user gate), and `rationale`/`issue`, so truth-preservation is inherited, not re-implemented. Optimize responses are already keyed by (resume, JD) — per-variant Redis cache hits come free.
**Cons:** A variant's cards can go stale if the base resume is edited such that a card's `original` no longer fuzzy-matches any section — but this is *desirable*: a stale card simply stops applying (fails safe to base truth) rather than injecting outdated text. Surface this in the UI as "re-run optimize for this job."

---

## 4. Trade-off Analysis

The decisive axis is **truth preservation vs. storage independence**. Fork maximizes independence at the cost of truth (drift + duplication). Applied-cards-replay maximizes truth (one canonical base, every edit user-gated and provenanced) at the cost of independence — variants are coupled to the current base, and a base edit can invalidate a card. That coupling is the *correct* default for a product whose entire trust story is "we never fabricate and never silently change your facts." A stale card that stops applying is a safe failure; a forked resume that silently keeps an outdated fact is not.

Applied-cards-replay also wins on cost-to-ship: it is additive over machinery that already exists and is tested, so Phase 1 touches **frontend state only** — no Netlify function, schema, or AI-contract change (see §7).

---

## 5. Storage, Retention & Privacy

Grounded in engineering plan §5.1 (deleted in `dee2ee3`; its persistence/retention constraints are restated in §5 of this ADR). Per-tier plan:

### localStorage (Phase 1 home)

- Variants persist inside the existing Zustand `resume-storage` key via `partialize`, as a `jobVariants: JobVariant[]` slice plus an `activeVariantId`.
  **⚑ SCHEMA/CONTRACT (persisted state):** this changes the shape of `resume-storage`. Requires bumping the persist `version` and adding a `migrate` step in `resumeStore.ts` so existing users' persisted state (which has no `jobVariants`) hydrates cleanly to `jobVariants: [], activeVariantId: null`. The existing custom `merge` in `resumeStore.ts` must also pass the new slice through.
- **Alternative considered:** a separate `watheq:jobVariants` localStorage key (matching the `watheq:` prefix convention). Rejected for Phase 1 because it splits one logical state across two keys and complicates atomic clear on `clearAll()`/`resetForNewUpload()`. Keep it in `resume-storage`.
- **JD minimization:** store the job description truncated (mirroring the truncation posture restated in §5 of this ADR) plus the `generateCacheKey` fingerprint. Do not persist the raw full JD if a truncated form + hash suffices for re-run and display.

### Redis / Upstash (unchanged)

- **No change.** The optimize v1/v2 caches already key on a SHA-256 of (resume, JD, language, mode) via `buildCacheKey` (`netlify/lib/redis-cache.ts`) at a **10-minute TTL** (§5 of this ADR, because values carry resume-derived AI snippets). Because each variant carries a distinct JD, per-variant optimize calls hit distinct cache keys automatically. No new namespace, no TTL change. **⚑** none.

### Supabase (Phase 2 only — deferred)

- Phase 1 writes **nothing** server-side; variants are local-only, so there is no new PII on the server and no new retention obligation.
- Phase 2 cloud sync needs a store. Two paths, both schema changes:
  - **⚑ SCHEMA/CONTRACT (DB):** either a new `resume_variants` table (email-keyed, service-role-only, RLS mirroring the existing `resumes` policies at `supabase/migrations/20260310_refactor_to_email.sql`) **or** extend `job_matches` with variant columns. Per CLAUDE.md, migrations are **output as SQL for the user to run in the Supabase dashboard — never applied directly.**
  - **⚑ SCHEMA/CONTRACT (export/delete):** `netlify/functions/user-data-api.ts` must add the new table to its export bundle (`select` block ~line 74–82), its deletion list (~line 131–140), and the `deletion_log`. GDPR-style export/delete is incomplete until this lands. This is a hard gate on Phase 2 — variants holding job context are user data.

### Sentry / logs (unchanged)

- Variant operations log counts/lengths/ids only, through `sanitizeSentryContext()` — never raw JD or resume text (§5 of this ADR). **⚑** none, but the rule applies to any new log lines.

### Retention policy

- Phase 1: variants live in the browser until the user clears them (or clears site data / uses "start new upload"); they inherit the resume's local retention exactly. No server copy, no server retention clock.
- Phase 2: variants inherit the `resumes`/`job_matches` retention and are covered by the same account-deletion path (once the ⚑ export/delete work above is done).

---

## 6. Truth Preservation

The variant model inherits — does not re-implement — every existing guarantee:

- **Immutable base.** `originalResume` is the single source of facts. Switching, creating, or deleting a variant never mutates it. Variants hold only job context + cards.
- **User-approved facts only.** A variant renders through the same `applied: true` gate. A card that is proposed but not applied changes nothing. Each card's `original` field preserves the ground-truth text per variant, so a rejected/reverted edit always falls back to the user's real content.
- **`applied: true` behavior carries over verbatim.** Rendering is `getActiveResume()` scoped to the variant's card set — identical replay semantics, identical fuzzy-merge, identical Saudi-nationality summary handling.
- **Nothing auto-injected.** Skills and keyword suggestions remain recommendation-only per variant (CLAUDE.md). No card is ever auto-flipped to `applied`. Inferred metrics keep their `(verify)` markers.
- **Provenance retained.** AI-modified data continues to be tracked in `meta.ai_suggestions`, now scoped per variant, preserving schema integrity.
- **Fail-safe staleness.** If a base edit makes a card's `original` no longer match, the card silently stops applying (falls back to base truth) rather than injecting outdated text — surfaced in UI as "re-run optimize."

---

## 7. Reuse Map

### Reused as-is (no change)

| Component | Why unchanged |
|-----------|---------------|
| `ai-match` function | Stateless over (resume, JD) |
| `optimize` / `optimize-stream` | Stateless; already accept resume + JD + optional `workHistory` |
| `generate-cover-letter` | Per-request; `tone` param already exists |
| `generate-pdf` | Renders whatever active resume it's handed |
| `parse-resume` / `extract-resume-json` | Base resume is parsed once, shared by all variants |
| Template registry (`src/components/templates/`) | Variant carries a `selectedTemplate` id; renderer is unchanged |
| `redis-cache` + optimize cache | Per-variant JD → distinct keys automatically |
| `withRateLimit`, `user-data-api` (Phase 1) | Untouched until Phase 2 |

### Needs parameterization (frontend only)

| Component | Change |
|-----------|--------|
| `resumeStore.ts` | Add `jobVariants` + `activeVariantId` slice; add variant CRUD actions; make `getActiveResume` resolve cards from the active variant (falling back to the global array when no variant is active, preserving today's single-run flow). **⚑ SCHEMA/CONTRACT** — persisted `resume-storage` shape + `version`/`migrate` (see §5). |
| Variant list / switcher UI | New component wrapping the existing Match→Optimize→Template flow; "save this run as a variant", "reopen", "delete". |
| `TemplatesSection.tsx` filename | Already produces `Name_Position` — feed it the variant's `jobTitle`. Trivial/no structural change. |

### Needs nothing

`netlify/lib/openrouter-client.js`, `netlify/lib/resume-schemas.ts`, `netlify/lib/ai-contracts/`, all Netlify AI function request/response contracts. **Phase 1 introduces zero backend contract changes.** ⚑ (explicit confirmation).

---

## 8. Phased Plan

### Phase 1 — Local, single active variant (shippable alone)

- One base resume, N locally-saved variants, one active at a time.
- User flow: run Match + Optimize against a JD as today → "Save as job variant" → variant appears in a list → "Reopen" restores that job's cards, metrics, template, and score → export.
- Scope: variant store slice + `resume-storage` migration (⚑), variant list/switcher UI, wire `getActiveResume` to the active variant.
- **Ships with no Netlify, schema, or AI-contract change beyond the persisted-state migration.**

**Deliberately out of scope for Phase 1** (mark clearly, do not build):

- Supabase cloud sync of variants (Phase 2).
- Side-by-side variant comparison / diffing.
- Bulk JD import or multi-JD batch (that's the separate Bulk Analysis feature).
- Sharing links / public variant URLs.
- Any auto-apply of cards or auto-selection of a "best" variant.
- Cross-device continuity.

### Phase 2 — Cloud persistence (gated on Phase 1 signal)

- **⚑** New `resume_variants` table (or `job_matches` extension) — SQL output for the user to run, RLS mirroring `resumes`.
- **⚑** `user-data-api.ts` export + delete + `deletion_log` coverage (hard gate — no ship without it).
- Sync local variants ⇄ Supabase for signed-in users; keep local-only for guests.

### Phase 3 — Compare & track (roadmap tie-in)

- Side-by-side variant compare, per-job status ("applied", "interviewing"), feeding the job-tracker dashboard in `future-plan.md`. New schema likely — defer its ADR.

---

## 9. Kill Criteria

**Build Phase 1 if** analytics show real repeat re-targeting on the *same* resume:

- Signal (measurable today): ≥20–25% of users who complete one optimize run start a second optimize with a **different** JD on the same base resume within 14 days. Derivable from `ai_usage_events` (optimize events per user) cross-referenced with `watheq:lastJobDescription` churn / distinct JD fingerprints per session.
- If repeat re-targeting is negligible, the base flow is sufficient and this feature is premature — do not build.

**Kill the idea (after Phase 1 ships)** if the feature doesn't earn its keep over ~4 weeks:

- Variant **save rate** stays below ~5% of optimize completions (users finish a run but never save it as a variant), **or**
- Variant **reopen rate** stays below ~10% of saved variants (users save but never come back). Saving without reopening means the value was in the single run, not the persistence — kill and reclaim the store/UI complexity before Phase 2.

Do **not** advance to Phase 2 (server persistence, with its migration + export/delete + retention cost) until Phase 1 clears both the save-rate and reopen-rate thresholds.

---

## 10. Consequences

**Easier:**
- Multi-job targeting becomes first-class with almost no new backend surface.
- Truth-preservation guarantees extend to variants for free (cards are the audit trail).
- Per-variant optimize caching works with zero cache changes.

**Harder / to revisit:**
- The persisted `resume-storage` shape gains a slice and a migration (⚑) — every future persist change now coexists with variants.
- Card staleness on base edits needs a clear UI affordance ("re-run optimize for this job").
- Phase 2 cannot ship until `user-data-api` export/delete covers variants (⚑) — a real gate, not a nicety.

**To revisit later:**
- Whether variants outgrow the single-key `resume-storage` home and need their own `watheq:jobVariants` key.
- Whether Phase 3 compare/track warrants promoting variants to a normalized server model.

---

## 11. Action Items

1. [ ] Confirm the Phase-1 kill-criteria metric is queryable from current `ai_usage_events` + JD-fingerprint data before committing to build.

   Instrumentation shipped 2026-07-22 (plan 016); the metric is computable approximately 14 days after the maintainer applies migration `20260722000000_ai_usage_user_attribution.sql` and sets `AI_USAGE_USER_ATTRIBUTION=true`.

   ```sql
   -- Repeat re-targeting rate (ADR section 9): of users with at least one
   -- successful optimize event, the share with at least two distinct
   -- jd_fingerprints in the 14 days after their first optimize event.
   with optimizers as (
     select user_ref, jd_fingerprint, created_at
     from public.ai_usage_events
     where feature_name in ('optimize_resume', 'optimize_stream')
       and success
       and user_ref is not null
       and jd_fingerprint is not null
   ),
   firsts as (
     select user_ref, min(created_at) as first_at
     from optimizers
     group by user_ref
   )
   select
     count(*) filter (where retargeted) as retargeting_users,
     count(*) as measured_users,
     round(
       100.0 * count(*) filter (where retargeted) / greatest(count(*), 1),
       1
     ) as pct
   from (
     select
       f.user_ref,
       (
         select count(distinct o.jd_fingerprint)
         from optimizers o
         where o.user_ref = f.user_ref
           and o.created_at <= f.first_at + interval '14 days'
       ) >= 2 as retargeted
     from firsts f
     where f.first_at <= now() - interval '14 days'
   ) t;
   ```
2. [ ] (On approval) Design the `resume-storage` `version`/`migrate` bump for the `jobVariants` slice (⚑).
3. [ ] (On approval) Parameterize `getActiveResume` by active variant with fallback to today's global card array.
4. [ ] Defer all Supabase/`user-data-api` work to a Phase-2 ADR follow-up, gated on Phase-1 signal.
