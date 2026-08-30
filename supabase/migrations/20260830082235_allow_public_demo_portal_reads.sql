-- The public Portal is visually the same as an operator Portal, but it only
-- reads simulated data from the one venue marked as the public demo. RLS stays
-- enabled and no anon write grant is introduced anywhere in this migration.
grant select on public.pos_connections, public.pos_products, public.pos_sales_events, public.market_runs to anon;

create policy "public demo can read POS connections"
  on public.pos_connections for select
  to anon
  using (
    exists (
      select 1 from public.venues v
      where v.id = pos_connections.venue_id
        and v.is_public_demo = true
    )
  );

create policy "public demo can read POS products"
  on public.pos_products for select
  to anon
  using (
    exists (
      select 1 from public.venues v
      where v.id = pos_products.venue_id
        and v.is_public_demo = true
    )
  );

create policy "public demo can read run history"
  on public.market_runs for select
  to anon
  using (
    exists (
      select 1 from public.venues v
      where v.id = market_runs.venue_id
        and v.is_public_demo = true
    )
  );

create policy "public demo can read simulated sales"
  on public.pos_sales_events for select
  to anon
  using (
    run_id is not null
    and exists (
      select 1 from public.venues v
      where v.id = pos_sales_events.venue_id
        and v.is_public_demo = true
    )
  );
