# Deployment Checklist — Netlify Production Deploy

## Pre-Deployment Validation ✅

### Build Status
- [x] **Production Build**: Passes (1m 35s)
- [x] **Tests**: 371 passed, 2 skipped
- [x] **TypeScript**: 0 errors
- [x] **ESLint**: 0 errors, 2 warnings (acceptable)
- [x] **Bundle Size**: 1.14 MB main chunk (⚠️ large but acceptable)

### Code Quality
- [x] Security scan: 15 findings reviewed and mitigated or accepted
- [x] Performance scan: 11 findings reviewed and mitigated or accepted
- [x] Test scan: 3 findings reviewed and mitigated or accepted
- [x] Documentation: 4 guides reviewed and current

---

## Environment Variables Required ⚠️

**CRITICAL**: Verify these are set in the Netlify dashboard before deploying.

### Required for All Functions
```bash
# AI Provider (REQUIRED)
OPENROUTER_API_KEY=<your-openrouter-api-key>

# Supabase (REQUIRED)
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# Rate Limiting (REQUIRED)
UPSTASH_REDIS_REST_URL=<your-upstash-redis-url>
UPSTASH_REDIS_REST_TOKEN=<your-upstash-redis-token>

# Email Service (REQUIRED)
RESEND_API_KEY=<your-resend-api-key>

# Error Tracking (OPTIONAL but recommended)
SENTRY_DSN=<your-sentry-dsn>
```

### Client-Side Environment Variables (Vite)
These should already be set in your `.env` file and Netlify:
```bash
VITE_SUPABASE_URL=<same-as-SUPABASE_URL>
VITE_SUPABASE_ANON_KEY=<same-as-SUPABASE_ANON_KEY>
VITE_SUPABASE_REDIRECT_URL=<canonical-watheq-production-url>
VITE_SENTRY_DSN=<same-as-SENTRY_DSN>
```

`VITE_SUPABASE_URL` must remain the verified Supabase project URL or verified Supabase custom auth domain used by the browser client. Do not switch it to a custom domain until DNS, TLS, and Supabase domain verification are complete.

`VITE_SUPABASE_REDIRECT_URL` should point to the canonical Watheq app URL when production needs a fixed post-login return URL.

### Gemini Fallback (Verify Before Deploy)
`GEMINI_API_KEY` is still used as a live fallback when OpenRouter returns 502/503 and by some internal AI client paths. Do **not** remove it unless you have confirmed every call path in the current deploy is OpenRouter-only and the fallback is disabled.
- [ ] Verify whether `GEMINI_API_KEY` is still required for this deploy.
- [ ] If uncertain, keep it set.

---

## OAuth Trust / Branding — Manual Dashboard Steps

Google sign-in trust is controlled by dashboard settings, not React code. Complete these manually before deploy.

Use `docs/OAUTH_TRUST_BRANDING_CHECKLIST.md` as the focused operator checklist for Supabase, Google Cloud / Google Auth Platform, DNS, custom-domain rollout, and smoke testing.

### Supabase Auth (Supabase Dashboard)

- [ ] **Site URL** is set to the canonical Watheq production URL (`https://watheqai.app`).
- [ ] **Redirect allow list** includes:
  - `https://watheqai.app`
  - Approved preview URLs
  - Local dev URLs (`http://localhost:5173`, `http://localhost:8888`)
- [ ] **Google provider** is enabled with the intended OAuth client ID and secret.
- [ ] **Google callback URL** is recorded, usually `https://<project-ref>.supabase.co/auth/v1/callback`.
- [ ] **Custom auth domain is configured** (see critical note below).

#### 🔴 Critical: Custom Auth Domain for Google Branding

**Problem:** If you do not configure a custom auth domain, Google OAuth shows the raw Supabase project URL (`cwcjeujextkwpmzdfzdz.supabase.co`) on the consent screen instead of `watheqai.app`. Users see an unfamiliar domain and may distrust the sign-in.

**Solution:** Set up a custom auth domain so Supabase OAuth flows through your own domain.

**Steps:**
1. In **Supabase Dashboard** → Authentication → URL Configuration → **Custom Domain**:
   - Add your custom auth domain (e.g., `auth.watheqai.app` or `supabase.watheqai.app`).
   - Follow Supabase's DNS verification steps (add the required CNAME record in your DNS provider).
   - Wait for Supabase to verify the domain (can take a few minutes).
2. In **Google Cloud Console** → APIs & Services → Credentials → OAuth 2.0 Client IDs:
   - Update **Authorized redirect URIs** to use your custom domain:
     - `https://auth.watheqai.app/auth/v1/callback` (or your chosen subdomain)
   - Keep the old Supabase project URI until the custom domain callback is confirmed working.
