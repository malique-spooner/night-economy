-- A 24-hour public demonstration needs enough customer flow for the market
-- engine to make visible five-minute price decisions. £50k is the realistic
-- upper end for a busy all-day London bar, while remaining far below the old
-- six-figure-looking totals.
with daily_schedule as (
  select jsonb_agg(entry || jsonb_build_object('targetRevenueMinor', 5000000) order by ordinality) as value
  from public.venues venue
  cross join lateral jsonb_array_elements(venue.market_schedule) with ordinality as schedule(entry, ordinality)
  where venue.slug = 'public-demo'
)
update public.venues
set market_schedule = daily_schedule.value
from daily_schedule
where slug = 'public-demo';

-- Update today's already-running scheduled market immediately. New daily
-- markets receive the same target from the schedule above.
update public.venue_test_services service
set target_revenue_minor = 5000000,
    updated_at = now()
from public.venues venue
where service.venue_id = venue.id
  and venue.slug = 'public-demo';
