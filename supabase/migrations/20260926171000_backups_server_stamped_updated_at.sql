create function public.set_backups_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger backups_server_stamped_updated_at
before insert or update on public.backups
for each row
execute function public.set_backups_updated_at();
