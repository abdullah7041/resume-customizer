# Debug OpenRouter 503 Error

**Purpose**: Systematic diagnosis of Netlify function 503 Service Unavailable failures involving OpenRouter AI calls.

## When to Use

- AI endpoint (`optimize`, `ai-match`, `predict-questions`, `generate-cover-letter`, `extract-resume-json`, `vision2030-alignment`, `optimize-stream`) returns 503
- Client error message contains `503`, `Service Unavailable`, `no available provider`, `overloaded`, or `guest/preview-unavailable`
- AI calls fail in production but work locally (`npm run dev:netlify`)
- Intermittent 503s that correlate with traffic spikes or a specific model
- Gemini fallback not kicking in when OpenRouter is degraded

## Key Insight — 503 ≠ 502

A **502** means the function *crashed* before returning (see `/debug-netlify-502`). A **503** is a *deliberate "service unavailable" response* — either:

1. **OpenRouter upstream returns 503** (model/provider overloaded, no provider available). Our client (`netlify/lib/openrouter-client.js`) catches this, sets `error.status = 503`, and `isFallbackEligible()` returns `true` → it SHOULD fall back to Gemini.
2. **Our own code returns 503 on purpose** — the guest-preview path fails *closed* with `503 guest/preview-unavailable` when Upstash is missing (`checkGuestPreviewRateLimit` in `rate-limiter.ts`).
3. **A rate-limiter regression** returns 503 and blocks all traffic (this was a historic bug — fail-open is the fix).

So: trace WHO emitted the 503 — OpenRouter upstream, the Gemini fallback also failing, or our own rate limiter — before touching anything.

## Step 0: Clarify the Situation (use AskUserQuestion)

If any of the following are unknown, ASK before diagnosing — do not guess:

- **Which endpoint** is 503ing, and is it ONE or ALL AI endpoints?
- **Is the user authenticated** or hitting the guest preview? (guest path has different 503 semantics)
- **Local or production only?** (`npm run dev:netlify` bypasses rate limits + may have different env)
- **Exact error body** — does it contain `guest/preview-unavailable`, an OpenRouter message, or a generic 500/504?

