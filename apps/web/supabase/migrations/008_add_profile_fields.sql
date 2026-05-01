-- Migration 008: add personal data + job preference columns to profiles
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name  TEXT,
  ADD COLUMN IF NOT EXISTS last_name   TEXT,
  ADD COLUMN IF NOT EXISTS phone       TEXT,
  ADD COLUMN IF NOT EXISTS city        TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS job_type    TEXT,
  ADD COLUMN IF NOT EXISTS seniority   TEXT,
  ADD COLUMN IF NOT EXISTS work_model  TEXT;
