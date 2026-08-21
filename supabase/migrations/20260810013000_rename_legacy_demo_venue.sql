-- Keep the legacy demo profile neutral; it is used only as a development fallback.
update public.venues
set name = 'Night Economy Demo'
where slug = 'demo-venue'
  and name = 'The Last Judgment';
