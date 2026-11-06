-- One row per person, holding all of their projects, blocks and settings.
create table public.user_data (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

-- Row level security is what keeps each person's data private to them.
alter table public.user_data enable row level security;

create policy "read own data" on public.user_data
  for select to authenticated using (auth.uid() = user_id);

create policy "add own data" on public.user_data
  for insert to authenticated with check (auth.uid() = user_id);

create policy "change own data" on public.user_data
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.user_data from anon, public;
grant select, insert, update on public.user_data to authenticated;
