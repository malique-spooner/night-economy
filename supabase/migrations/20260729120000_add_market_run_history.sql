create table if not exists public.market_runs (
  id text primary key,
  venue_id text not null references public.venues(id) on delete cascade,
  kind text not null check (kind in ('quick', 'scheduled')),
  status text not null check (status in ('running', 'paused', 'ended', 'completed')),
  scheduled_slot_key text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  simulated_minutes integer not null default 0 check (simulated_minutes between 0 and 360),
  sales_count integer not null default 0,
  revenue_minor integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.market_runs enable row level security;
grant select on public.market_runs to authenticated;
create policy "venue members can read their market runs"
  on public.market_runs for select to authenticated
  using (
    exists (
      select 1 from public.venue_members vm
      where vm.venue_id = market_runs.venue_id
        and vm.user_id = (select auth.uid())
    )
  );

alter table public.venue_test_services
  add column if not exists active_run_id text references public.market_runs(id) on delete set null;

alter table public.pos_sales_events
  add column if not exists run_id text references public.market_runs(id) on delete set null;

create index if not exists market_runs_venue_started_at_idx on public.market_runs (venue_id, started_at desc);
create index if not exists pos_sales_events_run_id_idx on public.pos_sales_events (run_id);
