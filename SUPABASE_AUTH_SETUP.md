# Supabase Authentication Setup

## Required Configuration for Local Development

To fix the empty page issue after Google sign-in, you need to configure the redirect URLs in your Supabase project.

### 1. Add Redirect URLs in Supabase Dashboard

1. Go to your Supabase project: https://supabase.com/dashboard/project/cwcjeujextkwpmzdfzdz
2. Navigate to **Authentication → URL Configuration**
3. Add the following URLs to the **Redirect URLs** list:
   - `http://localhost:8888` (for Netlify dev)
   - `http://localhost:43773` (alternative Netlify port)
   - `http://localhost:5173` (Vite dev server)
   - `https://your-production-domain.netlify.app` (your production URL)

### 2. Configure Site URL

In the same **URL Configuration** section:
- Set **Site URL** to your production domain (e.g., `https://your-app.netlify.app`)
- For local development, you can temporarily set it to `http://localhost:8888`

### 3. Enable Google OAuth Provider

1. Navigate to **Authentication → Providers**
2. Enable **Google** provider
3. Add your Google OAuth credentials:
   - **Client ID**: (from Google Cloud Console)
   - **Client Secret**: (from Google Cloud Console)
4. Add authorized redirect URIs in Google Cloud Console:
   - `https://cwcjeujextkwpmzdfzdz.supabase.co/auth/v1/callback`

### 4. Authorized Domains

In **Authentication → Settings**:
- Ensure `localhost` is in the list of authorized domains for development

## Code Changes Made

### OAuth Redirect Enforcement in `src/hooks/useAuth.jsx`

The auth hook now calls `supabase.auth.signInWithOAuth` with `skipBrowserRedirect: true`, rewrites the returned login URL, and forces the `redirect_to` query param to the value from `resolveRedirectUrl()`.

```javascript
const redirectUrl = resolveRedirectUrl();
const { data } = await supabase.auth.signInWithOAuth({
   provider: "google",
   options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
});

const authUrl = new URL(data.url);
authUrl.searchParams.set("redirect_to", redirectUrl);
window.location.assign(authUrl.toString());
```

`resolveRedirectUrl()` checks `VITE_SUPABASE_REDIRECT_URL` first, then falls back to `window.location.origin`. If the override points to `localhost` but you're running on a remote tunnel (Codespaces, Gitpod, etc.), it automatically ignores the override so the redirect stays on the reachable host. This prevents Supabase from defaulting back to an inaccessible `http://localhost:3000` and keeps the callback aligned with whichever dev port you're using.

## Testing

After configuring Supabase:

1. Clear browser cache and localStorage:
   ```javascript
   localStorage.clear();
   ```

2. Restart the dev server:
   ```bash
   npm run dev
   # or
   npx netlify dev
   ```

3. Sign in with Google and verify:
   - No redirect errors
   - User sees the resume upload interface
   - No empty page after authentication

## Troubleshooting

### Still seeing empty page?

1. Open browser DevTools → Console
2. Look for errors related to:
   - `redirect_uri_mismatch`
   - `Invalid login credentials`
   - Network errors

3. Check Network tab:
   - Look for failed requests to Supabase auth endpoints
   - Verify the redirect URL in the OAuth request matches Supabase config

### Common Issues

- **redirect_uri_mismatch**: The redirect URL is not whitelisted in Supabase
- **Empty page after sign-in**: Incorrect redirect URL in code (now fixed)
- **Authentication loop**: Site URL not configured in Supabase
