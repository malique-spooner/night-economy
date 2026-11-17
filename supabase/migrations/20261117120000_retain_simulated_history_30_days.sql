-- Keep the free-plan demo database bounded while retaining run summary rows.
-- Only internal simulated POS records are pruned; connected POS providers are
-- excluded, and live runs are protected even if one spans the retention edge.
create or replace function public.prune_simulated_market_history()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  retention_cutoff timestamptz := now() - interval '30 days';
begin
  delete from public.pos_sales_events event
  using public.pos_connections connection
  where connection.id = event.pos_connection_id
    and connection.provider in ('simulation', 'simulator')
    and event.occurred_at < retention_cutoff
    and not exists (
      select 1
      from public.venue_test_services service
      where service.active_run_id = event.run_id
    );

  delete from public.market_price_snapshots snapshot
  using public.venues venue
  where venue.id = snapshot.venue_id
    and exists (
      select 1
      from public.pos_connections connection
      where connection.venue_id = venue.id
        and connection.provider in ('simulation', 'simulator')
    )
    and snapshot.created_at < retention_cutoff
    and not exists (
      select 1
      from public.venue_test_services service
      where service.active_run_id = snapshot.run_id
    );
end;
$$;

revoke all on function public.prune_simulated_market_history() from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'night-economy-prune-simulated-market-history-daily';

select cron.schedule(
  'night-economy-prune-simulated-market-history-daily',
  '19 3 * * *',
  $$select public.prune_simulated_market_history();$$
);
