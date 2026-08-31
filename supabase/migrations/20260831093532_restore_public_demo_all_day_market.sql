-- Each calendar day has its own 24-hour scheduled run. The scheduler changes
-- the dated slot key at local midnight, closing the old run and opening the
-- next one without taking Public Demo offline.
update public.venues
set market_schedule = jsonb_build_array(
  jsonb_build_object('day', 'Monday', 'enabled', true, 'start', '00:00', 'end', '00:00', 'targetRevenueMinor', 200000),
  jsonb_build_object('day', 'Tuesday', 'enabled', true, 'start', '00:00', 'end', '00:00', 'targetRevenueMinor', 400000),
  jsonb_build_object('day', 'Wednesday', 'enabled', true, 'start', '00:00', 'end', '00:00', 'targetRevenueMinor', 600000),
  jsonb_build_object('day', 'Thursday', 'enabled', true, 'start', '00:00', 'end', '00:00', 'targetRevenueMinor', 1000000),
  jsonb_build_object('day', 'Friday', 'enabled', true, 'start', '00:00', 'end', '00:00', 'targetRevenueMinor', 1500000),
  jsonb_build_object('day', 'Saturday', 'enabled', true, 'start', '00:00', 'end', '00:00', 'targetRevenueMinor', 2000000),
  jsonb_build_object('day', 'Sunday', 'enabled', true, 'start', '00:00', 'end', '00:00', 'targetRevenueMinor', 500000)
)
where slug = 'public-demo';
