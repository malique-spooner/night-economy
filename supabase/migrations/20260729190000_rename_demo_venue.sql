-- The original venue is no longer a demo. Keep its stable internal ID and URL
-- for existing links, but use its real customer-facing name everywhere.

update public.venues
set name = 'The Last Judgment'
where id = 'ven_demo';
