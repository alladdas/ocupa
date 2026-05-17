-- Migration 012: salary and availability fields on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_salary TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS desired_salary TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS availability   TEXT DEFAULT 'Imediata';