Suggested AskUserQuestion when unclear:
- Q: "Is the 503 on one endpoint or all AI endpoints?" → [One endpoint / All AI endpoints / Not sure]
- Q: "Authenticated user or guest preview?" → [Authenticated / Guest / Not sure]
- Q: "Does it reproduce locally with `npm run dev:netlify`?" → [Yes / Production only / Haven't tried]

## Step 1: Identify the 503 Source

```
┌──────────────────────────────────────────────┐
│ Error body contains "guest/preview-unavailable"?│
└───────────────┬──────────────────────────────┘
        yes ────▶ Root Cause A (guest fail-closed, Upstash missing)
         no
         │
┌────────▼─────────────────────────────────────┐
│ ALL endpoints 503, including non-AI?           │
└───────────────┬──────────────────────────────┘
        yes ────▶ Root Cause B (rate-limiter regression — fail-open broke)
         no
         │
┌────────▼─────────────────────────────────────┐
│ Message mentions OpenRouter/overloaded/provider?│
└───────────────┬──────────────────────────────┘
        yes ────▶ Root Cause C (OpenRouter upstream 503 + fallback gap)
         no  ────▶ Re-read body; may be 504 timeout (see /debug-netlify-502)
```

## Step 2: Check Environment Variables

In Netlify Dashboard → Site Settings → Environment Variables. Cold-start diagnostics also log these (`[rate-limiter] Startup diagnostics`):

```
OPENROUTER_API_KEY       # primary AI provider
GEMINI_API_KEY           # fallback — WITHOUT this, OpenRouter 503 has nowhere to go
UPSTASH_REDIS_REST_URL   # without these, guest preview fails CLOSED (503)
UPSTASH_REDIS_REST_TOKEN
```

**Most impactful gap:** `GEMINI_API_KEY` missing means `isFallbackEligible()` is true but `if (GEMINI_API_KEY && ...)` is false → OpenRouter 503 propagates uncaught.

## Step 3: Ranked Root Causes & Fixes

### Root Cause A — Guest preview fails closed (most common literal 503)
- **Where:** `netlify/lib/rate-limiter.ts` → `checkGuestPreviewRateLimit` → `PREVIEW_UNAVAILABLE_RESPONSE` (`statusCode: 503`, `code: "guest/preview-unavailable"`).
- **Why:** Upstash env vars missing in production. Guest path is intentionally fail-CLOSED (anonymous traffic must never bypass limits).
- **Fix:** Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Netlify. This is config, not code. Do NOT change guest path to fail-open.

### Root Cause B — Rate limiter blocks everything
- **Where:** `checkRateLimit` / `checkRateLimitForRequest` in `rate-limiter.ts`.
- **Why:** Authenticated paths must **fail open**: `if (!limiter) return { allowed: true }` and the `catch` returns `{ allowed: true }`. If someone changed these to return a 503, ALL AI endpoints break.
- **Fix:** Restore fail-open for authenticated endpoints. Keep Upstash `timeout: 3000` (official fail-open under slow Redis).

### Root Cause C — OpenRouter upstream 503, fallback gap
- **Where:** `netlify/lib/openrouter-client.js` → `callOpenRouterDirect` throws `error.status = response.status` (503); handled in `callOpenRouter`.
- **Why:** OpenRouter returns 503 when the model/provider is overloaded or no provider is available. `isFallbackEligible()` already covers `status >= 500` and the `'503'` message. Fallback only runs if `GEMINI_API_KEY` is set. If Gemini also fails, the original OpenRouter error is re-thrown.
- **Fixes (in order):**
  1. Ensure `GEMINI_API_KEY` is set so fallback engages.
  2. Confirm `isFallbackEligible()` still returns true for 503 (don't narrow it).
  3. For transient overload, OpenRouter 503s are short-lived — fallback handles them. If you want an explicit retry of OpenRouter before fallback, wrap the call in `withRetry` (retryable set already includes 503) — but fallback is usually faster.
  4. Note: `callOpenRouter` does NOT auto-retry OpenRouter; it falls straight to Gemini. That's intentional (lower latency).

### Note on what 503 becomes downstream
- In `optimize.ts`, a propagated AI error returns **500** to the client (504 only for `TimeoutError`). So a literal HTTP 503 reaching the browser almost always means **Root Cause A or B** (our own code), while an OpenRouter 503 typically shows up as a **500 with "503" in the message**. Use this to disambiguate fast.

## Step 4: Verify the Fix

1. Cold-start log shows all keys present:
   ```
   [rate-limiter] Startup diagnostics for "optimize": { OPENROUTER_API_KEY: true, GEMINI_API_KEY: true, UPSTASH_REDIS_REST_URL: true, ... }
   ```
2. On OpenRouter degradation, log shows fallback firing:
   ```
   [AI Client] OpenRouter failed, falling back to Gemini direct: ...
   [AI Client] Gemini fallback success (N chars)
   ```
3. Direct test:
   ```bash
   curl -X POST https://your-site.netlify.app/.netlify/functions/ai-match \
     -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
     -d '{"resumeText":"test","jobText":"test"}'
   ```
   Expected: 200, or a clean JSON 4xx/5xx — never a hung/raw 503 for an authenticated call.
4. `npm run quality:parallel` passes.

## Anti-Patterns (DO NOT)

- **Making the guest path fail open** to silence Root Cause A — that removes abuse protection. Fix the env var instead.
- **Narrowing `isFallbackEligible()`** so it skips 503 — that disables the Gemini safety net.
- **Blind client retries on 503** — if it's Root Cause A/B, retrying just re-hits the same wall.
- **Bumping function timeout** — 503 is not a timeout (that's 504).
- **Assuming 503 == crash** — that's 502; use `/debug-netlify-502` instead.

## Files to Check

- `netlify/lib/openrouter-client.js` — `callOpenRouterDirect`, `isFallbackEligible`, `callOpenRouter` fallback logic
- `netlify/lib/rate-limiter.ts` — `checkGuestPreviewRateLimit` (503 source), `checkRateLimit` fail-open, `PREVIEW_UNAVAILABLE_RESPONSE`
- `netlify/functions/optimize.ts` — error→status mapping (AI error → 500/504, not 503)
- `netlify/lib/model-registry.js` — model IDs (a bad/decommissioned model id can cause persistent upstream 503)

## Success Criteria

- 503 source identified (guest fail-closed vs rate-limiter vs OpenRouter upstream) before any code change
- Authenticated AI endpoints fail open when infra missing; guest path stays fail-closed by design
- `GEMINI_API_KEY` present so OpenRouter 503 falls back to Gemini
- Quality checks pass
