-- The TV's featured drinks are determined by live market movement, not a
-- permanently fixed set of priority products.
update public.market_products mp
set priority = false,
    updated_at = now()
from public.venues v
where v.id = mp.venue_id
  and v.slug = 'demo-venue'
  and mp.priority = true;
