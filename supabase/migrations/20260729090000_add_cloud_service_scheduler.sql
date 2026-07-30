-- A scheduled service is cloud-owned: it runs independently of the Portal,
-- TV, mobile display, or any venue computer.
alter table public.venue_test_services
  add column if not exists scheduled_slot_key text;

create index if not exists venue_test_services_scheduled_slot_key_idx
  on public.venue_test_services (scheduled_slot_key)
  where scheduled_slot_key is not null;

-- The older job only priced demo-venue. The service scheduler starts, ticks,
-- and ends every prepared venue according to its own weekly schedule.
select cron.unschedule(jobid)
from cron.job
where jobname = 'night-economy-market-cycle-every-2-minutes';

select cron.schedule(
  'night-economy-service-scheduler-every-minute',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://ghhfmsmmwyycuwauvppg.supabase.co/functions/v1/service-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-night-economy-scheduler-secret',
        (select decrypted_secret from vault.decrypted_secrets where name = 'night_economy_scheduler_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $$
);
