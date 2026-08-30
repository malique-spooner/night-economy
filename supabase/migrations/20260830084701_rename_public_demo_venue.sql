-- Keep the visitor-facing venue name short in the Portal, TV and menu.
update public.venues
set name = 'Public Demo'
where id = 'ven_public_demo'
  and is_public_demo = true;
