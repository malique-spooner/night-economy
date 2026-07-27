-- Fill each of the four active TV categories to its 12-drink first-page limit.
with additions(category, display_name) as (
  values
    ('Beer', 'Kronenbourg 1664 Pint'), ('Beer', 'BrewDog Punk IPA Pint'), ('Beer', 'Camden Pale Ale Pint'), ('Beer', 'Heineken 0.0% Bottle'),
    ('Cocktails', 'Pink Affair'), ('Cocktails', 'The 75th Peel'), ('Cocktails', 'Hugo Spritz'), ('Cocktails', 'How Spicy? Margarita'),
    ('Spirits', 'Hendrick''s (25ml)'), ('Spirits', 'Patron Silver (25ml)'), ('Spirits', 'Sailor Jerry (25ml)'), ('Spirits', 'Johnnie Walker Black (25ml)'),
    ('Wine', 'Cloud Island Sauvignon Blanc, NZ (Bottle)'), ('Wine', 'Malbec Chamuyo Mendoza Vineyards, Argentina (Bottle)'), ('Wine', 'Picpoul de Pinet Cuvee, France (Bottle)'), ('Wine', 'Whispering Angel Chateau d''Esclans Côtes de Provence (Bottle)')
)
update public.market_products mp
set is_live = true,
    updated_at = now()
from additions, public.venues v
where v.id = mp.venue_id
  and v.slug = 'demo-venue'
  and mp.category = additions.category
  and mp.display_name = additions.display_name;
