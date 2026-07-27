-- Keep the first TV market intentionally short: familiar choices, eight in
-- each main category. Every other POS-backed drink stays in the Portal but is
-- inactive until an operator chooses to bring it into the live market.
with curated(category, display_name) as (
  values
    ('Beer', 'Guinness Pint'), ('Beer', 'Camden Hells Pint'), ('Beer', 'Beavertown Neck Oil Pint'), ('Beer', 'Brixton Reliance Pale Ale Pint'), ('Beer', 'Peroni Nastro Azzurro Pint'), ('Beer', 'Asahi Super Dry Pint'), ('Beer', 'Lucky Saint 0.5% Bottle'), ('Beer', 'Guinness 0.0% Can'),
    ('Cocktails', 'Classic Espresso'), ('Cocktails', 'Classic Margarita'), ('Cocktails', 'Classic Negroni'), ('Cocktails', 'Aperol Spritz'), ('Cocktails', 'Sarti Spritz'), ('Cocktails', 'Old Fashioned'), ('Cocktails', 'Classic Bloody Mary'), ('Cocktails', 'Woodland Bloom'),
    ('Spirits', 'Grey Goose (25ml)'), ('Spirits', 'Bombay Sapphire (25ml)'), ('Spirits', 'Tanqueray (25ml)'), ('Spirits', 'Bacardi (25ml)'), ('Spirits', 'Havana Club Rum Especial (25ml)'), ('Spirits', 'Jack Daniels (25ml)'), ('Spirits', 'Jameson (25ml)'), ('Spirits', 'Espolon Blanc (25ml)'),
    ('Wine', 'Prosecco Terre del Doge (Bottle)'), ('Wine', 'Laure D''Echarmes Brut NV (Bottle)'), ('Wine', 'La Brouette Producteurs Plaimont IGP Comte, France (Bottle)'), ('Wine', 'Pinot Grigio Rose Marajo, Italy (Bottle)'), ('Wine', 'Merlot El Picador, Chile (Bottle)'), ('Wine', 'Rioja Marques Concordia, Spain (Bottle)'), ('Wine', 'Pinot Grigio Ca''Tesore Venize, Italy (Bottle)'), ('Wine', 'Horgelus Gros Manseng Sauvignon Blanc, France (Bottle)')
)
update public.market_products mp
set is_live = exists (
  select 1 from curated
  where curated.category = mp.category and curated.display_name = mp.display_name
),
priority = exists (
  select 1 from curated
  where curated.category = mp.category and curated.display_name = mp.display_name
),
updated_at = now()
from public.venues v
where v.id = mp.venue_id and v.slug = 'demo-venue';
