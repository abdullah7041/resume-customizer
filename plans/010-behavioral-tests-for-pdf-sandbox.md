# Plan 010: Extract and behaviorally test the generate-pdf sandbox controls

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ceed480..HEAD -- netlify/functions/generate-pdf.ts netlify/functions/__tests__/generate-pdf.security.test.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (behavior-preserving extraction + test-only additions)
- **Depends on**: none
- **Category**: security (test coverage of a security control)
- **Planned at**: commit `ceed480`, 2026-07-21

## Why this matters

`generate-pdf.ts` renders **attacker-supplied HTML** (the `html`/`styles` request
fields) inside headless Chromium. Three controls neutralize that: request
interception that aborts everything except the `about:`/`data:`/`blob:` protocol
allowlist, and `setJavaScriptEnabled(false)`. Today those controls are guarded
only by a test that string-matches the source file
(`generate-pdf.security.test.ts` asserts `source.toContain('setRequestInterception(true)')`).
Worse, `setJavaScriptEnabled(false)` — a core control — is not asserted by any
test at all. A refactor that removes the JS-disable, reorders interception after
`setContent`, or widens the protocol allowlist would keep CI green while
re-opening XSS/SSRF against internal endpoints (e.g. an `<img src="http://…">`
pointing at a link-local metadata address, or CSS `@import url(internal)` in the
`styles` field).

This plan extracts the sandbox wiring into small, exported, testable functions
and adds **behavioral** tests that drive mock Puppeteer objects — so the tests
fail if the abort/continue decision or the JS-disable actually changes, not just
if the source text changes. Runtime behavior of the handler is unchanged.

## Current state

Relevant files:

- `netlify/functions/generate-pdf.ts` — the PDF function. Security-relevant
  regions:
  - `ALLOWED_RENDER_REQUEST_PROTOCOLS` set + `isAllowedRenderRequest()` at lines
    109–118 (top-level, currently **not exported**).
  - The request-interception wiring inside `baseHandler` at lines 192–203:
    `setRequestInterception(true)`, the `page.on("request", …)` callback that
    calls `request.continue()` / `request.abort("blockedbyclient")`, and
    `setJavaScriptEnabled(false)`.
- `netlify/functions/__tests__/generate-pdf.security.test.ts` — the existing
  source-string test (28 lines).

Excerpt as of commit `ceed480` (`generate-pdf.ts:109-118`):
```ts
const ALLOWED_RENDER_REQUEST_PROTOCOLS = new Set(["about:", "data:", "blob:"]);

function isAllowedRenderRequest(requestUrl: string): boolean {
  try {
    const parsed = new URL(requestUrl);
    return ALLOWED_RENDER_REQUEST_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}
```

Excerpt (`generate-pdf.ts:192-203`):
```ts
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (isAllowedRenderRequest(request.url())) {
        void request.continue();
        return;
      }

      void request.abort("blockedbyclient");
    });

    // Disable JavaScript to prevent script execution from client-provided HTML
    await page.setJavaScriptEnabled(false);
```

Conventions: TypeScript strict, no `any` (use minimal local interfaces for the
mock shapes); tests use Vitest (`describe`/`it`/`expect`); test files live in
`netlify/functions/__tests__/`. The function imports `puppeteer-core` and
`@sparticuz/chromium` at module top — **do not** launch a real browser in tests;
test the extracted pure/wiring functions with mocks instead.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run type:check` | exit 0, no errors |
| Focused tests | `npm run test -- netlify/functions/__tests__/generate-pdf.security.test.ts` | all pass |
| Lint | `npm run lint:fix` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `netlify/functions/generate-pdf.ts` — export the predicate; extract the request
  callback and the sandbox setup into named exported functions; call them from
  `baseHandler` (behavior identical).
- `netlify/functions/__tests__/generate-pdf.security.test.ts` — add behavioral
  tests (keep the existing source-string tests too).

**Out of scope** (do NOT touch):
- Browser launch / pooling logic (`getBrowser`, `getChromiumPath`,
  `browserInstance`) — unrelated.
- The `setContent` HTML template, `page.pdf()` options, auth check, rate-limit
  wrapper — no behavior change.
- Do NOT widen `ALLOWED_RENDER_REQUEST_PROTOCOLS` or change abort/continue logic.
  This plan tests the current behavior; it does not alter the policy.

## Git workflow

- Branch: `advisor/010-pdf-sandbox-tests`
- Commit per step (extraction, then tests); short imperative subjects.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Export the predicate and extract the request handler

In `generate-pdf.ts`:

1. Add `export` to `isAllowedRenderRequest` (line 111) and to
   `ALLOWED_RENDER_REQUEST_PROTOCOLS` (line 109).
2. Extract the `page.on("request", …)` callback body into a named exported
   function. Use a minimal structural type so no real Puppeteer import is needed
   by the test:

```ts
export interface InterceptableRequest {
  url(): string;
  continue(): unknown;
  abort(reason: string): unknown;
}

