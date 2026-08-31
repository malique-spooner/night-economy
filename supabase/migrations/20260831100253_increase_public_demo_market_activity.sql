-- The public market runs all day, so it needs enough demand for visible
-- five-minute price movements rather than the very quiet weekday targets used
-- by a six-hour operator service.
update public.venues
set market_schedule = (
  select jsonb_agg(entry || jsonb_build_object('targetRevenueMinor', 1000000))
  from jsonb_array_elements(market_schedule) entry
)
where slug = 'public-demo';
