-- Transient store for the in-progress Garmin 2FA login flow.
-- Holds the serialized SSO cookie jar + CSRF token between the credentials
-- request and the code-verification request (serverless = no shared memory).
-- One row per user; overwritten on each new attempt and deleted on success.
create table if not exists public.garmin_mfa_sessions (
  user_id uuid references auth.users on delete cascade primary key,
  mfa_state jsonb not null,
  created_at timestamptz default now()
);

-- RLS on with no policies: only the service-role key (server-side) can touch it.
alter table public.garmin_mfa_sessions enable row level security;
