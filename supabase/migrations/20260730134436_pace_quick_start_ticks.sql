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
    schedule := '10 seconds'
  );
end
$$;
