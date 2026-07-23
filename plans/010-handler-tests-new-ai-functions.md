# Plan 010: Add handler tests for the six untested AI Netlify functions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- netlify/functions/ netlify/functions/__tests__/`
> If any in-scope handler changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/009-ci-pipeline.md (recommended, not blocking)
- **Category**: tests
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

Six authenticated, rate-limited, AI-cost-bearing Netlify functions shipped recently with **zero handler tests**: `onboard-extract`, `extract-job-metadata`, `generate-clarifications`, `refine-bullet`, `resume-truth-check`, `vision2030-alignment`. Two of them (`refine-bullet`, `resume-truth-check`) mutate user-facing resume content. Regressions in auth gating, request validation, the error envelope, or AI-response handling currently ship undetected. These tests are also the prerequisite safety net for a future shared-auth-wrapper refactor (unplanned candidate in `plans/README.md`) — the boilerplate these six copy-paste has already drifted between them.

## Current state

- Target handlers, all in `netlify/functions/`, all shaped as `export const handler = withRateLimit('<name>', baseHandler)` with v1 `Handler` signature:
  - `refine-bullet.ts` — the smallest and the canonical shape; verified excerpt of its skeleton:

    ```ts
    // refine-bullet.ts:28-58 (abridged)
    const baseHandler: Handler = async (event) => {
      try {
        if (event.httpMethod !== 'POST') {
          return { statusCode: 405, headers: jsonHeaders, body: errorBody(405, 'method/not-allowed', 'Method Not Allowed') };
        }
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader) {
          return { statusCode: 401, ..., body: errorBody(401, 'auth/required', ...) };
        }
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const supabase = getSupabaseClient();
        ...
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
          return { statusCode: 401, ..., body: errorBody(401, 'auth/invalid', ...) };
        }
        const rawBody = JSON.parse(event.body || '{}');
        const parseResult = RequestSchema.safeParse(rawBody);
        if (!parseResult.success) {
          return { statusCode: 400, ..., body: errorBody(400, 'request/invalid', ...) };
        }
        ...
        const result = await executeAiContract('refine_bullet', {...});
    ```

    Its Zod schema (`:14-21`): `original` (1–2000), `currentImproved` (1–2000), `userInstruction` (1–500), `jobContext` (optional, default ''), `resumeText` (1–60000), `language` ('en'|'ar', default 'en'). Success 200 body: `{ improved, issue, rationale }`. Error path returns 500/504 with code `refine/failed`.
  - `resume-truth-check.ts`, `generate-clarifications.ts`, `extract-job-metadata.ts`, `onboard-extract.ts`, `vision2030-alignment.ts` — same skeleton family, each with its own Zod schema and `executeAiContract('<contract_id>', ...)` call. Read each handler before writing its test — schemas and error codes differ per file (e.g. `extract-job-metadata.ts:33` returns a bare-string 405 body, an already-known drift; test the **current** behavior, do not "fix" it here).
  - `vision2030-alignment.ts:95-113` additionally calls `consumeCredits(userEmail, 'vision2030')` after the AI call and spreads `creditsRemaining` into the response — its test must also mock `../lib/credit-manager.js`.
- Exemplar test to model after — `netlify/functions/__tests__/import-job-url.test.ts:1-45` (verified):

  ```ts
  const { safeFetchMock, checkFreePreviewMock, getUserMock } = vi.hoisted(() => ({ ... }));

  vi.mock('../../lib/rate-limiter.js', () => ({
    withRateLimit: (_name: string, handler: unknown) => handler,
    checkFreePreviewRateLimit: checkFreePreviewMock,
  }));
  vi.mock('../../lib/supabase-client.js', () => ({
    getSupabaseClient: vi.fn(() => ({ auth: { getUser: getUserMock } })),
  }));
  vi.mock('../../lib/sentry.js', () => ({
    initSentry: vi.fn(), captureError: vi.fn(),
    summarizeErrorForLog: vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
  }));

  const { handler } = await import('../import-job-url.js');

  const invoke = async (body: unknown, headers: Record<string, string> = {}): Promise<HandlerResponse> => {
    const event = { httpMethod: 'POST', headers, body: JSON.stringify(body) } as unknown as HandlerEvent;
    return (await handler(event, {} as never)) as HandlerResponse;
  };
  ```

  For the AI boundary, mock `../../lib/ai-contracts/executor.js` with `executeAiContract: vi.fn()`.
