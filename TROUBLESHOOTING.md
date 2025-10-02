# Troubleshooting Guide

## If Background Image Doesn't Load in Production

### 1. Check Browser Console
Open browser DevTools (F12) and look for:
- CORS errors
- 404 errors for the image URL
- Network tab showing the image request status

### 2. Verify Environment Variables in Netlify
Go to Netlify Dashboard → Site Settings → Environment Variables

Ensure you have:
```
VITE_SUPABASE_URL=https://cwcjeujextkwpmzdfzdz.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

⚠️ **Important**: `VITE_SUPABASE_URL` should be JUST the project URL, not the full object URL!

❌ Wrong: `https://xxx.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp`
✅ Correct: `https://xxx.supabase.co`

### 3. Check Supabase Storage Bucket Settings
In Supabase Dashboard → Storage → ui-assets bucket:
- Bucket should be **public**
- File `KAFDH.webp` should exist
- File permissions should allow public read

### 4. Test the Image URL Directly
Copy the URL from browser console and paste it in a new tab. It should load the image directly.

Expected format:
```
https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp?v=TIMESTAMP
```

### 5. Force Rebuild and Clear Cache
```bash
# Clear Netlify cache and rebuild
netlify deploy --prod --build

# Or in Netlify UI:
# Deploys → Trigger Deploy → Clear cache and deploy site
```

---

## If PDF Upload Fails

### 1. Check File Format
- File must be `.pdf` or `.docx`
- File must be under 8 MB
- PDF must contain selectable text (not scanned images)

### 2. Test with Different PDF
Some PDFs are generated in ways that make text extraction difficult. Try:
- Exporting from Word/Google Docs instead of scanning
- Using "Save as PDF" instead of "Print to PDF"
- Converting through a PDF tool first

### 3. Check Netlify Function Logs
In Netlify Dashboard → Functions → parse-resume
- Look for errors in the function logs
- Check if the function is timing out (increase timeout if needed)

### 4. Test Netlify Function Locally
```bash
# Install Netlify CLI if not already installed
npm install -g netlify-cli

# Run functions locally
netlify dev

# Test the function
curl -X POST http://localhost:8888/.netlify/functions/parse-resume \
  -H "Content-Type: application/json" \
  -d '{"kind":"text","value":"Test resume text"}'
```

---

## If Theme Toggle Isn't Smooth

### 1. Check Browser Support
View Transitions API is supported in:
- Chrome/Edge 111+
- Safari 18+ (partial support)
- Firefox: Not yet (uses instant fallback)

### 2. Check Reduced Motion Preference
If user has `prefers-reduced-motion: reduce` set, transitions are disabled by design.

Test in browser:
```javascript
// In browser console
window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Should return false for transitions to work
```

### 3. Verify Theme CSS Loaded
Check in DevTools → Elements → `<html>` element should have:
- Class: `dark` or `light`
- Attribute: `data-theme="dark"` or `data-theme="light"`
- Style: `color-scheme: dark` or `color-scheme: light`

---

## If Tests Fail

### Run Specific Test
```bash
# Run a specific test file
npm test src/lib/assets.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Common Test Issues

#### Issue: Module import errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Issue: Environment variables not set in tests
Tests use Vitest's `vi.stubEnv()` to mock environment variables. Check that tests include:
```javascript
vi.stubEnv("VITE_SUPABASE_URL", "...");
```

---

## Performance Optimization

### 1. Preload Critical Images
Already done in `index.html` with dns-prefetch and preconnect.

### 2. Check Bundle Size
```bash
npm run build
# Check dist/assets/*.js sizes
# Should be under 500 KB gzipped for good performance
```

### 3. Analyze Bundle
```bash
# Install analyzer
npm install -D rollup-plugin-visualizer

# Add to vite.config.js and rebuild
# View analysis in stats.html
```

---

## Contact and Support

If issues persist:
1. Check browser console for specific errors
2. Review Netlify function logs
3. Verify Supabase storage permissions
4. Test locally with `npm run dev`

Remember to clear browser cache and do a hard refresh (Ctrl+Shift+R) after deploys!
