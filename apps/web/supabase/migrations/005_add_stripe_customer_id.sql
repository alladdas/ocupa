-- Migration 005: add stripe_customer_id and ats_profile_id to profiles
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS ats_profile_id INTEGER;
