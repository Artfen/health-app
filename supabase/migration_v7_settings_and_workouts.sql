-- v7: user settings (language + body metrics) and richer manual workout logging.
-- Hand-run in the Supabase SQL editor, like the earlier migrations.

-- Profile: language preference + body metrics used for MET-based calorie estimation.
alter table public.profiles
  add column if not exists locale text default 'en',
  add column if not exists weight_kg numeric,
  add column if not exists height_cm numeric,
  add column if not exists birth_year integer,
  add column if not exists sex text;  -- 'male' | 'female' | null

-- Training sessions: fields a person can realistically log without a wearable.
alter table public.training_sessions
  add column if not exists rpe smallint,                 -- perceived effort 1..10
  add column if not exists distance_meters integer,       -- cardio distance
  add column if not exists start_time time,               -- time of day
  add column if not exists feel text,                     -- how it felt: great|good|ok|tired|rough
  add column if not exists calories integer,              -- burned (estimated or user override)
  add column if not exists calories_estimated boolean default false;
