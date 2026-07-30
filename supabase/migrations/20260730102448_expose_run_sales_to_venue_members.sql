grant select on public.pos_sales_events to authenticated;

create index if not exists venue_members_user_venue_idx
  on public.venue_members (user_id, venue_id);

drop policy if exists "venue members can read run sales events" on public.pos_sales_events;
create policy "venue members can read run sales events"
  on public.pos_sales_events for select
  to authenticated
  using (
    run_id is not null
    and venue_id in (
      select vm.venue_id
      from public.venue_members vm
      where vm.user_id = (select auth.uid())
    )
  );

-- Repair services completed by the earlier automatic-completion path, which
-- ended the run but left the public market flag open.
update public.venues v
set market_live = false,
    updated_at = now()
where v.market_live = true
  and exists (
    select 1
    from public.venue_test_services service
    where service.venue_id = v.id
      and service.status = 'ended'
      and service.simulated_minute >= 360
  );
