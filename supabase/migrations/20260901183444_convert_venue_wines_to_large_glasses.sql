-- Both customer-facing venues sell the wine category by the large glass.
-- Prices use a current London 250ml-glass range: straightforward house wines
-- sit around £10–£12, while premium and sparkling options are higher.
with wine_prices(wine_name, price_minor) as (
  values
    ('Chardonnay', 1000),
    ('Merlot', 1050),
    ('Pinot Grigio', 1100),
    ('Rosé', 1100),
    ('Cabernet Sauvignon', 1150),
    ('Malbec', 1200),
    ('Pinot Noir', 1200),
    ('Prosecco', 1200),
    ('Rioja', 1200),
    ('Sauvignon Blanc', 1250),
    ('Orange Wine', 1300),
    ('Champagne', 2500)
)
update public.pos_products as pos
set
  source_name = prices.wine_name || ' Large Glass',
  base_price_minor = prices.price_minor,
  current_price_minor = prices.price_minor,
  updated_at = now(),
  synced_at = now()
from public.venues as venue, wine_prices as prices
where pos.venue_id = venue.id
  and venue.slug in ('showcase', 'public-demo')
  and regexp_replace(pos.source_name, ' Bottle$', '') = prices.wine_name;

with wine_prices(wine_name, price_minor) as (
  values
    ('Chardonnay', 1000),
    ('Merlot', 1050),
    ('Pinot Grigio', 1100),
    ('Rosé', 1100),
    ('Cabernet Sauvignon', 1150),
    ('Malbec', 1200),
    ('Pinot Noir', 1200),
    ('Prosecco', 1200),
    ('Rioja', 1200),
    ('Sauvignon Blanc', 1250),
    ('Orange Wine', 1300),
    ('Champagne', 2500)
)
update public.market_products as market
set
  display_name = prices.wine_name || ' Large Glass',
  base_price_minor = prices.price_minor,
  current_price_minor = prices.price_minor,
  floor_price_minor = round(prices.price_minor * 0.8)::integer,
  ceiling_price_minor = round(prices.price_minor * 1.2)::integer,
  updated_at = now()
from public.venues as venue, wine_prices as prices
where market.venue_id = venue.id
  and venue.slug in ('showcase', 'public-demo')
  and regexp_replace(market.display_name, ' Bottle$', '') = prices.wine_name;
