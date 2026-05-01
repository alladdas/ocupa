-- Migration 006: add onboarding_completed flag to profiles
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