- Test runner: vitest; function tests live in `netlify/functions/__tests__/*.test.ts`.

## Commands you will need

| Purpose   | Command                                                        | Expected on success |
|-----------|----------------------------------------------------------------|---------------------|
| Run new tests | `npx vitest run netlify/functions/__tests__/refine-bullet.test.ts` (etc., per file) | all pass |
| All function tests | `npx vitest run netlify/functions/__tests__/`             | all pass            |
| Typecheck | `npm run type:check`                                           | exit 0              |

## Scope

**In scope** (create only — no production code changes):
- `netlify/functions/__tests__/refine-bullet.test.ts`
- `netlify/functions/__tests__/resume-truth-check.test.ts`
- `netlify/functions/__tests__/generate-clarifications.test.ts`
- `netlify/functions/__tests__/extract-job-metadata.test.ts`
- `netlify/functions/__tests__/onboard-extract.test.ts`
- `netlify/functions/__tests__/vision2030-alignment.test.ts`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- The six handlers themselves — these are characterization tests of CURRENT behavior. Divergent error envelopes (bare-string 405s, differing error codes) get tested as-is; normalizing them is the future wrapper refactor.
- `import-job-url.ts` / `feedback-api.ts` — already tested.

## Git workflow

- Branch: `advisor/010-handler-tests`
- Suggested commit: `test(functions): characterization tests for six AI handlers`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `refine-bullet.test.ts` (template for the rest)

Model the mock harness on `import-job-url.test.ts` (excerpt above), plus `vi.mock('../../lib/ai-contracts/executor.js', ...)`. Cases:

1. non-POST → 405, body matches the handler's actual envelope (`code: 'method/not-allowed'`).
2. missing Authorization header → 401 `auth/required`.
3. `getUserMock` resolves `{ data: { user: null }, error: {...} }` → 401 `auth/invalid`.
4. authenticated + invalid body (e.g. missing `resumeText`) → 400 `request/invalid`; assert `executeAiContract` NOT called.
5. authenticated + valid body + `executeAiContract` resolves `{ improved, issue, rationale }` → 200 with exactly those fields; assert the contract id and input fields passed.
6. `executeAiContract` rejects → 500 envelope `refine/failed`; rejects with `{status: 504}` → 504.

**Verify**: `npx vitest run netlify/functions/__tests__/refine-bullet.test.ts` → 6 tests pass.

### Step 2: Replicate for the other five

For each of `resume-truth-check`, `generate-clarifications`, `extract-job-metadata`, `onboard-extract`: read the handler first, adapt the schema fixture and expected envelope (405 body shape, error codes, success payload) to that file's ACTUAL behavior. Same 6-case skeleton; drop/adjust cases that don't apply (e.g. if a handler allows guest access, test that branch instead of 401).

For `vision2030-alignment`: additionally `vi.mock('../../lib/credit-manager.js', () => ({ consumeCredits: consumeCreditsMock }))`; assert 200 spreads `creditsRemaining` from the mock. Add one pinned characterization case: `consumeCredits` resolving `{ success: false, creditsRemaining: 0 }` — pin whatever the handler currently returns (audit finding: it ignores `success`; plan 013 changes this and will update the pin).

**Verify** after each file: its focused vitest run passes.

### Step 3: Full pass

**Verify**: `npx vitest run netlify/functions/__tests__/` → all pass; `npm run type:check` → exit 0.

## Test plan

This plan IS the test plan — ~6 cases × 6 handlers ≈ 34–36 new tests, structural pattern `import-job-url.test.ts`.

## Done criteria

- [ ] Six new test files exist, each with ≥5 passing cases
- [ ] `npx vitest run netlify/functions/__tests__/` exits 0
- [ ] `npm run type:check` exits 0
- [ ] Zero production files modified (`git status` shows only `__tests__/` + plans)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A handler's real behavior differs from its code in a way that looks like a live bug (e.g. auth check bypassable, 200 on invalid input) — report it as a finding instead of encoding it as "expected".
- A handler imports a module whose mock requires replicating heavy internals (more than ~20 lines of mock) — report; that handler may need a different seam.
- Any test needs a real network call or API key to pass.

## Maintenance notes

- These are characterization tests: when the shared-wrapper refactor lands (unplanned candidate), the envelope assertions are the safety net and will be updated deliberately in that work — not silently.
- Plan 013 changes `vision2030-alignment`'s handling of failed credit consumption; its pinned test case is expected to be updated there.
