-- The TV only needs a small, ordered history for the drinks on its current page.
-- Returning it in-database avoids transferring every decision for every drink.
create or replace function public.market_product_price_history(
  p_venue_id text,
  p_product_ids text[],
  p_limit integer default 48
)
returns table (
  product_id text,
  at timestamptz,
  old_price_minor integer,
  price_minor integer,
  movement text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recent_snapshots as (
    select created_at, snapshot
    from public.market_price_snapshots
    where venue_id = p_venue_id
    order by created_at desc
    limit least(greatest(p_limit, 1), 240)
  )
  select
    decision ->> 'productId' as product_id,
    coalesce((snapshot ->> 'roundEnd')::timestamptz, created_at) as at,
    (decision ->> 'oldPriceMinor')::integer as old_price_minor,
    (decision ->> 'newPriceMinor')::integer as price_minor,
    decision ->> 'movement' as movement
  from recent_snapshots
  cross join lateral jsonb_array_elements(coalesce(snapshot -> 'decisions', '[]'::jsonb)) as decisions(decision)
  where decision ->> 'productId' = any(p_product_ids)
    and jsonb_typeof(decision) = 'object'
  order by at asc;
$$;

grant execute on function public.market_product_price_history(text, text[], integer) to anon, authenticated;
