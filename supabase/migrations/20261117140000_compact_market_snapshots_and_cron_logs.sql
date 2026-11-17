-- Historical price rounds need the final price decision, but only the newest
-- round in each venue/run needs momentum for the next pricing calculation.
with latest as (
  select venue_id, run_id, max(created_at) as latest_created_at
  from public.market_price_snapshots
  group by venue_id, run_id
), compacted as (
  select
    snapshot_row.id,
    case when snapshot_row.created_at = latest.latest_created_at then
      snapshot_row.snapshot - array['venueId', 'venueSlug', 'reason', 'salesWindow', 'evidenceWindow', 'roundStart']::text[]
    else
      snapshot_row.snapshot - array['venueId', 'venueSlug', 'reason', 'salesWindow', 'evidenceWindow', 'roundStart', 'momentum']::text[]
    end as snapshot
  from public.market_price_snapshots snapshot_row
  join latest
    on latest.venue_id = snapshot_row.venue_id
   and latest.run_id is not distinct from snapshot_row.run_id
   and latest.latest_created_at = snapshot_row.created_at
)
update public.market_price_snapshots snapshot_row
set snapshot = case
  when jsonb_typeof(compacted.snapshot->'decisions') = 'array' then jsonb_set(
    compacted.snapshot,
    '{decisions}',
    (
      select coalesce(
        jsonb_agg(decision.value - array['momentum', 'targetPriceMinor']::text[] order by decision.ordinality),
        '[]'::jsonb
      )
      from jsonb_array_elements(compacted.snapshot->'decisions') with ordinality as decision(value, ordinality)
    ),
    true
  )
  else compacted.snapshot
end
from compacted
where compacted.id = snapshot_row.id;

-- The scheduler runs every 15 seconds, so seven days of pg_cron diagnostics
-- are needlessly large. Keep one day; the product's market history is stored
-- separately and follows its own 30-day retention policy.
delete from cron.job_run_details
where end_time < now() - interval '1 day';

select cron.unschedule(jobid)
from cron.job
where jobname = 'night-economy-prune-cron-run-history-daily';

select cron.schedule(
  'night-economy-prune-cron-run-history-daily',
  '17 4 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '1 day';$$
);
