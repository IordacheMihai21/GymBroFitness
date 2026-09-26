create table public.backups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.backups enable row level security;

revoke all on table public.backups from anon;
grant select, insert, update, delete on table public.backups to authenticated;

create policy "Users can read their own backup"
on public.backups
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own backup"
on public.backups
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own backup"
on public.backups
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own backup"
on public.backups
for delete
to authenticated
using ((select auth.uid()) = user_id);
