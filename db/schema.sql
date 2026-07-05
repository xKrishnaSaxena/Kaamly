-- Kaamly — Phase 0 schema
-- Apply in Supabase: SQL Editor -> paste -> Run.
-- (Locally: psql "$DATABASE_URL" -f db/schema.sql)

create extension if not exists postgis;
-- gen_random_uuid() lives in pgcrypto; on Supabase it's already available.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
create table if not exists users (
    id             uuid primary key default gen_random_uuid(),
    phone          varchar(20) unique not null,
    name           varchar(120),
    role           varchar(16) not null default 'worker'
                   check (role in ('worker','consumer','both')),
    preferred_lang varchar(8)  not null default 'hi',
    created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
create table if not exists worker_profiles (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null unique references users(id) on delete cascade,
    skills          text[] not null default '{}',
    bio             text,
    location        geography(Point, 4326),
    available_until timestamptz,
    is_available    boolean not null default false,
    rating_avg      numeric(3,2) not null default 0,
    rating_count    integer not null default 0
);

-- radius search on available workers uses this spatial index
create index if not exists worker_profiles_location_gix
    on worker_profiles using gist (location);
create index if not exists worker_profiles_available_idx
    on worker_profiles (is_available);

-- ---------------------------------------------------------------------------
create table if not exists jobs (
    id            uuid primary key default gen_random_uuid(),
    consumer_id   uuid not null references users(id) on delete cascade,
    category      varchar(48) not null,
    title         varchar(160),
    description   text,
    location      geography(Point, 4326) not null,
    urgency       varchar(16) not null default 'scheduled'
                  check (urgency in ('urgent','scheduled')),
    status        varchar(16) not null default 'open'
                  check (status in ('open','matched','in_progress','done','cancelled')),
    budget_amount numeric(10,2),
    created_at    timestamptz not null default now()
);

create index if not exists jobs_location_gix on jobs using gist (location);
create index if not exists jobs_status_idx   on jobs (status);

-- ---------------------------------------------------------------------------
create table if not exists matches (
    id         uuid primary key default gen_random_uuid(),
    job_id     uuid not null references jobs(id)  on delete cascade,
    worker_id  uuid not null references users(id) on delete cascade,
    status     varchar(16) not null default 'offered'
               check (status in ('offered','accepted','declined','expired')),
    created_at timestamptz not null default now(),
    unique (job_id, worker_id)
);

-- ---------------------------------------------------------------------------
create table if not exists ratings (
    id         uuid primary key default gen_random_uuid(),
    job_id     uuid not null references jobs(id)  on delete cascade,
    rater_id   uuid not null references users(id) on delete cascade,
    ratee_id   uuid not null references users(id) on delete cascade,
    stars      integer not null check (stars between 1 and 5),
    comment    text,
    created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Phase 1 preview: find available workers within :radius_m metres of a point,
-- nearest first. Kept here as documentation of the core matching query.
--
--   select wp.user_id, u.name, wp.skills,
--          st_distance(wp.location, st_point(:lng, :lat)::geography) as metres
--   from worker_profiles wp
--   join users u on u.id = wp.user_id
--   where wp.is_available
--     and (wp.available_until is null or wp.available_until > now())
--     and st_dwithin(wp.location, st_point(:lng, :lat)::geography, :radius_m)
--   order by metres
--   limit 3;
