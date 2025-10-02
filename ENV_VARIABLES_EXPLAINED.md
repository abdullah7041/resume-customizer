# Environment Variables Explained

## Why .env is Gone?

The `.env` file is **intentionally gitignored** (listed in `.gitignore`) because it contains sensitive keys and should never be committed to version control. This is a security best practice.

## What You Need to Do

### For Local Development:

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Fill in your actual values in `.env`:**
   ```env
   VITE_SUPABASE_URL=https://cwcjeujextkwpmzdfzdz.supabase.co
   VITE_SUPABASE_ANON_KEY=your_actual_anon_key_from_supabase
   ```

3. **Get your Supabase keys:**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project
   - Go to Settings → API
   - Copy the "anon" / "public" key

### For Production (Netlify):

**Don't use `.env` file!** Instead, set environment variables in Netlify Dashboard:

1. Go to your Netlify site dashboard
2. Click **Site Settings** → **Environment Variables**
3. Add these variables:

```
VITE_SUPABASE_URL = https://cwcjeujextkwpmzdfzdz.supabase.co
VITE_SUPABASE_ANON_KEY = your_supabase_anon_key
```

## Understanding Each Variable

### 1. `VITE_SUPABASE_URL`

**What it is:** Your Supabase project URL (the base URL, not a full storage path)

**Correct format:**
```
✅ https://cwcjeujextkwpmzdfzdz.supabase.co
✅ https://your-project-id.supabase.co
```

**Wrong format:**
```
❌ https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp
❌ https://cwcjeujextkwpmzdfzdz.supabase.co/
```

**Why it matters:** The code in `src/lib/assets.ts` constructs the full storage URL by appending the path to this base URL. If you include the full path here, you'll get duplicate paths like `/KAFDH.webp/KAFDH.webp`.

---

### 2. `VITE_SUPABASE_ANON_KEY`

**What it is:** Your Supabase anonymous/public key for client-side access

**Where to find it:**
- Supabase Dashboard → Settings → API → "anon public" key

**Is it safe to expose?** Yes! This is the "anonymous" key designed for client-side use. It has limited permissions set by your Row Level Security (RLS) policies.

---

### 3. `VITE_BUILD_TIMESTAMP` (Auto-generated)

**What it is:** A timestamp added to asset URLs for cache busting

**How it works:**
```javascript
// In scripts/build.mjs
process.env.VITE_BUILD_ID = Date.now().toString();
```

**Example output:**
```
https://example.com/image.webp?v=1727200000
```

**Do you need to set it?** **NO!** The build script (`scripts/build.mjs`) automatically generates this during `npm run build`.

**Why it exists:** Browser cache busting. When you deploy a new version, the timestamp changes, forcing browsers to fetch the new assets instead of using cached old ones.

---

### 4. `VITE_ASSETS_BASE_URL` (Your Question!)

**Current status:** Not used in the codebase

**What you mentioned:** You named something in Netlify as `VITE_ASSETS_BASE_URL`

**Does it matter?** Let me check if it's being used...

## About Your `VITE_ASSETS_BASE_URL` Question

You mentioned setting `VITE_ASSETS_BASE_URL` in Netlify. Let's see if the code uses it:

**Current code uses:** `VITE_SUPABASE_URL` (in `src/lib/assets.ts` and `src/services/supabase.js`)

**If you want to use `VITE_ASSETS_BASE_URL` instead:**

### Option 1: Keep using `VITE_SUPABASE_URL` (Recommended)
- The code is already set up for this
- No changes needed
- Just make sure it's set in Netlify

### Option 2: Add support for `VITE_ASSETS_BASE_URL`
If you want to use a different URL for assets vs Supabase API:

```javascript
// In src/lib/assets.ts
const getSupabaseBaseUrl = () => {
  // Try assets base URL first, fallback to Supabase URL
  const envValue = readEnvString("VITE_ASSETS_BASE_URL") || 
                   readEnvString("VITE_SUPABASE_URL");
  // ... rest of the code
};
```

**My recommendation:** Keep it simple. Use `VITE_SUPABASE_URL` for everything unless you have a specific CDN setup.

## Quick Setup Checklist

### Local Development:
- [x] Create `.env` from `.env.example`
- [x] Add your Supabase URL
- [x] Add your Supabase anon key
- [ ] Run `npm run dev` to test

### Production (Netlify):
- [ ] Go to Netlify Dashboard
- [ ] Site Settings → Environment Variables
- [ ] Add `VITE_SUPABASE_URL`
- [ ] Add `VITE_SUPABASE_ANON_KEY`
- [ ] Deploy!

## Common Mistakes to Avoid

### ❌ Mistake 1: Including the full storage path in VITE_SUPABASE_URL
```env
# WRONG
VITE_SUPABASE_URL=https://xxx.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp

# RIGHT
VITE_SUPABASE_URL=https://xxx.supabase.co
```

### ❌ Mistake 2: Committing .env to git
```bash
# The .env file should be in .gitignore
# Never commit it!
git add .env  # ❌ DON'T DO THIS
```

### ❌ Mistake 3: Using different URLs in local vs production
Make sure both point to the same Supabase project unless you have separate dev/prod projects.

### ❌ Mistake 4: Manually setting VITE_BUILD_TIMESTAMP
You don't need to! The build script handles it automatically.

## Testing Your Setup

### Local:
```bash
npm run dev
```

Open http://localhost:5173 and check browser console for:
```
[skylineUrl] https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp?v=__dev__
```

### Production:
After deploying to Netlify, check browser console for:
```
[skylineUrl] https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp?v=1727200000
```

## Need Help?

If you see errors:
1. Check `.env` file exists and has correct values
2. Check Netlify environment variables are set
3. Check browser console for specific errors
4. See `TROUBLESHOOTING.md` for common issues
