# OAuth Trust Branding Checklist

Google sign-in trust is controlled by both app code and external dashboards. Code can send users back to the right Watheq URL, but the Google screen branding and the raw Supabase domain shown during OAuth must be fixed in Supabase and Google Cloud.

## Current Auth Flow

- Browser Supabase client is created in `src/services/supabase.js` from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Google sign-in starts in `src/hooks/useAuth.tsx` with `supabase.auth.signInWithOAuth({ provider: "google" })`.
- The post-login `redirectTo` is resolved by `src/lib/auth/authRedirect.ts`.
- Production should set `VITE_SUPABASE_REDIRECT_URL=https://watheqai.app`.
- Local development can omit `VITE_SUPABASE_REDIRECT_URL`; the app falls back to the current localhost origin/path.

## Supabase Dashboard

- [ ] Set Auth Site URL to `https://watheqai.app`.
- [ ] Add Redirect URLs:
  - `https://watheqai.app`
  - approved Netlify preview URLs, if used
  - `http://localhost:5173`
  - `http://localhost:8888`
- [ ] Enable the Google provider with the intended OAuth Client ID and Client Secret.
- [ ] Record the active Supabase callback URL, initially `https://<project-ref>.supabase.co/auth/v1/callback`.
- [ ] Configure a custom Supabase auth/API domain when the project plan supports it, preferably `auth.watheqai.app`.
- [ ] Keep the default Supabase callback URI until the custom-domain callback has been verified end-to-end.

## Google Cloud / Google Auth Platform

- [ ] Set app name to `Watheq`.
- [ ] Upload the approved Watheq logo, if available.
- [ ] Set the support email and developer contact email.
- [ ] Set Homepage URL to `https://watheqai.app`.
- [ ] Set Privacy Policy URL to `https://watheqai.app/privacy`.
- [ ] Set Terms of Service URL to `https://watheqai.app/terms`.
- [ ] Add `watheqai.app` to Authorized Domains.
- [ ] Add `https://watheqai.app` to Authorized JavaScript Origins.
- [ ] Add any approved preview or local origins required for testing.
- [ ] Add the active Supabase callback URL to Authorized Redirect URIs.
- [ ] After Supabase verifies the custom domain, add `https://auth.watheqai.app/auth/v1/callback`.
- [ ] Keep scopes minimal: `openid`, `email`, `profile`.
- [ ] Do not add sensitive or restricted scopes without a clear product reason.

## DNS / Custom Domain Rollout

- [ ] Add the Supabase-required DNS record for `auth.watheqai.app`.
- [ ] Wait for DNS, TLS, and Supabase custom-domain verification.
- [ ] Only after verification, update `VITE_SUPABASE_URL` to the exact custom-domain URL Supabase provides.
- [ ] Do not remove the default `https://<project-ref>.supabase.co/auth/v1/callback` until production Google sign-in works through the custom domain.

## Smoke Test

- [ ] Local Google login returns to localhost and establishes a session.
- [ ] Production Google login returns to `https://watheqai.app` and establishes a session.
- [ ] Google shows Watheq app branding.
- [ ] After custom-domain rollout, Google no longer shows the raw Supabase project domain.
