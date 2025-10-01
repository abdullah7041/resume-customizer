# 🔧 Quick Reference: Skyline URL Debugging

## 🎯 Quick Checks

### ✅ Is the URL correct?
Check browser console for:
```
[skylineUrl] https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp?v=...
```

**Expected**: Single occurrence of `KAFDH.webp` in the URL  
**Wrong**: `...KAFDH.webp/KAFDH.webp...` (duplication)

---

## 🧪 Test Commands

```bash
# Run all tests
npm test

# Run only assets tests
npm test -- src/lib/assets.test.ts

# Run with watch mode
npm test -- --watch

# Check linting
npm run lint
```

---

## 🔍 Common Issues & Solutions

### Issue 1: Test fails with "expected to throw"
**Symptom**: `assets.test.ts` test fails  
**Cause**: `isDevEnvironment()` not detecting test mode  
**Solution**: Already fixed - check `VITEST` env var is set

### Issue 2: URL has duplicate filename
**Symptom**: URL looks like `.../KAFDH.webp/KAFDH.webp`  
**Cause**: `VITE_SUPABASE_URL` includes full object path  
**Solution**: Set URL to project base only:
```bash
# ✅ Correct
VITE_SUPABASE_URL=https://cwcjeujextkwpmzdfzdz.supabase.co

# ❌ Wrong
VITE_SUPABASE_URL=https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp
```

### Issue 3: Image doesn't load
**Symptom**: No background image visible  
**Check**:
1. Console for `[skylineUrl]` log
2. Network tab for 404 errors
3. `skylineUrl` is not empty string
4. CORS headers are correct

### Issue 4: Image pops in suddenly
**Symptom**: No smooth transition  
**Cause**: Skeleton loader not showing  
**Check**: `skylineLoaded` state is being updated

---

## 🎨 Loading States

### State 1: Initial (No Image Yet)
```javascript
skylineUrl = ""
skylineLoaded = false
→ No skeleton, no image (just gradients)
```

### State 2: Loading
```javascript
skylineUrl = "https://..."
skylineLoaded = false
→ Skeleton visible (pulsing gradient)
→ Image hidden (opacity-0)
```

### State 3: Loaded
```javascript
skylineUrl = "https://..."
skylineLoaded = true
→ Skeleton hidden
→ Image visible with entrance animation
```

---

## 📊 Environment Detection

```javascript
isDevEnvironment() returns true when:
- import.meta.env.DEV === true
- import.meta.env.MODE !== "production"
- process.env.NODE_ENV !== "production"
- process.env.VITEST is set
- process.env.NODE_ENV is undefined
```

---

## 🎯 Key Functions

### `getSkylineUrl()`
Returns the full URL to the skyline image with cache-busting version.

**Validates**:
- ✅ Base URL is project URL (not object URL)
- ✅ No duplicate filename segments
- ✅ Proper URL format
- ✅ Cache busting version added

**Logs**:
- `console.info("[skylineUrl]", url)` in dev mode
- `console.error(...)` if URL is misconfigured

### `validatePublicUrl(url)`
Validates and normalizes URLs.

**Checks**:
- ✅ URL is a string
- ✅ URL is not empty
- ✅ URL is valid format
- ✅ Protocol is http/https
- ✅ No double slashes in path

### `withVersion(url)`
Adds cache-busting version parameter.

**Looks for** (in order):
1. `VITE_BUILD_TIMESTAMP`
2. `VITE_BUILD_ID`
3. `VITE_BUILD_TAG`
4. Falls back to `__dev__`

---

## 🚨 Error Messages

### "VITE_SUPABASE_URL must be the Supabase *project* URL..."
**Meaning**: Base URL includes object path  
**Action**: Strip to project base URL only  
**Mode**: Throws in dev, sanitizes in prod

### "Skyline asset segment missing in resolved URL"
**Meaning**: Filename not at end of path  
**Action**: Check path construction logic

### "Skyline asset segment duplicated in resolved URL"
**Meaning**: Filename appears more than once  
**Action**: Check for path concatenation bugs

---

## 💡 Tips

1. **Always check console** for `[skylineUrl]` log first
2. **Test in both themes** (light/dark) to verify overlays
3. **Check network tab** if image fails to load
4. **Run tests** after any URL logic changes
5. **Verify VITE_SUPABASE_URL** doesn't include full object path

---

## 📞 Quick Debug Checklist

- [ ] Run `npm test` - all pass?
- [ ] Check console for `[skylineUrl]` log
- [ ] Verify URL has single `KAFDH.webp` occurrence
- [ ] Check `VITE_SUPABASE_URL` in `.env` file
- [ ] Inspect network tab for image request
- [ ] Test light/dark mode toggle
- [ ] Check skeleton loader appears briefly
- [ ] Verify smooth entrance animation

---

**Last Updated**: October 1, 2025  
**Status**: ✅ All issues resolved
