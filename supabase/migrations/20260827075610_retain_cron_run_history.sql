-- pg_cron records an execution-history row every time a scheduled job runs.
-- Retain a short diagnostic window, rather than keeping this internal log
-- indefinitely and exhausting the database quota.
delete from cron.job_run_details
where end_time < now() - interval '7 days';

select cron.unschedule(jobid)
from cron.job
where jobname = 'night-economy-prune-cron-run-history-daily';

select cron.schedule(
  'night-economy-prune-cron-run-history-daily',
  '17 4 * * *',
  $$
    delete from cron.job_run_details
    where end_time < now() - interval '7 days';
  $$
);
