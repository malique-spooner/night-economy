-- Platform access is separate from venue membership. It is used only for
-- Night Economy development tools, never for a venue's ordinary operators.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

grant select on public.platform_admins to authenticated;

drop policy if exists "platform admins can read their own access" on public.platform_admins;
create policy "platform admins can read their own access"
on public.platform_admins
for select
to authenticated
using ((select auth.uid()) = user_id);

insert into public.platform_admins (user_id)
select id
from auth.users
where email = 'maliquetyresespooner+dev@gmail.com'
on conflict (user_id) do nothing;
