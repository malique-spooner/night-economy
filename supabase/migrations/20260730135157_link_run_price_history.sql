alter table public.market_price_snapshots
  add column if not exists run_id text references public.market_runs(id) on delete set null;

create index if not exists market_price_snapshots_run_created_at_idx
  on public.market_price_snapshots (run_id, created_at asc)
  where run_id is not null;

update public.market_price_snapshots snapshot_row
set run_id = (
  select run.id
  from public.market_runs run
  where run.venue_id = snapshot_row.venue_id
    and snapshot_row.created_at >= run.started_at
    and snapshot_row.created_at <= coalesce(run.ended_at, run.updated_at, now())
  order by run.started_at desc
  limit 1
)
where snapshot_row.run_id is null
  and snapshot_row.reason = 'venue_test_service'
  and exists (
    select 1
    from public.market_runs run
    where run.venue_id = snapshot_row.venue_id
      and snapshot_row.created_at >= run.started_at
      and snapshot_row.created_at <= coalesce(run.ended_at, run.updated_at, now())
  );
