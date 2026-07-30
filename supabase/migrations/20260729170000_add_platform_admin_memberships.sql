-- The Night Economy development account is the internal platform admin.
-- Venue-owned accounts remain limited to their own venue; this account can
-- switch between every current venue from the Portal.

insert into public.venue_members (venue_id, user_id, role)
select venues.id, users.id, 'owner'
from public.venues venues
join auth.users users on users.email = 'maliquetyresespooner+dev@gmail.com'
on conflict (venue_id, user_id) do update set role = excluded.role;
