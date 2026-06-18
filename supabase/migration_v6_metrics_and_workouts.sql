-- ============================================================
-- v6: current body battery, VO2 max, and structured workout routines
-- Run in the Supabase SQL Editor. Safe to run once.
-- ============================================================

-- Current (most-recent) body battery, distinct from the daily high/low, and VO2 max.
alter table public.health_snapshots
  add column if not exists body_battery_current integer,
  add column if not exists vo2_max numeric;

-- Structured exercise routine for a training session (Hevy-style sets).
-- Shape: [{ name, sets: [{ weight, reps, done }] }]
alter table public.training_sessions
  add column if not exists exercises jsonb default '[]'::jsonb;
