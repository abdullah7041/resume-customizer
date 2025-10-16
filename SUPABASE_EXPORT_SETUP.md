# Supabase Resume Export Setup

This guide explains how to set up the resume export feature using your existing Supabase account.

## Overview

Your resume customizer now saves optimized resumes directly to **Supabase Storage** - no additional services needed! This provides:

✅ **Automatic setup** - Uses your existing Supabase configuration  
✅ **Secure storage** - Files are private and user-specific  
✅ **No extra costs** - Included in your Supabase plan  
✅ **Better UX** - No OAuth popups or third-party permissions  
✅ **Integrated** - Works seamlessly with your auth system  

## Quick Setup (5 minutes)

### Step 1: Run the Database Migration

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file `supabase-export-migration.sql` from your project root
4. Copy and paste the entire SQL script into the editor
5. Click **Run** to execute

This will:
- Create a `resume-exports` storage bucket
- Set up Row Level Security (RLS) policies
- Create a tracking table (optional, for listing exports)

### Step 2: Verify Storage Bucket

1. Go to **Storage** in your Supabase dashboard
2. You should see a new bucket called `resume-exports`
3. Click on it to verify it's set to **Private** (not public)

### Step 3: Test the Feature

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Sign in to your application

3. Upload a resume and run optimization

4. Click **"Save to Account"** button

5. You should see a success message and the file will open in a new tab

## How It Works

### File Storage Structure

Files are organized by user ID:
```
resume-exports/
  └── {user-id}/
      └── exports/
          ├── Resume_Optimized_2025-10-16_abc123.html
          ├── Resume_Optimized_2025-10-16_xyz789.html
          └── ...
```

### Security

- **Private bucket** - Files are not publicly accessible
- **User isolation** - Users can only access their own files
- **RLS policies** - Enforced at the database level
- **Signed URLs** - Temporary access links (7-day expiry)

### Features

✨ **Save to Account** - Saves HTML version of optimized resume  
✨ **Automatic naming** - Timestamped filenames prevent conflicts  
✨ **Metadata tracking** - Stores optimization settings and match scores  
✨ **Signed URLs** - Secure temporary access to view files  
✨ **Print fallback** - Works even without sign-in (uses print dialog)  

## User Experience

### For Signed-In Users

1. Click **"Save to Account"**
2. Resume is saved to Supabase Storage
3. Success message shows filename
4. File opens in new tab automatically
5. File is accessible from storage bucket

### For Anonymous Users

1. Click **"Save to Account"**
2. Prompted to sign in
3. OR they can use **"Print as PDF"** button
4. Opens browser print dialog
5. Can save as PDF locally

## Storage Limits

Default Supabase Storage limits:
- **Free tier**: 1GB storage
- **Pro tier**: 100GB+ storage
- **File size limit**: 50MB per file (configurable)

HTML files are typically 50-200KB, so you can store thousands of exports.

## Troubleshooting

### "Sign in required" Error

**Solution**: User must be authenticated to save to storage. Verify:
```javascript
const { data: { user } } = await supabase.auth.getUser();
console.log('User:', user); // Should not be null
```

### "Bucket not found" Error

**Solution**: Run the migration SQL script to create the bucket:
1. Go to Supabase SQL Editor
2. Run `supabase-export-migration.sql`
3. Verify bucket exists in Storage dashboard

### "Permission denied" Error

**Solution**: Check RLS policies:
1. Go to Storage → resume-exports → Policies
2. Verify all 4 policies are active (SELECT, INSERT, UPDATE, DELETE)
3. Re-run migration if policies are missing

### Files not showing in Storage

**Solution**: Check the path structure:
1. Go to Storage → resume-exports
2. Look for your user ID folder
3. Files are in `{user-id}/exports/` subfolder

## Advanced: Viewing User Exports

You can query saved exports from the database:

```javascript
import { supabase } from './services/supabase.js';

// Get all exports for current user
const { data: exports } = await supabase
  .from('resume_exports')
  .select('*')
  .order('created_at', { ascending: false });

console.log('My exports:', exports);
```

## Optional: Add Export Management UI

You can build a page to list and manage saved exports:

```jsx
import { listExports, downloadExport, deleteExport } from './services/supabaseExport.js';

const MyExports = () => {
  const [exports, setExports] = useState([]);
  
  useEffect(() => {
    listExports().then(setExports);
  }, []);
  
  return (
    <div>
      {exports.map(file => (
        <div key={file.name}>
          <span>{file.name}</span>
          <button onClick={() => downloadExport(file.name)}>
            Download
          </button>
          <button onClick={() => deleteExport(file.name)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
};
```

## Production Checklist

- ✅ Migration SQL script executed
- ✅ Storage bucket created and configured
- ✅ RLS policies active
- ✅ Storage limits reviewed
- ✅ Feature tested with real user account
- ✅ Error handling verified
- ✅ Success messages clear and helpful

## Support

If you encounter issues:

1. Check Supabase logs in Dashboard → Logs
2. Verify RLS policies are correctly configured
3. Ensure storage bucket exists and is private
4. Check browser console for errors
5. Verify user is authenticated before export

---

**No additional API keys or third-party services needed!** Everything works with your existing Supabase setup. 🎉
