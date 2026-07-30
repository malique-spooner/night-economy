do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets where name = 'night_economy_scheduler_anon_key'
  ) then
    raise exception 'Create the night_economy_scheduler_anon_key Vault secret before installing the scheduler cron.';
  end if;
end
$$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'night-economy-service-scheduler-every-minute';

select cron.schedule(
  'night-economy-service-scheduler-every-minute',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://ghhfmsmmwyycuwauvppg.supabase.co/functions/v1/service-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey',
        (select decrypted_secret from vault.decrypted_secrets where name = 'night_economy_scheduler_anon_key'),
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'night_economy_scheduler_anon_key'),
        'x-night-economy-scheduler-secret',
        (select decrypted_secret from vault.decrypted_secrets where name = 'night_economy_scheduler_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $$
);
