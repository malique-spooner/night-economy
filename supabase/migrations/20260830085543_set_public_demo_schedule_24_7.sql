-- The visitor-facing venue is an always-on demonstration, not an evening-only service.
update public.venues
set market_schedule = '[
  {"day":"Monday","start":"00:00","end":"00:00","enabled":true,"targetRevenueMinor":1000000},
  {"day":"Tuesday","start":"00:00","end":"00:00","enabled":true,"targetRevenueMinor":1000000},
  {"day":"Wednesday","start":"00:00","end":"00:00","enabled":true,"targetRevenueMinor":1000000},
  {"day":"Thursday","start":"00:00","end":"00:00","enabled":true,"targetRevenueMinor":1000000},
  {"day":"Friday","start":"00:00","end":"00:00","enabled":true,"targetRevenueMinor":1000000},
  {"day":"Saturday","start":"00:00","end":"00:00","enabled":true,"targetRevenueMinor":1000000},
  {"day":"Sunday","start":"00:00","end":"00:00","enabled":true,"targetRevenueMinor":1000000}
]'::jsonb
where id = 'ven_public_demo'
  and is_public_demo = true;