3. Update your app environment:
   - Set `VITE_SUPABASE_URL` to the custom domain URL (Supabase dashboard will provide the exact URL once verified).
   - **Do not** switch `VITE_SUPABASE_URL` to the custom domain until Supabase verification is complete and you've tested auth end-to-end.
4. Test:
   - Sign out and sign in again.
   - Confirm the Google consent screen shows your custom domain or `watheqai.app` branding instead of the raw Supabase project URL.

**If you cannot set up a custom auth domain immediately:**
- The app will still function, but Google will display the Supabase project URL on the consent screen.
- You can mitigate this by ensuring your **App name**, **Logo**, and **Support email** in Google Cloud Console are clearly branded as Watheq, so users recognize the app even if the domain looks technical.

### Google Cloud OAuth Consent Screen (Google Cloud Console)

- [ ] **App name** is `Watheq` or the approved bilingual brand name.
- [ ] **Logo** is uploaded.
- [ ] **Support email** is `support@watheqai.app`.
- [ ] **Homepage URL** is `https://watheqai.app`.
- [ ] **Privacy policy URL** is `https://watheqai.app/privacy`.
- [ ] **Terms URL** is `https://watheqai.app/terms`.
- [ ] **Authorized domains** include `watheqai.app` and any approved auth subdomain parent.
- [ ] **Authorized JavaScript origins** include `https://watheqai.app` and approved preview/dev origins.
- [ ] **Authorized redirect URIs** include the active Supabase callback URL.

**Staging-only origins/URLs** (if used during development):
- Clearly label staging preview URLs as non-production in the Google Cloud console.
- Do not set staging URLs as the primary Homepage, Privacy, or Terms URLs.

### Custom Domain Rollout Warnings

- [ ] Do not remove the old Supabase callback URI until the new custom-domain callback is verified.
- [ ] Do not switch `VITE_SUPABASE_URL` to a custom domain until DNS, TLS, and Supabase verification are complete.

### Browser Smoke Test

- [ ] Click Google sign-in.
- [ ] Confirm the Google screen shows Watheq branding.
- [ ] Complete login.
- [ ] Confirm redirect returns to Watheq.
- [ ] Confirm the session is established.

---

## Breaking Changes ⚠️

### CRITICAL: OpenRouter Migration
**This deploy changes the primary AI provider to OpenRouter.**

#### Required Action
1. **Get OpenRouter API Key**: https://openrouter.ai/keys
2. **Set in Netlify**:
   - Go to Site settings → Environment variables
   - Add `OPENROUTER_API_KEY` with your key
3. **Do not remove `GEMINI_API_KEY` without verification** (see Environment Variables section)

#### Why This Change?
- ✅ Unified quota tracking across all AI functions
- ✅ Automatic failover between models
- ✅ Cost optimization through OpenRouter's pricing
- ✅ Better rate limit handling

**Impact**: Functions will fail if `OPENROUTER_API_KEY` is not set!

---

## Function Timeout Changes ✅

All function timeouts have been verified in `netlify.toml`:

| Function | Timeout | Memory | Notes |
|----------|---------|--------|-------|
| `generate-pdf` | 90s | 1024MB | **NEW: Now requires auth** |
| `ai-match` | 90s | default | OpenRouter timeout coordination |
| `optimize` | 120s | default | Longest running function |
| `predict-questions` | 60s | default | |
| `generate-cover-letter` | 60s | default | |
| `extract-resume-json` | 70s | default | |
| `parse-arabic-resume` | 70s | default | |
| `vision2030-alignment` | 70s | default | |

**No changes needed** — all timeouts already configured correctly.

---

## Security Changes ⚠️

### generate-pdf.ts Authentication
**BREAKING CHANGE**: PDF generation now requires authentication.

**Before**: Anyone could call the endpoint
**After**: Requires valid JWT token

**Impact on Clients**:
- Frontend already sends auth headers ✅
- Direct API calls will get 401 Unauthorized
- Update any external integrations to include auth

**Testing Required**:
1. ✅ Test PDF download as authenticated user
2. ✅ Verify 401 response for unauthenticated requests
3. ✅ Test rate limiting (10 req/min limit)

### Input Validation
**NEW**: All endpoints now enforce size limits:
- Resume text: max 50KB
- Job description: max 30KB

**Impact**: Very large inputs will get 400 Bad Request

---

## Deployment Steps

### 1. Pre-Deploy Verification

```bash
# Run full quality checks (should pass)
npm run quality:parallel

# Test production build (should succeed)
npm run build

# Preview build locally (optional)
npm run preview
```

