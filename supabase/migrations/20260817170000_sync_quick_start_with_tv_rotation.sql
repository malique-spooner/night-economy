-- A quick-start five-minute market round now lasts fifteen real seconds.
-- Keep the scheduler on the same cadence so each tick publishes one price round
-- exactly when the TV rotates its category and story panel.
do $$
declare
  scheduler_job_id bigint;
begin
  select jobid
  into scheduler_job_id
  from cron.job
  where jobname = 'night-economy-service-scheduler-every-minute';

  if scheduler_job_id is null then
    raise exception 'Night Economy service scheduler cron is missing.';
  end if;

  perform cron.alter_job(
    job_id := scheduler_job_id,
    schedule := '15 seconds'
  );
end
$$;
