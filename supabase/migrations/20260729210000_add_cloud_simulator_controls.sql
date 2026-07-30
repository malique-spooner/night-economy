alter table public.venue_test_services
  add column if not exists target_revenue_minor integer not null default 1000000 check (target_revenue_minor >= 0),
  add column if not exists rush_until_minute integer not null default 0 check (rush_until_minute between 0 and 390),
  add column if not exists slowdown_until_minute integer not null default 0 check (slowdown_until_minute between 0 and 390);
