-- A stopped rehearsal must never leave public TV/mobile screens marked open.
update public.venues venue
set market_live = false,
    updated_at = now()
where market_live = true
  and exists (
    select 1
    from public.venue_test_services service
    where service.venue_id = venue.id
      and service.status <> 'running'
  );