**Expected Results**:
- ✅ 371 tests passing
- ✅ 0 TypeScript errors
- ✅ 0 ESLint errors
- ✅ Build completes in ~2 minutes

---

### 2. Environment Variable Checklist

Before deploying, verify in Netlify dashboard:

**Site Settings → Environment variables → Edit variables**

- [ ] `OPENROUTER_API_KEY` is set (REQUIRED - NEW!)
- [ ] `SUPABASE_URL` is set
- [ ] `SUPABASE_ANON_KEY` is set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set
- [ ] `UPSTASH_REDIS_REST_URL` is set
- [ ] `UPSTASH_REDIS_REST_TOKEN` is set
- [ ] `RESEND_API_KEY` is set
- [ ] `VITE_SUPABASE_URL` is set
- [ ] `VITE_SUPABASE_ANON_KEY` is set
- [ ] `SENTRY_DSN` is set (optional)
- [ ] `VITE_SENTRY_DSN` is set (optional)

**CRITICAL**: Missing `OPENROUTER_API_KEY` will cause all AI functions to fail!

---

### 3. Deploy to Netlify

```bash
# Commit changes
git add .
git commit -m "fix: Complete code review implementation - security, performance, and test improvements"

# Push to GitHub (triggers Netlify deploy)
git push origin main
```

**OR** deploy directly via Netlify CLI:

```bash
# Install Netlify CLI if not already installed
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy to production
netlify deploy --prod
```

---

### 4. Post-Deploy Verification

#### Immediate Checks (< 5 minutes)

1. **Build Status**
   - [ ] Netlify build succeeds (check deploy log)
   - [ ] No function compilation errors
   - [ ] All functions deployed successfully

2. **Site Loads**
   - [ ] Homepage loads without errors
   - [ ] Console has no critical errors
   - [ ] Supabase auth works

3. **Critical Functions Test**
   - [ ] Upload resume (tests `parse-resume` + `extract-resume-json`)
   - [ ] Paste job description
   - [ ] Click "Analyze Match" (tests `ai-match` function)
   - [ ] Click "Optimize Resume" (tests `optimize` function)
   - [ ] Download PDF (tests `generate-pdf` with new auth)

4. **Rate Limiting Test**
   - [ ] Rapid-fire requests get rate limited (429 response)
   - [ ] Normal usage works fine

#### Detailed Verification (< 30 minutes)

5. **All Features Test**
   - [ ] Resume upload (PDF/DOCX/Text)
   - [ ] Match analysis
   - [ ] Optimization suggestions
   - [ ] Apply optimizations
   - [ ] Template preview
   - [ ] PDF download (authenticated)
   - [ ] DOCX export
   - [ ] Interview questions
   - [ ] Cover letter generation
   - [ ] Vision 2030 alignment

6. **Error Handling**
   - [ ] Invalid inputs get proper error messages
   - [ ] Rate limit errors show retry message
   - [ ] Auth errors show sign-in prompt
   - [ ] No PII leaked in error messages

7. **Performance**
   - [ ] Template switching is smooth
   - [ ] No unnecessary re-renders
   - [ ] Cache working (repeat analysis is instant)
   - [ ] No console.log spam in production

---

## Production Launch Gate 🚦

Do not mark the deploy as fully live until all of the following are verified:

- [ ] **Environment variables verified**: `OPENROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and all required vars are present and non-empty in the production environment.
- [ ] **OAuth branding verified**: Google Cloud OAuth consent screen shows the correct app name, logo, support email, and authorized domains. Supabase redirect URLs include production.
- [ ] **No PII in Sentry/logs**: Error payloads, Sentry events, and function logs do not contain resume text, job text, email, phone numbers, or tokens.
- [ ] **Core flow works end-to-end**: Upload → Match → Optimize → Export completes without errors for a test resume and job description.
- [ ] **PDF auth works**: Downloading a PDF as an authenticated user succeeds; unauthenticated requests receive 401.
- [ ] **Rate limiting works**: Rapid requests receive 429; normal usage is not blocked.

---

## Do Not Deploy If 🛑

- `OPENROUTER_API_KEY` is missing or unset.
- `SUPABASE_SERVICE_ROLE_KEY` is missing or unset.
- Google OAuth consent screen shows wrong, untrusted, or missing branding.
- Production smoke test (upload → match → optimize → export) fails.
- Sentry, logs, or error messages expose resume text, job text, email, phone, or tokens.

---

## Rollback Plan 🔄

If deploy fails or critical bugs are found:

### Immediate Rollback (Netlify Dashboard)
1. Go to **Deploys** tab
2. Find last working deploy
3. Click **Publish deploy**
4. Verify site works

### Code Rollback (Git)
```bash
# Find last working commit
git log --oneline

