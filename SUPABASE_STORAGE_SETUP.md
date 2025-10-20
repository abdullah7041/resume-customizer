# Supabase Resume Storage Hardening

The goal of this guide is to keep every uploaded resume intact from the moment a user selects a file to the point we parse plain text. Follow the steps below **before** pointing a production build at a new Supabase project.

## 1. Create the storage bucket
- Navigate to **Storage → Buckets → New bucket** and create a bucket named `resumes` (lowercase).
- Leave **Public bucket** unchecked. We only allow authenticated access through signed requests.
- Disable **Image transformations** and **Automatic content-type detection**. These features are useful for images but may rewrite the uploaded binary and break DOCX files.

## 2. Lock down CORS and file types
- Under the bucket’s **Settings → CORS**, add the production and preview origins (`https://your-app.netlify.app`, `http://localhost:8888`).
- Allowed methods: `GET`, `POST`, `PUT`, `HEAD`.
- Allowed headers: `authorization`, `content-type`, `x-client-info`.
- Expose headers: `content-type`, `content-length`, `content-disposition`.
- Set **Max age** to `3600` seconds.

Inside **Settings → Upload configuration**:
- Add allowed MIME types: `application/pdf` and `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- Add allowed file extensions: `.pdf`, `.docx`.
- Set max upload size to `5 MB` to mirror the client-side guard.

## 3. Configure Row Level Security (RLS)
In **Auth → Policies**, enable RLS on the `storage.objects` table and add the policies below (SQL shown for clarity):

```sql
-- Allow authenticated users to upload into their own folder
create policy "resumes-insert-own" on storage.objects
  for insert
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = split_part(name, '/', 1)
  );

-- Allow authenticated users to read any object they uploaded
create policy "resumes-select-own" on storage.objects
  for select using (
    bucket_id = 'resumes'
    and auth.uid()::text = split_part(name, '/', 1)
  );
```

These rules ensure each user reads and writes only under `user_id/resumes/...`, matching `buildStorageObjectKey` in `src/services/supabase.js`.

## 4. Preserve binary integrity
- In **Storage → Buckets → resumes → Settings**, turn on **Cache-Control default** of `3600` seconds and leave **Content-Type enforcement** enabled.
- Do **not** enable any Supabase beta features that “optimize” files (resizing, minification). They can mutate byte order and make DOCX files unreadable.
- Confirm the Supabase project is running the latest storage engine version. Upgrading older projects (pre-2024) prevents known DOCX truncation bugs.

## 5. Service role usage for server-side repairs
If you plan to run background jobs (e.g., deletion or reprocessing), add `SUPABASE_SERVICE_ROLE_KEY` to Netlify. When using it, always request files with `responseType: 'arraybuffer'` to keep binary data byte-perfect.

## 6. Verification checklist
1. Upload both a PDF and DOCX via the app.
2. Use the Supabase dashboard to download each object and confirm the SHA-256 hash matches the local file.
3. Run `npm run test -- src/services/supabase.test.js` to verify our parsing utilities can read the stored binary.
4. Open the browser DevTools network tab and confirm each storage download returns the original `Content-Type` without extra `charset` parameters.
5. Reload the app; the console should **not** log "Detected corrupted resume data".

If any step fails, the file is mutated somewhere in the pipeline. Revisit bucket settings, double-check proxies, and rerun the verification items until all pass.
