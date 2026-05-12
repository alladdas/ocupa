-- Migration 011: apply_templates — recorded form-filling steps per company/ATS
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS apply_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company    TEXT        NOT NULL UNIQUE,
  ats        TEXT        NOT NULL,
  template   JSONB       NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS apply_templates_company_idx ON apply_templates(company);
CREATE INDEX IF NOT EXISTS apply_templates_ats_idx     ON apply_templates(ats);

-- RLS: service role (backend) manages templates; no public access needed
ALTER TABLE apply_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages apply templates"
  ON apply_templates
  USING (true)
  WITH CHECK (true);
