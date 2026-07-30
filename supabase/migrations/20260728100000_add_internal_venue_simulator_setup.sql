-- Internal helpers for provisioning a venue's rehearsal POS. They are only
-- executable by the server-side service role; browser roles have no access.

create or replace function public.prepare_venue_test_service(p_venue_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_connection_id text := 'test_sim_' || p_venue_id;
begin
  insert into public.pos_connections (id, venue_id, provider, base_url, status)
  values (v_connection_id, p_venue_id, 'simulation', 'internal://venue-test-service', 'active')
  on conflict (id) do update
    set status = excluded.status,
        updated_at = now();

  insert into public.pos_products (
    id, venue_id, pos_connection_id, external_id, sku, source_name,
    base_price_minor, current_price_minor, currency, is_available
  )
  select
    'test_pos_' || mp.id,
    mp.venue_id,
    v_connection_id,
    mp.id,
    upper(mp.market_symbol),
    mp.display_name,
    mp.base_price_minor,
    mp.current_price_minor,
    v.currency,
    not mp.is_sold_out
  from public.market_products mp
  join public.venues v on v.id = mp.venue_id
  where mp.venue_id = p_venue_id
    and mp.pos_product_id is null
  on conflict (id) do update
    set source_name = excluded.source_name,
        base_price_minor = excluded.base_price_minor,
        current_price_minor = excluded.current_price_minor,
        is_available = excluded.is_available,
        synced_at = now(),
        updated_at = now();

  update public.market_products mp
  set pos_product_id = 'test_pos_' || mp.id,
      updated_at = now()
  where mp.venue_id = p_venue_id
    and mp.pos_product_id is null;

  insert into public.venue_test_services (venue_id)
  values (p_venue_id)
  on conflict (venue_id) do nothing;
end;
$$;

create or replace function public.reset_venue_test_prices(p_venue_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.market_products
  set current_price_minor = base_price_minor,
      updated_at = now()
  where venue_id = p_venue_id;

  update public.pos_products pp
  set current_price_minor = mp.base_price_minor,
      updated_at = now(),
      synced_at = now()
  from public.market_products mp
  where mp.venue_id = p_venue_id
    and pp.id = mp.pos_product_id;
end;
$$;

revoke all on function public.prepare_venue_test_service(text) from public, anon, authenticated;
revoke all on function public.reset_venue_test_prices(text) from public, anon, authenticated;
grant execute on function public.prepare_venue_test_service(text) to service_role;
grant execute on function public.reset_venue_test_prices(text) to service_role;
grant select, insert, update, delete on public.venue_test_services to service_role;
