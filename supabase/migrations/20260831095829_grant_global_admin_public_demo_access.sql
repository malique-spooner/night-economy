-- Public Demo was created after the Global account received its original
-- development memberships. Give every platform admin full operator access to
-- this venue, while the public /public-demo route remains read-only.
insert into public.venue_members (venue_id, user_id, role)
select venue.id, admin.user_id, 'owner'
from public.venues venue
cross join public.platform_admins admin
where venue.slug = 'public-demo'
on conflict (venue_id, user_id) do update set role = excluded.role;
