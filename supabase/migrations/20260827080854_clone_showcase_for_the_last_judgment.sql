-- Give The Last Judgment its own venue and simulator data, while reusing the
-- Showcase image URLs rather than duplicating storage objects.
insert into public.venues (
  id,
  slug,
  name,
  timezone,
  currency,
  market_live,
  tv_story_categories,
  market_schedule,
  crash_interval_minutes,
  crash_settings,
  launch_date,
  launch_start_time,
  launch_end_time
)
select
  'ven_last_judgment',
  'the-last-judgment',
  'The Last Judgment',
  timezone,
  currency,
  false,
  tv_story_categories,
  market_schedule,
  crash_interval_minutes,
  crash_settings,
  launch_date,
  launch_start_time,
  launch_end_time
from public.venues
where id = 'ven_showcase'
on conflict (id) do nothing;

insert into public.market_products (
  id,
  venue_id,
  market_symbol,
  logo_url,
  display_name,
  category,
  base_price_minor,
  current_price_minor,
  floor_price_minor,
  ceiling_price_minor,
  sales_velocity,
  is_live,
  is_sold_out,
  priority
)
select
  'mp_tlj_' || md5(source.id),
  'ven_last_judgment',
  source.market_symbol,
  source.logo_url,
  source.display_name,
  source.category,
  source.base_price_minor,
  source.current_price_minor,
  source.floor_price_minor,
  source.ceiling_price_minor,
  source.sales_velocity,
  source.is_live,
  source.is_sold_out,
  source.priority
from public.market_products source
where source.venue_id = 'ven_showcase'
on conflict (venue_id, market_symbol) do nothing;

select public.prepare_venue_test_service('ven_last_judgment');
