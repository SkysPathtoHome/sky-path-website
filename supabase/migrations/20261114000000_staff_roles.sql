-- Staff roles, decided by Microsoft 365 groups.
--
-- Until now every signed-in account was a full admin and accounts were
-- added and deleted by hand in Admin -> Settings. From here on:
--
--   * Who is staff, and at which level, is decided by two Microsoft 365
--     security groups: "Sky's Path Admins" and "Sky's Path Support".
--   * The sync-staff edge function reads those groups once a minute and
--     keeps public.staff matched to them (see
--     supabase/functions/sync-staff/index.ts).
--   * Every admin policy below now asks "is this person in public.staff?"
--     instead of "is this person signed in?". Removing someone from both
--     groups (or blocking their sign-in in Microsoft 365) takes their row
--     away, and their access goes with it on the very next request, even if
--     their browser is still signed in.
--   * Support can work dogs, success stories, events and submissions.
--     Only Admins can see Settings (the staff list and the renewal dates).
--
-- Nothing is managed from the website any more: there is no add, delete or
-- role button. All of it happens in Microsoft 365.

create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- The person's Microsoft 365 object id. Null only for the rows seeded
  -- below, until the first sync matches them by email.
  entra_oid text unique,
  email text not null,
  display_name text,
  role text not null check (role in ('admin', 'support')),
  last_sign_in_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- One row: when the Microsoft 365 check last ran and how it went.
create table if not exists public.staff_sync_state (
  id int primary key check (id = 1),
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_error text
);
insert into public.staff_sync_state (id) values (1) on conflict (id) do nothing;

-- Everyone who can sign in today is an admin today. Carry them over so
-- nobody loses access between this migration and the first sync; the sync
-- then moves or removes them according to the groups.
insert into public.staff (user_id, email, role)
select id, lower(email), 'admin'
from auth.users
where lower(email) like '%@skyspath.com'
on conflict (user_id) do nothing;

-- security definer: the policies on public.staff itself call these, and a
-- plain function would re-enter those same policies.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()));
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

alter table public.staff enable row level security;
alter table public.staff_sync_state enable row level security;

-- Each staff member can read their own row (that is how the admin pages
-- learn their role); Admins can read the whole list. Nobody writes from the
-- browser: only the sync function does, with the service role.
drop policy if exists "staff_read" on public.staff;
create policy "staff_read" on public.staff
  for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "staff_sync_state_admin_read" on public.staff_sync_state;
create policy "staff_sync_state_admin_read" on public.staff_sync_state
  for select
  to authenticated
  using ((select public.is_admin()));

-- Settings is Admins only.
alter policy "credential_expirations_admin_read" on public.credential_expirations
  using ((select public.is_admin()));

-- Everything else: any staff member (Admin or Support).
alter policy "dogs_admin_read_all" on public.dogs
  using ((select public.is_staff()));
alter policy "dogs_admin_write" on public.dogs
  with check ((select public.is_staff()));
alter policy "dogs_admin_update" on public.dogs
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
alter policy "dogs_admin_delete" on public.dogs
  using ((select public.is_staff()));

alter policy "dog_media_admin_all" on public.dog_media
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

alter policy "submissions_admin_all" on public.submissions
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

alter policy "events_admin_read_all" on public.events
  using ((select public.is_staff()));
alter policy "events_admin_write" on public.events
  with check ((select public.is_staff()));
alter policy "events_admin_update" on public.events
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
alter policy "events_admin_delete" on public.events
  using ((select public.is_staff()));

-- Photo and video uploads.
alter policy "dog_media_buckets_admin_write" on storage.objects
  with check (bucket_id in ('dog-photos', 'dog-videos') and (select public.is_staff()));
alter policy "dog_media_buckets_admin_update" on storage.objects
  using (bucket_id in ('dog-photos', 'dog-videos') and (select public.is_staff()))
  with check (bucket_id in ('dog-photos', 'dog-videos') and (select public.is_staff()));
alter policy "dog_media_buckets_admin_delete" on storage.objects
  using (bucket_id in ('dog-photos', 'dog-videos') and (select public.is_staff()));

alter policy "event_photos_admin_write" on storage.objects
  with check (bucket_id = 'event-photos' and (select public.is_staff()));
alter policy "event_photos_admin_update" on storage.objects
  using (bucket_id = 'event-photos' and (select public.is_staff()))
  with check (bucket_id = 'event-photos' and (select public.is_staff()));
alter policy "event_photos_admin_delete" on storage.objects
  using (bucket_id = 'event-photos' and (select public.is_staff()));

alter policy "media_buckets_admin_read" on storage.objects
  using (
    bucket_id in ('dog-photos', 'dog-videos', 'event-photos')
    and (select public.is_staff())
  );
