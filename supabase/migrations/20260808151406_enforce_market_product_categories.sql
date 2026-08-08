-- A market drink is never meaningful without a category. The old temporary
-- records below are retained only as archived history; their current POS
-- category becomes the canonical category.
update public.market_products as mp
set
  category = pp.category,
  is_archived = true,
  is_live = false,
  priority = false,
  updated_at = now()
from public.pos_products as pp,
     public.venues as v
where pp.id = mp.pos_product_id
  and v.id = mp.venue_id
  and v.slug = 'demo-venue'
  and (mp.category is null or btrim(mp.category) = '' or lower(btrim(mp.category)) in ('uncategorized', 'uncategorised'))
  and pp.category is not null
  and btrim(pp.category) <> ''
  and lower(btrim(pp.category)) not in ('uncategorized', 'uncategorised');

alter table public.market_products
  alter column category set not null;

alter table public.market_products
  add constraint market_products_category_is_configured
  check (
    btrim(category) <> ''
    and lower(btrim(category)) not in ('uncategorized', 'uncategorised')
  );
