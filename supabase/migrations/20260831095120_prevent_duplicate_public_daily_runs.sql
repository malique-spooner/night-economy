-- Public Demo records a complete calendar day, rather than the six-hour
-- maximum used by operator-run rehearsals.
alter table public.market_runs
  drop constraint if exists market_runs_simulated_minutes_check;

alter table public.market_runs
  add constraint market_runs_simulated_minutes_check
  check (simulated_minutes between 0 and 1440);

-- The scheduler may be invoked concurrently. Public Demo has exactly one
-- scheduled market per dated slot, so enforce that at the database boundary.
create unique index if not exists market_runs_public_demo_daily_slot_unique
  on public.market_runs (scheduled_slot_key)
  where venue_id = 'ven_public_demo' and kind = 'scheduled';
