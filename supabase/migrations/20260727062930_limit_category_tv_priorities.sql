-- Each category has three operator-chosen feature cards on the TV.
-- The remaining live drinks appear below them in the category's market list.
with initial_priorities(category, display_name) as (
  values
    ('Beer', 'Guinness Pint'), ('Beer', 'Beavertown Neck Oil Pint'), ('Beer', 'Peroni Nastro Azzurro Pint'),
    ('Cocktails', 'Classic Espresso'), ('Cocktails', 'Classic Margarita'), ('Cocktails', 'Aperol Spritz'),
    ('Spirits', 'Grey Goose (25ml)'), ('Spirits', 'Tanqueray (25ml)'), ('Spirits', 'Jameson (25ml)'),
    ('Wine', 'Prosecco Terre del Doge (Bottle)'), ('Wine', 'Pinot Grigio Ca''Tesore Venize, Italy (Bottle)'), ('Wine', 'Rioja Marques Concordia, Spain (Bottle)')
)
update public.market_products mp
set priority = exists (
  select 1 from initial_priorities
  where initial_priorities.category = mp.category
    and initial_priorities.display_name = mp.display_name
),
updated_at = now()
from public.venues v
where v.id = mp.venue_id and v.slug = 'demo-venue';

create or replace function public.enforce_market_priority_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.priority and new.is_live and not new.is_sold_out and (
    select count(*)
    from public.market_products existing
    where existing.venue_id = new.venue_id
      and existing.category = new.category
      and existing.priority
      and existing.is_live
      and not existing.is_sold_out
      and existing.id is distinct from new.id
  ) >= 3 then
    raise exception 'A category can have at most three live priority drinks';
  end if;
  return new;
end;
$$;

drop trigger if exists market_products_priority_limit on public.market_products;
create trigger market_products_priority_limit
before insert or update of priority, category, is_live, is_sold_out on public.market_products
for each row
execute function public.enforce_market_priority_limit();
