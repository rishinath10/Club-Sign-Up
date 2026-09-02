-- Stars International Club Sign-Up: full schema for a fresh self-hosted
-- Supabase instance (e.g. Coolify's Supabase service).
--
-- Run this ONCE in Supabase Studio's SQL editor (or via psql) after the
-- self-hosted stack is up and healthy. It recreates everything the app
-- needs: tables, RLS policies, the capacity/duplicate safeguards, the
-- teacher login, and the default Primary + Secondary club lists.
--
-- Safe to re-run: every statement is idempotent (drop-if-exists / create-or-replace).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.clubs (
  id text primary key,
  name text not null,
  capacity integer not null default 25,
  school_level text not null,
  description text,
  created_at timestamptz not null default now(),
  constraint clubs_school_level_check check (school_level in ('primary', 'secondary'))
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  school_level text not null,
  first_name text not null,
  last_name text not null,
  class text not null,
  club_id text not null references public.clubs(id) on delete cascade,
  club_name text not null,
  ts timestamptz not null default now(),
  constraint submissions_school_level_check check (school_level in ('primary', 'secondary'))
);

create index if not exists submissions_club_id_idx on public.submissions (club_id);

-- Duplicate-name blocking is scoped PER SECTION: a Primary student and a
-- Secondary student who happen to share a name are two different real
-- people and must not block each other.
drop index if exists public.submissions_name_unique_idx;
create unique index submissions_name_unique_idx
  on public.submissions (school_level, lower(first_name), lower(last_name));

alter table public.clubs enable row level security;
alter table public.submissions enable row level security;

-- ---------------------------------------------------------------------------
-- Teacher allowlist
--
-- Supabase allows public signup through the auth API by default. If every
-- policy below trusted "any authenticated user", anyone who noticed that and
-- self-registered would land full teacher access - read every student's
-- name and class, edit clubs, delete all submissions. The anon key is
-- necessarily public (it ships in the JS bundle), so "authenticated" alone
-- is not a real permission boundary. This table is the actual one.
-- ---------------------------------------------------------------------------

create table if not exists public.teachers (
  user_id uuid primary key,
  email text,
  created_at timestamptz not null default now()
);

alter table public.teachers enable row level security;
-- No policies on purpose: unreachable via the REST API, readable only by
-- the security-definer helper below.

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.teachers where user_id = auth.uid());
$$;

grant execute on function public.is_teacher() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

drop policy if exists "clubs_public_read" on public.clubs;
create policy "clubs_public_read" on public.clubs
  for select to anon, authenticated using (true);

drop policy if exists "clubs_teacher_write" on public.clubs;
create policy "clubs_teacher_write" on public.clubs
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- Students can submit sign-ups, but cannot read the raw submissions table
-- (that would expose every other student's name/class to anyone with
-- devtools). Reading happens only through submit_signup / check_name_taken.
drop policy if exists "submissions_public_insert" on public.submissions;
create policy "submissions_public_insert" on public.submissions
  for insert to anon, authenticated with check (true);

drop policy if exists "submissions_teacher_read" on public.submissions;
create policy "submissions_teacher_read" on public.submissions
  for select to authenticated using (public.is_teacher());

drop policy if exists "submissions_teacher_update" on public.submissions;
create policy "submissions_teacher_update" on public.submissions
  for update to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "submissions_teacher_delete" on public.submissions;
create policy "submissions_teacher_delete" on public.submissions
  for delete to authenticated using (public.is_teacher());

-- ---------------------------------------------------------------------------
-- Public, privacy-safe seat counts (no student names exposed)
--
-- security_invoker must stay OFF here: that's what lets this view aggregate
-- submissions on behalf of anonymous students, who otherwise have zero read
-- access to that table. Turning it on (the seemingly-more-locked-down
-- option) actually breaks the view instead - it runs as the caller, an
-- anonymous student can read nothing, and every club silently shows 0/N
-- taken regardless of how many students already signed up. Keyed by
-- club_id, which already implies a school level, so both levels' counts
-- can be fetched together safely.
-- ---------------------------------------------------------------------------

create or replace view public.club_seat_counts as
  select club_id, count(*)::int as taken
  from public.submissions
  group by club_id;

alter view public.club_seat_counts set (security_invoker = off);
grant select on public.club_seat_counts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Duplicate-name pre-check (used by the form for a friendly message before
-- attempting the real insert; the unique index above is the real guard)
-- ---------------------------------------------------------------------------

drop function if exists public.check_name_taken(text, text);
drop function if exists public.check_name_taken(text, text, text);
create or replace function public.check_name_taken(p_school_level text, p_first_name text, p_last_name text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.submissions
    where school_level = p_school_level
      and lower(first_name) = lower(p_first_name)
      and lower(last_name) = lower(p_last_name)
  );
$$;

