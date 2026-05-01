-- Migration 007: resumes table + Storage bucket + RLS policies
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url   TEXT NOT NULL,
  file_name  TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own resumes" ON resumes;
CREATE POLICY "Users manage own resumes" ON resumes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Storage bucket (private, 10 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage object RLS
DROP POLICY IF EXISTS "Users upload own resumes"  ON storage.objects;
DROP POLICY IF EXISTS "Users read own resumes"    ON storage.objects;
DROP POLICY IF EXISTS "Users delete own resumes"  ON storage.objects;

CREATE POLICY "Users upload own resumes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own resumes" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own resumes" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
