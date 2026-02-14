# Debug Netlify 502 Error

**Purpose**: Systematic diagnosis of Netlify function 502 Bad Gateway errors.

## When to Use

- Any Netlify function returning 502 Bad Gateway
- Functions working locally but failing in production
- Intermittent 502s under load
- Circuit breaker opening after repeated failures

## Key Insight

Netlify returns 502 when the **function crashes before returning its own response**. The function code never returns HTTP 502 itself. A 502 means an unhandled error escaped the function entirely.

## Protocol (MANDATORY)

### Step 1: Identify the Failing Function

1. Which endpoint is returning 502? (e.g., `/api/ai-match`)
2. Is it ALL functions or specific ones?
3. Does it work locally with `npm run dev:netlify`?
4. Check Netlify function logs for the crash stack trace

### Step 2: Check Environment Variables

Verify in Netlify Dashboard → Site Settings → Environment Variables:

```
Required for AI functions:
- OPENROUTER_API_KEY (primary AI provider)
- GEMINI_API_KEY (fallback AI provider)

Required for rate limiting:
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN

Required for auth/database:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Required for other services:
- SENTRY_DSN (error tracking)
- RESEND_API_KEY (emails)
```

**Common issue**: Missing env vars cause module-level crashes = instant 502.

### Step 3: Trace the Request Path

```
┌─────────────────────┐
│ 1. Module Load       │ → Global scope code runs on cold start
│    (Cold Start)      │   Module-level errors = 502 before handler runs
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 2. withRateLimit     │ → Rate limiter wrapper
│    Wrapper           │   If Upstash missing → should fail open (not block)
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 3. Auth/Credits      │ → Supabase auth, credit checks
│    Pre-checks        │   Errors here escape inner try-catch
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 4. Business Logic    │ → AI API call, response parsing
│    (Inner try-catch) │   Usually caught by inner handler
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 5. Response          │ → JSON response to client
│    Serialization     │   Circular refs or BigInt = crash
└─────────────────────┘
```

### Step 4: Check Ranked Root Causes

**From most to least common:**

1. **Rate limiter blocks ALL requests** (9 functions affected)
   - Cause: Upstash Redis env vars missing in production
   - Fix: Rate limiter should fail open when not configured
   - Pattern: `if (!limiter) return { allowed: true };`

2. **OpenRouter key invalid, fallback not triggered**
   - Cause: `isFallbackEligible()` only checks 502/503, misses 401/403
   - Fix: Broaden fallback to all 4xx/5xx errors
   - Verify: Check if GEMINI_API_KEY is set as backup

3. **Uncaught exceptions escape handler**
   - Cause: Errors from `checkCredits()`, `getClientIP()`, `getSupabaseClient()` thrown before inner try-catch
   - Fix: Wrap entire handler body in outer try-catch
   - Pattern: Outer catch returns 500 JSON instead of crashing

4. **Module-level code crashes on import**
   - Cause: SDK initialization at module scope with missing env vars
   - Fix: Lazy initialization inside function body
   - Netlify docs: "avoid placing global logic outside the exported function"

5. **Upstash timeout under load**
   - Cause: Redis connection slow, entire function hangs then times out
   - Fix: Use Upstash Ratelimit `timeout` option (official fail-open pattern)
   - Pattern: `new Ratelimit({ ..., timeout: 3000 })`

### Step 5: Verify Fix

1. Check Netlify function logs for startup diagnostics:
   ```
   [rate-limiter] Startup diagnostics for "ai-match": { UPSTASH_REDIS_REST_URL: true, ... }
   ```

2. Test the endpoint directly:
   ```bash
   curl -X POST https://your-site.netlify.app/.netlify/functions/ai-match \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{"resumeText":"test","jobText":"test"}'
   ```

3. Expected: proper JSON error response (4xx/5xx), NOT a raw 502

## Anti-Patterns (DO NOT DO THIS)

- **Increasing timeouts blindly**: 502 ≠ timeout; it means the function crashed
- **Adding retries on the client**: Retrying a 502 just crashes the function again
- **Disabling rate limiting entirely**: Fix the graceful degradation instead
- **Ignoring module-level code**: Any `throw` at import time = 502 on every request

## Files to Check (Common Locations)

**Shared infrastructure** (fixes propagate to all functions):
- `netlify/lib/rate-limiter.ts` — Rate limiting wrapper (9 functions)
- `netlify/lib/openrouter-client.js` — AI API client with fallback
- `netlify/lib/supabase-client.ts` — Shared Supabase singleton
- `netlify/lib/credit-manager.js` — Credit checking

**Individual functions**:
- `netlify/functions/ai-match.ts` — Match scoring
- `netlify/functions/optimize.ts` — Optimization
- `netlify/functions/extract-resume-json.ts` — Resume parsing
- `netlify/functions/predict-questions.ts` — Interview prep

**Frontend retry logic** (usually correct, check last):
- `src/lib/api.js` — API client with retry
- `src/lib/circuit-breaker.ts` — Circuit breaker pattern

## Upstash Fail-Open Pattern (Reference)

From Upstash docs: The `timeout` option makes the rate limiter "fail open" — if Redis is slow or unavailable, requests are allowed through instead of blocked:

```typescript
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "60 s"),
  timeout: 3000, // 3s — fail open if Redis is slow
});
```

## Success Criteria

- All AI endpoints return proper JSON error responses (not raw 502)
- Startup diagnostics visible in Netlify function logs
- Rate limiter degrades gracefully when Upstash is unavailable
- OpenRouter failures trigger Gemini fallback when key is available
- Quality checks pass (`npm run quality:parallel`)
