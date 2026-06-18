-- v8: Apple Watch sync via Apple Shortcuts / Health Auto Export.
-- A per-user secret token authenticates POSTs to /api/apple-health/ingest
-- (the request carries no Supabase session — it comes from the user's phone).
-- Hand-run in the Supabase SQL editor.

alter table public.profiles
  add column if not exists apple_health_token text unique;
