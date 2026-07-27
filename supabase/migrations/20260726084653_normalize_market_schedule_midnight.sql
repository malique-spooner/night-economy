-- Carry forward the old untouched Friday default, without changing a venue that
-- has chosen its own schedule.
update public.venues
set market_schedule = '[{"day":"Friday","start":"18:00","end":"00:00","enabled":true}]'::jsonb
where market_schedule = '[{"day":"Friday","start":"18:00","end":"02:00","enabled":true}]'::jsonb;
