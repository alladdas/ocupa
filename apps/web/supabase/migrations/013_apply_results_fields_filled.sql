-- Migration 013: track which fields were filled per apply_result
ALTER TABLE apply_results ADD COLUMN IF NOT EXISTS fields_filled JSONB;
