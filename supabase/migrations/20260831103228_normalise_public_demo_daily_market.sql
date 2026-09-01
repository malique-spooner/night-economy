-- Public Demo is a normal scheduled venue that opens once per local day.
-- Its target is four times the six-hour Showcase target because it trades for
-- four times as long. That preserves the same customer and pricing pace,
-- rather than leaving a 24-hour board almost static.
update public.venues
set market_schedule = jsonb_build_array(
  jsonb_build_object('day', 'Monday', 'enabled', true, 'start', '00:00', 'end', '23:59', 'targetRevenueMinor', 4000000),
  jsonb_build_object('day', 'Tuesday', 'enabled', true, 'start', '00:00', 'end', '23:59', 'targetRevenueMinor', 4000000),
  jsonb_build_object('day', 'Wednesday', 'enabled', true, 'start', '00:00', 'end', '23:59', 'targetRevenueMinor', 4000000),
  jsonb_build_object('day', 'Thursday', 'enabled', true, 'start', '00:00', 'end', '23:59', 'targetRevenueMinor', 4000000),
  jsonb_build_object('day', 'Friday', 'enabled', true, 'start', '00:00', 'end', '23:59', 'targetRevenueMinor', 4000000),
  jsonb_build_object('day', 'Saturday', 'enabled', true, 'start', '00:00', 'end', '23:59', 'targetRevenueMinor', 4000000),
  jsonb_build_object('day', 'Sunday', 'enabled', true, 'start', '00:00', 'end', '23:59', 'targetRevenueMinor', 4000000)
)
where slug = 'public-demo';
