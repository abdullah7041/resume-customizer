# Supabase Upload Debugging Guide

## Current Issue
**Error**: `POST https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/resumes/f9ef22d5-c18f-41f2-a2c9-8b05c62eca67/resumes/20251022-131027-abdullahbinahemd-resume.pdf 400`

**Problem**: The path appears to have duplicate `/resumes/` segments, suggesting either:
1. The bucket structure is misconfigured
2. The path construction has a duplicate folder

## Step-by-Step Supabase Setup Check

### 1. Verify Bucket Exists
1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `cwcjeujextkwpmzdfzdz`
3. Navigate to **Storage** → **Buckets**
4. Confirm a bucket named **`resumes`** exists (exactly, lowercase)
5. If it doesn't exist, create it:
   - Click **"New bucket"**
   - Name: `resumes`
   - **Uncheck** "Public bucket" (keep it private)
   - **Disable** "File size limit" or set to 5MB
   - Click **"Create bucket"**

### 2. Configure Bucket Policies (RLS)
The bucket needs proper Row Level Security policies to allow authenticated users to upload.

**Go to**: Storage → Buckets → `resumes` → Policies

**Required Policies**:

#### Policy 1: Allow Insert (Upload)
```sql
CREATE POLICY "Allow authenticated users to upload resumes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resumes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**Or simpler version**:
```sql
CREATE POLICY "resumes-insert-own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resumes'
  AND auth.uid()::text = split_part(name, '/', 1)
);
```

#### Policy 2: Allow Select (Download)
```sql
CREATE POLICY "Allow authenticated users to read own resumes"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'resumes'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**Or simpler version**:
```sql
CREATE POLICY "resumes-select-own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'resumes'
  AND auth.uid()::text = split_part(name, '/', 1)
);
```

### 3. Check Bucket Settings
**Go to**: Storage → Buckets → `resumes` → Settings

Verify:
- ✅ **Public**: OFF (unchecked)
- ✅ **Allowed MIME types**: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- ✅ **File size limit**: 5 MB
- ✅ **Allowed file extensions**: `.pdf`, `.docx`

### 4. Test Authentication
Before uploading, ensure you're authenticated:

```javascript
// In browser console:
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user);
```

If `user` is `null`, you need to sign in first.

### 5. Test Upload Manually
Try uploading via browser console:

```javascript
// 1. Get user ID
const { data: { user } } = await supabase.auth.getUser();
console.log('User ID:', user.id);

// 2. Create a test file
const testContent = 'Test resume content';
const testBlob = new Blob([testContent], { type: 'text/plain' });

// 3. Try upload
const testPath = `${user.id}/test-upload.txt`;
const { data, error } = await supabase.storage
  .from('resumes')
  .upload(testPath, testBlob, {
    cacheControl: '3600',
    upsert: false
  });

console.log('Upload result:', { data, error });
```

### 6. Common 400 Error Causes

#### A. Bucket doesn't exist
**Error**: "Bucket not found"
**Fix**: Create the `resumes` bucket (see Step 1)

#### B. No RLS policies
**Error**: "new row violates row-level security policy"
**Fix**: Add the policies from Step 2

#### C. Wrong path format
**Current path**: `{userId}/resumes/{filename}`
**Expected for bucket `resumes`**: `{userId}/resumes/{filename}` ✅

The path is CORRECT. The issue is likely missing policies.

#### D. User not authenticated
**Error**: "JWT expired" or similar
**Fix**: Sign in again

#### E. File type not allowed
**Error**: "File type not allowed"
**Fix**: Check bucket settings (Step 3) - add PDF and DOCX MIME types

### 7. Verify Upload Path Construction
The app constructs paths as:
```javascript
// From supabase.js line 22:
const path = `${userId}/resumes/${fileName}`;
// Example: "f9ef22d5-c18f-41f2-a2c9-8b05c62eca67/resumes/20251022-131027-abdullahbinahemd-resume.pdf"
```

This is stored in the `resumes` bucket, so the full storage path is:
```
Bucket: resumes
Path: f9ef22d5-c18f-41f2-a2c9-8b05c62eca67/resumes/20251022-131027-abdullahbinahemd-resume.pdf
```

### 8. Quick Fix Commands

#### Check if bucket exists (SQL Editor):
```sql
SELECT * FROM storage.buckets WHERE name = 'resumes';
```

#### Check current policies (SQL Editor):
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage';
```

#### Remove all policies and start fresh (SQL Editor):
```sql
-- Be careful! This removes ALL storage policies
DROP POLICY IF EXISTS "resumes-insert-own" ON storage.objects;
DROP POLICY IF EXISTS "resumes-select-own" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read own resumes" ON storage.objects;
```

Then re-add the policies from Step 2.

## Most Likely Solution

Based on the error, the most common cause is **missing RLS policies**. The 400 error typically means:
1. The bucket exists ✅
2. The path format is correct ✅
3. But the policies don't allow the upload ❌

**Action**: Go to Supabase Dashboard → Storage → Buckets → `resumes` → Policies and add the INSERT policy from Step 2.

## Testing After Fix

1. Refresh your app
2. Sign in (if not already)
3. Try uploading a PDF resume
4. Check browser console for any errors
5. If successful, you should see the file in Supabase Dashboard → Storage → `resumes` → Browse

## Still Having Issues?

Check the Supabase logs:
1. Dashboard → Settings → Logs
2. Look for storage-related errors
3. Check authentication logs for JWT issues