/** Allow only about:/data:/blob: subresource requests; abort all network. */
export function handleRenderRequest(request: InterceptableRequest): void {
  if (isAllowedRenderRequest(request.url())) {
    void request.continue();
    return;
  }
  void request.abort("blockedbyclient");
}
```

3. Replace the inline `page.on("request", (request) => { … })` in `baseHandler`
   with `page.on("request", handleRenderRequest);` (the Puppeteer request type
   structurally satisfies `InterceptableRequest`; if TypeScript complains about
   the exact type, wrap as `page.on("request", (request) => handleRenderRequest(request));`).

**Verify**: `npm run type:check` → exit 0.

### Step 2: Extract the sandbox setup

Extract the three sandbox calls into one exported async function so a test can
assert all three happen (and in the right order — interception on and JS off
BEFORE any content is set):

```ts
export interface SandboxablePage {
  setRequestInterception(enabled: boolean): Promise<void>;
  on(event: "request", handler: (request: InterceptableRequest) => void): unknown;
  setJavaScriptEnabled(enabled: boolean): Promise<void>;
}

/** Apply the render sandbox: intercept+abort network, disable JS. */
export async function hardenPageForRender(page: SandboxablePage): Promise<void> {
  await page.setRequestInterception(true);
  page.on("request", handleRenderRequest);
  await page.setJavaScriptEnabled(false);
}
```

Replace lines 192–203 in `baseHandler` with `await hardenPageForRender(page);`.
The real Puppeteer `Page` structurally satisfies `SandboxablePage`; if the
`page.on` overloads cause a type error, keep the call as
`await hardenPageForRender(page as unknown as SandboxablePage)` — but prefer a
clean structural match. Do NOT use `any`.

**Verify**: `npm run type:check` → exit 0; `npm run lint:fix` → exit 0.

### Step 3: Add behavioral tests

In `netlify/functions/__tests__/generate-pdf.security.test.ts`, KEEP the existing
two source-string tests and ADD a new `describe` block importing the extracted
functions:

```ts
import {
  isAllowedRenderRequest,
  handleRenderRequest,
  hardenPageForRender,
} from '../generate-pdf.js';
```

Cases:

- `isAllowedRenderRequest`:
  - returns `true` for `about:blank`, a `data:text/html,...` URL, and a
    `blob:https://x/…` URL;
  - returns `false` for `http://169.254.169.254/latest/meta-data`,
    `https://example.com/x.png`, `file:///etc/passwd`, `ftp://host/f`, and a
    malformed URL string.
- `handleRenderRequest` with a fake request that records calls:
  - for a `data:` URL → `continue` called once, `abort` never;
  - for an `http://internal/…` URL → `abort` called once with
    `"blockedbyclient"`, `continue` never.
- `hardenPageForRender` with a fake page that records calls:
  - `setRequestInterception` called with `true`;
  - `setJavaScriptEnabled` called with `false`;
  - a `request` handler was registered via `on`;
  - assert ordering: interception is enabled and JS disabled (a call log array
    containing `['setRequestInterception:true', 'on:request', 'setJavaScriptEnabled:false']`
    in that order).

Fake objects are plain records of calls, e.g.:
```ts
const calls: string[] = [];
const fakePage = {
  setRequestInterception: async (v: boolean) => { calls.push(`setRequestInterception:${v}`); },
  on: (e: string) => { calls.push(`on:${e}`); return fakePage; },
  setJavaScriptEnabled: async (v: boolean) => { calls.push(`setJavaScriptEnabled:${v}`); },
};
```

**Verify**: `npm run test -- netlify/functions/__tests__/generate-pdf.security.test.ts`
→ all pass (old + new).

## Test plan

- New behavioral tests (Step 3): the allowlist predicate cases, the
  abort/continue decision cases, and the sandbox-wiring/ordering case. The
  `setJavaScriptEnabled(false)` assertion closes the gap called out in the
  finding (previously untested).
- Keep the existing source-string tests as a cheap second layer.
- Structural pattern: the existing `generate-pdf.security.test.ts`.
- Verification: focused test command above → all pass; `npm run type:check` exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run type:check` exits 0
- [ ] `npm run lint` exits 0 on `netlify/functions/generate-pdf.ts`
- [ ] `npm run test -- netlify/functions/__tests__/generate-pdf.security.test.ts`
      passes, with new cases for `isAllowedRenderRequest`, `handleRenderRequest`,
      and `hardenPageForRender`
- [ ] `grep -n "export function handleRenderRequest\|export async function hardenPageForRender\|export function isAllowedRenderRequest" netlify/functions/generate-pdf.ts`
      → all three present
- [ ] `grep -n "setJavaScriptEnabled(false)" netlify/functions/generate-pdf.ts`
      still present (control not removed)
- [ ] `grep -c "any" netlify/functions/generate-pdf.ts` did not increase versus
      the pre-change file (no new `any`)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match the live code (drift since
  `ceed480`).
- The extraction cannot preserve behavior without changing the handler's control
  flow (e.g. `page.on` typing forces a change that alters when interception is
  enabled relative to `setContent`) — report the type error rather than moving
  the sandbox setup later in the flow.
- A test requires launching a real browser to pass — that means the extraction
  was not clean; stop and report (tests must run against mocks only).
- `type:check` or the focused test fails twice after reasonable fixes.

## Maintenance notes

- If a future change legitimately needs to allow an external subresource (e.g.
  embedding a remote logo), it must widen `ALLOWED_RENDER_REQUEST_PROTOCOLS`
  AND update `isAllowedRenderRequest` tests — the behavioral tests will force
  that conversation instead of silently passing.
- Reviewer should confirm the extracted `hardenPageForRender` is still called
  BEFORE `page.setContent(...)` in `baseHandler` — ordering is the security
  property (JS must be off and interception on before attacker HTML loads).
- The source-string tests are retained deliberately as a cheap tripwire; they are
  not a substitute for the behavioral tests.
