alter table public.market_products
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'market-logos',
  'market-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "venue admins can upload market logos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'market-logos'
  and exists (
    select 1 from public.venue_members vm
    where vm.venue_id = (storage.foldername(name))[1]
      and vm.user_id = (select auth.uid())
      and vm.role in ('owner', 'admin')
  )
);

create policy "venue admins can replace market logos"
on storage.objects for update to authenticated
using (
  bucket_id = 'market-logos'
  and exists (
    select 1 from public.venue_members vm
    where vm.venue_id = (storage.foldername(name))[1]
      and vm.user_id = (select auth.uid())
      and vm.role in ('owner', 'admin')
  )
)
with check (
  bucket_id = 'market-logos'
  and exists (
    select 1 from public.venue_members vm
    where vm.venue_id = (storage.foldername(name))[1]
      and vm.user_id = (select auth.uid())
      and vm.role in ('owner', 'admin')
  )
);
