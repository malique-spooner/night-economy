-- Global is the development operator; Public Demo is deliberately no-sign-in.
-- Remove the old private Demo venue from Global's venue switcher.
delete from public.venue_members membership
using auth.users account
where membership.user_id = account.id
  and membership.venue_id = 'ven_demo'
  and account.email = 'global@nighteconomy.com';