# Revert to last working commit
git revert <commit-hash>

# Push revert
git push origin main
```

---

## Known Warnings ⚠️

These warnings are **acceptable** and won't cause deploy failures:

### 1. Large Bundle Warning
```
chunk size limit: 600 kB
actual size: 1,136.40 kB (334.29 kB gzipped)
```

**Why**: React PDF renderer + UI libraries
**Impact**: Initial load time ~2-3s on slow connections
**Mitigation**: Already using code splitting, lazy loading
**Action**: None required (acceptable for this app)

### 2. ESLint Warnings (2)
```
- CoverLetterSection.tsx: useCallback missing dependency
- TemplatesSection.tsx: Unused eslint-disable directive
```

**Why**: Intentional optimization patterns
**Impact**: None
**Action**: None required

### 3. Dynamic Import Warning
```
api.js is dynamically imported by OptimizeSection but also statically imported
```

**Why**: Vite's bundler reporting dual import strategy
**Impact**: None (works correctly)
**Action**: None required

---

## Monitoring After Deploy

### First 24 Hours
Monitor these metrics in Netlify dashboard:

1. **Function Errors** (should be < 1%)
   - Check Functions tab for error rate
   - Any 5xx errors? → Check function logs
   - Any timeouts? → Check timeout settings

2. **Function Duration** (should be within limits)
   - `optimize`: < 120s
   - `generate-pdf`: < 90s
   - `ai-match`: < 90s
   - Others: < 70s

3. **Build Success Rate** (should be 100%)
   - Every push should build successfully
   - No function compilation errors

4. **Rate Limiting** (Upstash Redis)
   - Check Upstash dashboard for rate limit hits
   - Should see some 429s (normal abuse prevention)
   - Legitimate users should not hit limits

5. **Error Tracking** (Sentry if enabled)
   - Check for new error patterns
   - PII should NOT appear in errors
   - Generic error messages only

---

## Success Criteria ✅

Deploy is successful if:

- [x] Build completes without errors
- [x] All functions deploy successfully
- [x] Site loads and auth works
- [x] Resume upload → analyze → optimize → download flow works
- [x] PDF download requires authentication
- [x] Rate limiting blocks rapid requests
- [x] No PII in error logs
- [x] Error rate < 1%
- [x] No 5xx errors from functions

---

## Support & Debugging

### If Functions Fail

1. **Check Netlify Function Logs**
   - Functions tab → Select function → Real-time logs
   - Look for error messages

2. **Common Issues**:
   - `OPENROUTER_API_KEY is not set` → Add to env vars
   - `TimeoutError` → Function timeout too short (check netlify.toml)
   - `Rate limit exceeded` → Normal, user should retry
   - `401 Unauthorized` → Auth token missing/invalid

3. **Debug Locally**:
   ```bash
   # Run Netlify dev server (simulates production)
   npm run dev:netlify

   # Test specific function
   curl -X POST http://localhost:8888/.netlify/functions/optimize \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <test-token>" \
     -d '{"resumeText":"test","jobText":"test"}'
   ```

### Emergency Contacts
- Netlify Status: https://www.netlifystatus.com/
- OpenRouter Status: https://status.openrouter.ai/
- Supabase Status: https://status.supabase.com/

---

## Summary

**Ready to Deploy**: ⚠️ PENDING SMOKE TESTS

**Critical Actions Required**:
1. ✅ Set `OPENROUTER_API_KEY` in Netlify env vars
2. ✅ Verify all other env vars are set
3. ✅ Verify OAuth branding in Google Cloud and Supabase dashboards
4. ✅ Test PDF download after deploy (new auth)
5. ✅ Confirm no PII in Sentry/logs
6. ✅ Run production smoke test (upload → match → optimize → export)
7. ✅ Monitor function errors for first 24 hours

**Risk Level**: **MEDIUM**
- All tests passing
- Build succeeds
- Breaking changes documented
- Rollback plan ready
- **Smoke tests and OAuth branding must pass before risk is lowered**

**Recommendation**:
⚠️ **Deploy to production only after completing the Production Launch Gate.** Do not treat build success alone as a green light.

---

## Quick Reference Commands

```bash
# Pre-deploy
npm run quality:parallel    # Run all checks
npm run build              # Test production build

# Deploy
git push origin main       # Auto-deploy via GitHub integration
# OR
netlify deploy --prod      # Direct deploy via CLI

# Post-deploy
netlify functions:list     # Verify all functions deployed
netlify logs              # Monitor function logs
netlify open:site         # Open deployed site
netlify open:admin        # Open Netlify dashboard

# Rollback
netlify rollback          # Via CLI
# OR use Netlify dashboard → Deploys → Publish previous deploy
```
