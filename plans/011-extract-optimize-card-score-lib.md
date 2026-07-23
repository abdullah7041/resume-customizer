# Plan 011: Extract shared optimization card/score building into netlify/lib

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- netlify/functions/optimize.ts netlify/functions/optimize-stream.ts`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (do NOT run concurrently with plan 013 — both touch optimize-adjacent files; 013's optimize change is in vision2030 only, but coordinate branches)
- **Category**: tech-debt
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

The logic that converts an AI optimization response into user-facing cards (~110 lines: Headline/Summary/Experience/Skills branches, N/A filtering, copy strings) exists twice: inline in `optimize.ts` and as `buildOptimizationCards` in `optimize-stream.ts`. Since the last audit the **score computation** got duplicated too (`beforeScore` normalization + category-score fallback + `estimatedImprovement`). Commit `ceed480 (#123, "harden Optimize scoring")` had to patch scoring in both files; the next tweak that lands in only one will silently diverge the streaming response from the legacy fallback response — the exact bug class the frontend's fallback design assumes cannot happen. One shared module ends the lockstep requirement.

## Current state

- `netlify/functions/optimize.ts` — legacy v1 endpoint (JSON response). Card building is inline at `:218-337`; verified excerpt of its opening:

  ```ts
  // optimize.ts:218-232
  const cards: Array<{
    section: string;
    issue: string;
    suggestion: string;
    exampleBefore: string;
    exampleAfter: string;
  }> = [];

  // Helper to validate content exists and extract string value
  const hasContent = (value: unknown): boolean => {
    if (!value) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  };
  ```

  Score block at `:346-368` (verified opening):

  ```ts
  // optimize.ts:346-352
  let beforeScore: number | null = null;
  if (optimization?.match_score != null) {
    beforeScore = normalizeScore(optimization.match_score, 'match_score');
  }
  // Fallback: Calculate from category_scores if match_score is missing
  if (beforeScore === null && optimization?.category_scores) {
  ```

- `netlify/functions/optimize-stream.ts` — v2 SSE endpoint. Same logic as named functions: `buildOptimizationCards(optimization)` at `:499-608` (verified opening below) and `calculateScores` at `:611-621`:

  ```ts
  // optimize-stream.ts:499-512
  function buildOptimizationCards(optimization: any) {
    const cards: Array<{
      section: string;
      issue: string;
      suggestion: string;
      exampleBefore: string;
      exampleAfter: string;
    }> = [];
    // Headline
    const suggestedHeadline = optimization?.suggested_headline || null;
    ...
  ```

  ```ts
  // optimize-stream.ts:611-618
  let beforeScore: number | null = null;
  if (optimization?.match_score != null) {
    beforeScore = normalizeScore(optimization.match_score, "match_score");
  }
  if (beforeScore === null && optimization?.category_scores) {
    beforeScore = scoreFromCategoryScores(optimization.category_scores);
    console.log("[optimize-stream] Calculated match_score from category_scores:", beforeScore);
  ```

- Note the console log prefixes differ (`[optimize]` vs `[optimize-stream]`) — the shared module must take a `logPrefix` parameter, not hardcode one.
- `netlify/lib/score-utils.ts` — already-shared score helpers (`normalizeScore`, `scoreFromCategoryScores`, …) imported by both endpoints; the new module sits beside it and composes it.
- Tests (the regression guard): `netlify/functions/__tests__/optimize.test.ts` (16.4K) and `optimize-stream.test.ts` (14.3K) assert response shapes end-to-end through the handlers. They must pass **unchanged** — that is the proof the extraction preserved behavior.
- CLAUDE.md constraint to honor: both endpoints "share the same card-building logic" is a documented invariant; scoring anti-inflation rules must not be altered while moving code — this is a **pure move**, zero behavior change.

## Commands you will need

| Purpose   | Command                                                          | Expected on success |
|-----------|------------------------------------------------------------------|---------------------|
| Focused tests | `npx vitest run netlify/functions/__tests__/optimize.test.ts netlify/functions/__tests__/optimize-stream.test.ts` | all pass, unchanged |
| Typecheck | `npm run type:check`                                             | exit 0              |
| Lint      | `npx eslint netlify/functions/optimize.ts netlify/functions/optimize-stream.ts netlify/lib/optimize-cards.ts` | exit 0 |

## Scope

**In scope**:
- `netlify/lib/optimize-cards.ts` (create)
- `netlify/functions/optimize.ts` (replace inline blocks with imports)
- `netlify/functions/optimize-stream.ts` (replace local functions with imports)
- `netlify/lib/__tests__/optimize-cards.test.ts` (create, small)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `netlify/functions/__tests__/optimize.test.ts` / `optimize-stream.test.ts` — if you need to change them, the extraction changed behavior: STOP.
- `netlify/lib/score-utils.ts` — compose it, don't modify it.
- Any prompt, scoring rule, card copy string, or threshold. Copy strings move verbatim.
- The endpoints' credit/billing logic (plans 001–003 hardened it; stay clear).

## Git workflow

- Branch: `advisor/011-optimize-cards-lib`
- Suggested commit: `refactor(optimize): extract shared card/score building to netlify/lib/optimize-cards`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the shared module from the streaming copy

Create `netlify/lib/optimize-cards.ts`. Move (verbatim) from `optimize-stream.ts`: `buildOptimizationCards` and its helpers (`hasContent`, any `getString`-style helper it uses — take the streaming versions as canonical), exporting them. Add an exported `calculateScores(optimization, { logPrefix })` built from the streaming `calculateScores`/score block, with every `console.log("[optimize-stream] ...")` replaced by `` console.log(`${logPrefix} ...`) ``. Type the optimization input as the loosest type both endpoints currently use (they use `any`/structural access — keep that; do NOT invent a strict interface in this plan, per the "pure move" rule; note it in Maintenance).

**Verify**: `npm run type:check` → exit 0 (new module compiles; endpoints untouched so far).

### Step 2: Diff the two copies before switching

Before rewiring, produce an explicit diff of the two card builders to confirm they are logic-identical (the audit found them identical, but #123 postdates that reading):

`git diff --no-index <(sed -n '218,337p' netlify/functions/optimize.ts) <(sed -n '499,608p' netlify/functions/optimize-stream.ts)` — or extract both ranges to scratch files and diff. Cosmetic differences (quotes, `const` names) are fine; **any logic difference** (different branch condition, different copy string, an extra card type) → STOP and report the divergence; the maintainer must say which side is correct.

**Verify**: diff shows only cosmetic differences (record the diff output in your report).

### Step 3: Switch `optimize-stream.ts`

Replace the local `buildOptimizationCards` + `calculateScores` with imports from `../lib/optimize-cards.js` (match the repo's `.js`-suffix import convention used for lib imports in these functions), passing `logPrefix: '[optimize-stream]'`.

**Verify**: `npx vitest run netlify/functions/__tests__/optimize-stream.test.ts` → all pass unchanged.

### Step 4: Switch `optimize.ts`

Replace the inline card block (`:218-337`) and score block (`:346-368`) with calls to the shared imports, `logPrefix: '[optimize]'`. Preserve surrounding variable names the later response-assembly code consumes (`cards`, `beforeScore`, `estimatedImprovement`, etc.).

**Verify**: `npx vitest run netlify/functions/__tests__/optimize.test.ts` → all pass unchanged.

### Step 5: Unit-test the shared module

Create `netlify/lib/__tests__/optimize-cards.test.ts` with a handful of direct cases: empty optimization → 0 cards; headline pair present → headline card with exact copy; N/A-valued suggestion filtered; `match_score` present vs `category_scores` fallback in `calculateScores`. Model file layout on `netlify/lib/__tests__/score-utils.test.ts`.

**Verify**: `npx vitest run netlify/lib/__tests__/optimize-cards.test.ts` → pass. Then full: `npx vitest run netlify/functions/__tests__/ netlify/lib/__tests__/optimize-cards.test.ts` → pass; `npm run type:check` → exit 0.

## Test plan

Existing `optimize.test.ts` + `optimize-stream.test.ts` unchanged and green = behavior preserved. New `optimize-cards.test.ts` = direct coverage so future card changes are testable without handler harnesses.

## Done criteria

- [ ] `netlify/lib/optimize-cards.ts` exists; both endpoints import from it
- [ ] `grep -c "buildOptimizationCards" netlify/functions/optimize-stream.ts` shows import/usage only (no local definition)
- [ ] Card-building code appears exactly once in the repo: `grep -rn "suggested_headline" netlify/functions/ netlify/lib/` hits only `optimize-cards.ts` (plus tests)
- [ ] Both existing test files pass WITHOUT modification
- [ ] `npm run type:check` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 2's diff reveals a logic difference between the two copies — do not pick a winner yourself.
- Either existing test file fails after the switch and the fix would require editing the test — behavior changed; revert the step and report.
- The inline block boundaries in `optimize.ts` no longer match `:218-337`/`:346-368` (drift from newer commits) and you cannot confidently identify the equivalent region.

## Maintenance notes

- Future card or scoring changes now land in ONE file; reviewers should reject any PR re-introducing card logic in an endpoint.
- Deferred deliberately: typing the `optimization` input with a proper interface (would touch the AI-contract Zod output types — separate change), and unifying the two endpoints' remaining response-assembly differences.
- CLAUDE.md's SSE gotcha ("Both endpoints share the same card-building logic") becomes literally true; consider updating that line to name `netlify/lib/optimize-cards.ts` (fits plan 015's doc pass).