grant execute on function public.check_name_taken(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Capacity enforcement (atomic - locks the club row so concurrent sign-ups
-- for the same club can never overbook it)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_club_capacity()
returns trigger
language plpgsql
as $$
declare
  v_capacity integer;
  v_taken integer;
begin
  select capacity into v_capacity from public.clubs where id = new.club_id for update;

  if v_capacity is null then
    raise exception 'CLUB_NOT_FOUND';
  end if;

  select count(*) into v_taken from public.submissions where club_id = new.club_id;
  if v_taken >= v_capacity then
    raise exception 'CLUB_FULL';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_club_capacity on public.submissions;
create trigger trg_enforce_club_capacity
before insert on public.submissions
for each row execute function public.enforce_club_capacity();

-- ---------------------------------------------------------------------------
-- submit_signup RPC - anonymous students have no SELECT permission on
-- submissions (that's what keeps other students' names private), so a plain
-- REST insert+select would fail to read the row back and PostgREST would
-- roll the whole insert back. This security-definer function inserts and
-- returns the row directly via SQL RETURNING, which isn't subject to that.
-- ---------------------------------------------------------------------------

drop function if exists public.submit_signup(text, text, text, text, text);
drop function if exists public.submit_signup(text, text, text, text, text, text);
create or replace function public.submit_signup(
  p_school_level text,
  p_first_name text,
  p_last_name text,
  p_class text,
  p_club_id text,
  p_club_name text
)
returns table (
  id uuid,
  school_level text,
  first_name text,
  last_name text,
  class text,
  club_id text,
  club_name text,
  ts timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    insert into public.submissions (school_level, first_name, last_name, class, club_id, club_name)
    values (p_school_level, p_first_name, p_last_name, p_class, p_club_id, p_club_name)
    returning submissions.id, submissions.school_level, submissions.first_name, submissions.last_name,
              submissions.class, submissions.club_id, submissions.club_name, submissions.ts;
end;
$$;

grant execute on function public.submit_signup(text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Default clubs (only seeds if the table is empty, so this is safe to re-run)
-- ---------------------------------------------------------------------------

insert into public.clubs (id, name, capacity, school_level)
select * from (values
  -- Primary School
  ('arts-craft-club', 'Arts & Craft Club', 30, 'primary'),
  ('chess-club', 'Chess Club', 30, 'primary'),
  ('coding-club', 'Coding Club', 30, 'primary'),
  ('culinary-club', 'Culinary Club', 25, 'primary'),
  ('dance-club', 'Dance Club', 30, 'primary'),
  ('entrepreneurship-club', 'Entrepreneurship Club', 30, 'primary'),
  ('futsal-club', 'Futsal Club', 35, 'primary'),
  ('literary-society', 'Literary Society', 30, 'primary'),
  ('music-club', 'Music Club', 30, 'primary'),
  ('public-speaking-club', 'Public Speaking Club', 30, 'primary'),
  ('science-innovation-club', 'Science & Innovation Club', 30, 'primary'),
  ('scrabble-club', 'Scrabble Club', 30, 'primary'),
  ('table-tennis-club', 'Table Tennis Club', 30, 'primary'),
  ('taekwondo', 'Taekwondo', 30, 'primary'),
  ('theatre-performing-arts', 'Theatre & Performing Arts', 30, 'primary'),
  -- Secondary School
  ('secondary-chess-club', 'Chess Club', 35, 'secondary'),
  ('secondary-coding-club', 'Coding Club', 25, 'secondary'),
  ('secondary-culinary-club', 'Culinary Club', 30, 'secondary'),
  ('secondary-entrepreneurship-club', 'Entrepreneurship Club', 30, 'secondary'),
  ('secondary-futsal-club', 'Futsal Club', 35, 'secondary'),
  ('secondary-interact-club', 'Interact Club', 30, 'secondary'),
  ('secondary-media-visual-arts-club', 'Media & Visual Arts Club', 30, 'secondary'),
  ('secondary-model-united-nations', 'Model United Nations', 30, 'secondary'),
  ('secondary-music-band', 'Music Band', 30, 'secondary'),
  ('secondary-photography-production', 'Photography & Production', 25, 'secondary'),
  ('secondary-ping-pong-club', 'Ping Pong Club', 25, 'secondary'),
  ('secondary-science-innovation-club', 'Science & Innovation Club', 25, 'secondary'),
  ('secondary-taekwondo-club', 'Taekwondo Club', 25, 'secondary'),
  ('secondary-youth-volunteer-club', 'Youth Volunteer & Community Service Club', 25, 'secondary')
) as v(id, name, capacity, school_level)
where not exists (select 1 from public.clubs);

-- ---------------------------------------------------------------------------
-- Teacher login account
--
-- IMPORTANT: change v_password below before running, or change the
-- password immediately after logging in. This block is idempotent - it does
-- nothing if that email already has an account.
-- ---------------------------------------------------------------------------

do $$
declare
  v_email text := 'pgaayathri96@gmail.com';
  v_password text := 'Admin123';
  v_user_id uuid;
begin
  if exists (select 1 from auth.users where email = v_email) then
    raise notice 'Teacher account for % already exists, skipping.', v_email;
    return;
  end if;

  v_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_user_id, jsonb_build_object('sub', v_user_id::text, 'email', v_email), 'email', v_user_id::text, now(), now(), now());

  insert into public.teachers (user_id, email) values (v_user_id, v_email)
  on conflict (user_id) do nothing;

  raise notice 'Teacher account created for %.', v_email;
end $$;

-- Belt-and-suspenders: if a teachers.user_id row somehow didn't get created
-- above (e.g. this script's teacher-creation block was skipped because the
-- account already existed from before this allowlist existed), backfill it
-- by email so access isn't silently lost.
insert into public.teachers (user_id, email)
select id, email from auth.users
where email = 'pgaayathri96@gmail.com'
on conflict (user_id) do nothing;
