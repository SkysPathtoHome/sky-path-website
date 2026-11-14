-- Runs the Microsoft 365 staff check (the sync-staff edge function) once a
-- minute from inside the database, so a person removed from the staff
-- groups, or blocked in Microsoft 365, loses website access within a minute
-- whether or not anyone is using the admin pages.
--
-- The bearer value is the site's PUBLIC key -- the same one every visitor's
-- browser already receives. It only gets the request past the function
-- gateway; sync-staff takes no input and returns nothing about staff.
--
-- To stop the schedule:  select cron.unschedule('sync-staff');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobname) from cron.job where jobname in ('sync-staff', 'sync-staff-tidy');

select cron.schedule(
  'sync-staff',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://gggqscleapxeblhjflpd.supabase.co/functions/v1/sync-staff',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_-iErwDtQQN2526k-ayTKNQ_92PedARY'
    ),
    body := '{}'::jsonb
  );
  $job$
);

-- pg_cron keeps a row for every run; at one a minute that adds up.
select cron.schedule(
  'sync-staff-tidy',
  '17 9 * * *',
  $job$ delete from cron.job_run_details where end_time < now() - interval '2 days'; $job$
);
