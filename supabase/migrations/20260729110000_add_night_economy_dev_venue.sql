-- A separate, fully independent development venue for product demonstrations.
-- It begins with the showcase catalogue, but has its own simulator, prices,
-- schedule, and operator account.

insert into public.venues (
  id,
  slug,
  name,
  timezone,
  currency,
  market_live,
  crash_interval_minutes,
  launch_date,
  launch_start_time,
  launch_end_time,
  market_schedule
)
select
  'ven_development',
  'development',
  'Night Economy Dev',
  timezone,
  currency,
  false,
  crash_interval_minutes,
  launch_date,
  launch_start_time,
  launch_end_time,
  market_schedule
from public.venues
where id = 'ven_showcase'
on conflict (id) do nothing;

insert into public.market_products (
  id,
  venue_id,
  market_symbol,
  display_name,
  category,
  base_price_minor,
  current_price_minor,
  floor_price_minor,
  ceiling_price_minor,
  is_live,
  is_sold_out,
  priority,
  sales_velocity
)
select
  'dev_' || mp.id,
  'ven_development',
  mp.market_symbol,
  mp.display_name,
  mp.category,
  mp.base_price_minor,
  mp.base_price_minor,
  mp.floor_price_minor,
  mp.ceiling_price_minor,
  mp.is_live,
  mp.is_sold_out,
  mp.priority,
  mp.sales_velocity
from public.market_products mp
where mp.venue_id = 'ven_showcase'
on conflict (id) do nothing;

select public.prepare_venue_test_service('ven_development');

insert into public.venue_members (venue_id, user_id, role)
select 'ven_development', id, 'owner'
from auth.users
where email = 'maliquetyresespooner+dev@gmail.com'
on conflict (venue_id, user_id) do update set role = excluded.role;
