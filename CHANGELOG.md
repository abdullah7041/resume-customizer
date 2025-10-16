# Recent Updates - October 16, 2025

## 🎉 New Features & Bug Fixes

### 1. ✅ UTF-8 Encoding Fix

**Problem Fixed**: Garbled text appearing in resume textarea when pasting content with international characters, accents, or special symbols.

**Solution**:
- Updated text sanitization to preserve all valid UTF-8 characters
- Only removes NULL bytes and control characters that break parsing
- Added proper paste event handler for clipboard data
- International resumes with accented names now work perfectly

**Files Updated**:
- `src/components/ui/UploadCard.jsx`

### 2. ✅ Supabase Storage Export

**New Feature**: Save optimized resumes directly to your Supabase account!

**Benefits**:
- ✨ No external services needed (uses your existing Supabase)
- ✨ Secure, private storage per user
- ✨ Automatic file naming with timestamps
- ✨ Opens saved resume in new tab
- ✨ Print dialog as fallback for anonymous users

**How to Use**:
1. Sign in to your account
2. Optimize your resume
3. Click **"Save to Account"** button
4. Resume is saved to your Supabase Storage
5. File opens automatically in new tab

**Setup Required**:
See [`SUPABASE_EXPORT_SETUP.md`](./SUPABASE_EXPORT_SETUP.md) for 5-minute setup guide.

Quick setup:
```bash
# 1. Go to Supabase SQL Editor
# 2. Run the migration script:
cat supabase-export-migration.sql
# 3. Copy and execute in Supabase dashboard
```

**Files Added**:
- `src/services/supabaseExport.js` - Export service
- `supabase-export-migration.sql` - Database setup
- `SUPABASE_EXPORT_SETUP.md` - Setup guide

**Files Updated**:
- `src/components/MainContent.jsx` - Export logic
- `src/features/Optimization.jsx` - UI buttons
- `src/services/exportPdf.js` - Added `skipPrint` option

## Testing

### UTF-8 Encoding
```bash
# Test with international characters
1. Paste text with accents: "José García, Müller, 北京"
2. Verify characters display correctly
3. No garbled/binary text should appear
```

### Supabase Export
```bash
# Prerequisites
1. Run migration SQL in Supabase dashboard
2. Sign in to your app
3. Upload and optimize a resume

# Test export
1. Click "Save to Account"
2. Should see success message
3. File opens in new tab
4. Verify file exists in Supabase Storage → resume-exports bucket
```

## Architecture

### Export Flow
```
User clicks "Save to Account"
  ↓
Generate HTML from resume data
  ↓
Check if user is signed in
  ↓
Upload to Supabase Storage
  ↓
Create signed URL (7-day expiry)
  ↓
Open file in new tab
  ↓
Store metadata in database (optional)
```

### Storage Structure
```
Supabase Storage Bucket: resume-exports (private)
  └── {user-id}/
      └── exports/
          └── Resume_Optimized_2025-10-16_abc123.html
```

## Security

- 🔒 Private storage bucket (not publicly accessible)
- 🔒 Row Level Security (RLS) enforced
- 🔒 Users can only access their own files
- 🔒 Signed URLs expire after 7 days
- 🔒 No external API keys required

## Backward Compatibility

- ✅ Print dialog still available as fallback
- ✅ Works without sign-in (uses print)
- ✅ No breaking changes to existing features
- ✅ UTF-8 fix is transparent to users

## Migration Notes

If you were using the Google Drive export (from previous version):
- Google Drive code has been removed
- Supabase is simpler and already integrated
- No external OAuth required
- Better UX with no permission dialogs

## Support

For issues or questions:
1. Check `SUPABASE_EXPORT_SETUP.md` for setup help
2. Verify migration SQL was executed
3. Check Supabase Dashboard → Logs for errors
4. Ensure user is authenticated before export

---

**Both features are production-ready and tested!** 🚀
