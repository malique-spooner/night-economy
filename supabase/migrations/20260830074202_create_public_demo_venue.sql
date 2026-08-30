-- A separate, public-facing venue. It is readable anonymously, but has no
-- memberships: public visitors cannot use the operator portal or mutate it.
alter table public.venues
  add column if not exists is_public_demo boolean not null default false;

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
  launch_end_time,
  is_public_demo
)
select
  'ven_public_demo',
  'public-demo',
  'Night Economy Public Demo',
  timezone,
  currency,
  true,
  tv_story_categories,
  market_schedule,
  crash_interval_minutes,
  crash_settings,
  launch_date,
  launch_start_time,
  launch_end_time,
  true
from public.venues
where id = 'ven_showcase'
on conflict (id) do update
  set name = excluded.name,
      is_public_demo = true,
      updated_at = now();

-- Reuse Showcase's public image URLs while giving the demo its own catalogue,
-- prices, and simulator records.
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
  priority,
  is_archived
)
select
  'mp_public_' || md5(source.id),
  'ven_public_demo',
  source.market_symbol,
  source.logo_url,
  source.display_name,
  source.category,
  source.base_price_minor,
  source.base_price_minor,
  source.floor_price_minor,
  source.ceiling_price_minor,
  source.sales_velocity,
  source.is_live,
  source.is_sold_out,
  source.priority,
  source.is_archived
from public.market_products source
where source.venue_id = 'ven_showcase'
on conflict (venue_id, market_symbol) do nothing;

select public.prepare_venue_test_service('ven_public_demo');

-- The Last Judgment was an internal test venue. Remove its data and the
-- dedicated test login now that Showcase is the only private development venue.
-- Publication-line foreign keys deliberately use RESTRICT, so remove the
-- historical publication records before the venue cascade removes its drinks.
delete from public.price_publication_lines
where market_product_id in (
  select id from public.market_products where venue_id = 'ven_last_judgment'
)
or pos_product_id in (
  select id from public.pos_products where venue_id = 'ven_last_judgment'
);

delete from public.price_publications
where venue_id = 'ven_last_judgment';

delete from public.pos_sales_events
where venue_id = 'ven_last_judgment';

delete from auth.users
where email = 'manager@thelastjudgment.com';

delete from public.venues
where id = 'ven_last_judgment';
