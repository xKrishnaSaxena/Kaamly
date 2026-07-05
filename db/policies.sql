-- Kaamly — Row Level Security lockdown
-- Apply in Supabase SQL Editor ("without RLS" / postgres role), or via
--   psql "$DATABASE_URL" -f db/policies.sql
-- Safe to re-run (idempotent).
--
-- MODEL: the FastAPI backend connects as the privileged `postgres` role and is
-- the SOLE gatekeeper. Table owners bypass RLS, so the backend keeps full
-- access. Enabling RLS with NO permissive policies means Supabase's public
-- auto-API (the `anon` / `authenticated` keys) can read/write NOTHING —
-- closing the "anyone with the anon key can dump your tables" hole.
--
-- Do NOT add `force row level security` here: that would subject the owner
-- (the backend) to RLS too and break it. `service_role` keeps its bypass.

alter table users           enable row level security;
alter table worker_profiles enable row level security;
alter table jobs            enable row level security;
alter table matches         enable row level security;
alter table ratings         enable row level security;

-- ---------------------------------------------------------------------------
-- FUTURE (inactive): if/when the PWA talks to Supabase directly using Supabase
-- Auth instead of going through FastAPI, uncomment and adapt policies like the
-- ones below. They assume the app's `users.id` equals the Supabase Auth user id
-- (auth.uid()); wire that mapping first. Until then, keep these commented so the
-- public API stays fully closed.
--
-- -- Consumers browse available workers for matching:
-- create policy "read available workers" on worker_profiles
--   for select to authenticated
--   using ( is_available = true );
--
-- -- A worker manages only their own profile:
-- create policy "own profile write" on worker_profiles
--   for all to authenticated
--   using ( auth.uid() = user_id )
--   with check ( auth.uid() = user_id );
--
-- -- A consumer sees and manages only their own jobs:
-- create policy "own jobs" on jobs
--   for all to authenticated
--   using ( auth.uid() = consumer_id )
--   with check ( auth.uid() = consumer_id );
--
-- -- Either party in a match can read it:
-- create policy "read own matches" on matches
--   for select to authenticated
--   using ( auth.uid() = worker_id
--           or auth.uid() = (select consumer_id from jobs where jobs.id = matches.job_id) );
--
-- -- Ratings are publicly readable but only the rater can write theirs:
-- create policy "read ratings" on ratings for select to authenticated using ( true );
-- create policy "write own ratings" on ratings
--   for insert to authenticated with check ( auth.uid() = rater_id );
