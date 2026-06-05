create table public.objectives (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  target_date date,
  status text default 'active' check (status in ('active', 'completed', 'paused')),
  created_at timestamptz default now()
);

alter table public.objectives enable row level security;

create policy "Users can manage their own objectives"
  on public.objectives for all using (auth.uid() = user_id);
