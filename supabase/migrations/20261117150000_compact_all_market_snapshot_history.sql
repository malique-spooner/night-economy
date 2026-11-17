-- Compact every historical snapshot, not just each run's latest round. Keep
-- market momentum on the latest round of each venue/run for the live pricing
-- engine; it is redundant on all earlier rounds. Price decisions remain intact.
with latest as (
  select venue_id, run_id, max(created_at) as latest_created_at
  from public.market_price_snapshots
  group by venue_id, run_id
), compacted as (
  select
    snapshot_row.id,
    case when latest.latest_created_at is not null then
      snapshot_row.snapshot - array['venueId', 'venueSlug', 'reason', 'salesWindow', 'evidenceWindow', 'roundStart']::text[]
    else
      snapshot_row.snapshot - array['venueId', 'venueSlug', 'reason', 'salesWindow', 'evidenceWindow', 'roundStart', 'momentum']::text[]
    end as snapshot
  from public.market_price_snapshots snapshot_row
  left join latest
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
