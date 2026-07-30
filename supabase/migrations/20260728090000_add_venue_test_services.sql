-- A venue-owned rehearsal service. It is deliberately separate from a real POS.
create table if not exists public.venue_test_services (
  venue_id text primary key references public.venues(id) on delete cascade,
  status text not null default 'idle' check (status in ('idle', 'running', 'paused', 'ended')),
  simulated_minute integer not null default 0 check (simulated_minute between 0 and 360),
  speed integer not null default 32 check (speed between 1 and 120),
  last_tick_at timestamptz,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.venue_test_services enable row level security;
grant select on public.venue_test_services to authenticated;

create policy "venue members can read their test service"
  on public.venue_test_services for select to authenticated
  using (
    exists (
      select 1 from public.venue_members vm
      where vm.venue_id = venue_test_services.venue_id
        and vm.user_id = (select auth.uid())
    )
  );

alter table public.pos_connections drop constraint if exists pos_connections_provider_check;
alter table public.pos_connections add constraint pos_connections_provider_check
  check (provider in ('simulator', 'simulation', 'lightspeed'));
