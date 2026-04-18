-- Add description column to scraped_jobs (safe to run multiple times)
ALTER TABLE scraped_jobs ADD COLUMN IF NOT EXISTS description TEXT;
