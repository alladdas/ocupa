-- Migration 009: application results tracking
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS apply_results (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- scraped_jobs.id is TEXT (e.g. "7672856", "alterlab-ifood-xxx")
  job_id        TEXT        REFERENCES scraped_jobs(id) ON DELETE SET NULL,
  user_id       UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  source        TEXT,
  error_message TEXT,
  applied_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS apply_results_user_id_idx ON apply_results(user_id);
CREATE INDEX IF NOT EXISTS apply_results_job_id_idx  ON apply_results(job_id);

-- RLS: authenticated users can read their own results
ALTER TABLE apply_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own apply results"
  ON apply_results FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (backend) inserts results
CREATE POLICY "Service role inserts apply results"
  ON apply_results FOR INSERT
  WITH CHECK (true);
