-- Keep only the two active venues for the current product setup.
-- Every venue-owned record references venues with ON DELETE CASCADE, so this
-- removes only Development's catalogue, simulator data, runs, sales, and
-- memberships. It intentionally retains the Night Economy admin user.

delete from public.venues
where id = 'ven_development';
