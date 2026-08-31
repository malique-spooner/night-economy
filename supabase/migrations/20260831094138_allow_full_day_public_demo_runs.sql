-- Standard venue rehearsals remain six hours in the simulator. The public
-- schedule is a full calendar day, so its persisted clock must allow 1,440.
alter table public.venue_test_services
  drop constraint if exists venue_test_services_simulated_minute_check;

alter table public.venue_test_services
  add constraint venue_test_services_simulated_minute_check
  check (simulated_minute between 0 and 1440);
