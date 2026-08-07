alter table public.market_products
  add column if not exists is_archived boolean not null default false;

grant update (pos_product_id, is_archived) on public.market_products to authenticated;

create policy "venue admins can delete market logos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'market-logos'
  and exists (
    select 1 from public.venue_members vm
    where vm.venue_id = (storage.foldername(name))[1]
      and vm.user_id = (select auth.uid())
      and vm.role in ('owner', 'admin')
  )
);
