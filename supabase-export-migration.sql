-- Migration: Setup Resume Export Storage and Tracking
-- Run this in your Supabase SQL Editor

-- 1. Create the resume-exports storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('resume-exports', 'resume-exports', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up Row Level Security (RLS) policies for the bucket
-- Allow users to upload to their own folder
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'resume-exports' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own files
CREATE POLICY "Users can read their own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'resume-exports' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'resume-exports' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'resume-exports' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Create a table to track exports (optional - for listing/managing exports)
CREATE TABLE IF NOT EXISTS resume_exports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'resume-exports',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(user_id, file_path)
);

-- Enable RLS on resume_exports table
ALTER TABLE resume_exports ENABLE ROW LEVEL SECURITY;

-- RLS policies for resume_exports table
CREATE POLICY "Users can view their own exports"
ON resume_exports FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exports"
ON resume_exports FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exports"
ON resume_exports FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exports"
ON resume_exports FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_resume_exports_user_id ON resume_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_exports_created_at ON resume_exports(created_at DESC);

-- Grant necessary permissions
GRANT ALL ON resume_exports TO authenticated;
GRANT ALL ON resume_exports TO service_role;
