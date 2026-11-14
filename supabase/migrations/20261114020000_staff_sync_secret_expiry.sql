-- The staff sync has its own Microsoft client secret ("sync" on the app
-- registration). Track its expiry next to the sign-in secret so the same
-- 30 / 15 / 5 day reminders go out. If it lapses, sign-in keeps working but
-- the staff list stops following Microsoft 365 (Settings shows a warning).
--
-- AFTER RENEWING:
--   update public.credential_expirations
--      set expires_on = '<new date>', reminded_at = null
--    where name = 'Microsoft staff sync client secret';

insert into public.credential_expirations (name, renew_steps, expires_on)
values (
  'Microsoft staff sync client secret',
  E'1. Go to entra.microsoft.com > App registrations > "Sky''s Path Website Admin Sign-in" > Certificates & secrets.\n'
  || E'2. Click New client secret (24 months), description "sync", then copy its Value.\n'
  || E'3. In Supabase > Edge Functions > Secrets, replace the value of ENTRA_CLIENT_SECRET and Save.\n'
  || E'4. On skyspath.com/admin/settings, check that "Last checked against Microsoft 365" shows a time from the last minute or two, then delete the old "sync" secret in Entra.\n'
  || E'5. In the Supabase SQL editor, record the new date (see supabase/migrations/20261114020000_staff_sync_secret_expiry.sql).',
  date '2028-11-13'
)
on conflict (name) do nothing;
