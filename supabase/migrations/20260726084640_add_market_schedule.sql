alter table public.venues
  add column if not exists market_schedule jsonb not null default '[{"day":"Friday","start":"18:00","end":"00:00","enabled":true}]'::jsonb;
