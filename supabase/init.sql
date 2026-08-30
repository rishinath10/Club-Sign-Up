-- Stars International Club Sign-Up: full schema for a fresh self-hosted
-- Supabase instance (e.g. Coolify's Supabase service).
--
-- Run this ONCE in Supabase Studio's SQL editor (or via psql) after the
-- self-hosted stack is up and healthy. It recreates everything the app
-- needs: tables, RLS policies, the capacity/duplicate safeguards, the
-- teacher login, and the default 15 clubs.
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
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  class text not null,
  club_id text not null references public.clubs(id) on delete cascade,
  club_name text not null,
  ts timestamptz not null default now()
);

create index if not exists submissions_club_id_idx on public.submissions (club_id);

drop index if exists public.submissions_name_unique_idx;
create unique index submissions_name_unique_idx
  on public.submissions (lower(first_name), lower(last_name));

alter table public.clubs enable row level security;
alter table public.submissions enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

drop policy if exists "clubs_public_read" on public.clubs;
create policy "clubs_public_read" on public.clubs
  for select to anon, authenticated using (true);

drop policy if exists "clubs_teacher_write" on public.clubs;
create policy "clubs_teacher_write" on public.clubs
  for all to authenticated using (true) with check (true);

-- Students can submit sign-ups, but cannot read the raw submissions table
-- (that would expose every other student's name/class to anyone with
-- devtools). Reading happens only through submit_signup / check_name_taken.
drop policy if exists "submissions_public_insert" on public.submissions;
create policy "submissions_public_insert" on public.submissions
  for insert to anon, authenticated with check (true);

drop policy if exists "submissions_teacher_read" on public.submissions;
create policy "submissions_teacher_read" on public.submissions
  for select to authenticated using (true);

drop policy if exists "submissions_teacher_update" on public.submissions;
create policy "submissions_teacher_update" on public.submissions
  for update to authenticated using (true) with check (true);

drop policy if exists "submissions_teacher_delete" on public.submissions;
create policy "submissions_teacher_delete" on public.submissions
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Public, privacy-safe seat counts (no student names exposed)
-- ---------------------------------------------------------------------------

create or replace view public.club_seat_counts as
  select club_id, count(*)::int as taken
  from public.submissions
  group by club_id;

alter view public.club_seat_counts set (security_invoker = on);
grant select on public.club_seat_counts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Duplicate-name pre-check (used by the form for a friendly message before
-- attempting the real insert; the unique index above is the real guard)
-- ---------------------------------------------------------------------------

drop function if exists public.check_name_taken(text);
create or replace function public.check_name_taken(p_first_name text, p_last_name text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.submissions
    where lower(first_name) = lower(p_first_name) and lower(last_name) = lower(p_last_name)
  );
$$;

grant execute on function public.check_name_taken(text, text) to anon, authenticated;

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

create or replace function public.submit_signup(
  p_first_name text,
  p_last_name text,
  p_class text,
  p_club_id text,
  p_club_name text
)
returns table (
  id uuid,
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
    insert into public.submissions (first_name, last_name, class, club_id, club_name)
    values (p_first_name, p_last_name, p_class, p_club_id, p_club_name)
    returning submissions.id, submissions.first_name, submissions.last_name,
              submissions.class, submissions.club_id, submissions.club_name, submissions.ts;
end;
$$;

grant execute on function public.submit_signup(text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Default clubs (only seeds if the table is empty, so this is safe to re-run)
-- ---------------------------------------------------------------------------

insert into public.clubs (id, name, capacity)
select * from (values
  ('arts-craft-club', 'Arts & Craft Club', 30),
  ('chess-club', 'Chess Club', 30),
  ('coding-club', 'Coding Club', 30),
  ('culinary-club', 'Culinary Club', 30),
  ('dance-club', 'Dance Club', 30),
  ('entrepreneurship-club', 'Entrepreneurship Club', 30),
  ('futsal-club', 'Futsal Club', 30),
  ('literary-society', 'Literary Society', 30),
  ('music-club', 'Music Club', 30),
  ('public-speaking-club', 'Public Speaking Club', 30),
  ('science-innovation-club', 'Science & Innovation Club', 30),
  ('scrabble-club', 'Scrabble Club', 30),
  ('table-tennis-club', 'Table Tennis Club', 30),
  ('taekwondo', 'Taekwondo', 30),
  ('theatre-performing-arts', 'Theatre & Performing Arts', 30)
) as v(id, name, capacity)
where not exists (select 1 from public.clubs);

-- ---------------------------------------------------------------------------
-- Teacher login account
--
-- IMPORTANT: change p_email / p_password below before running, or change the
-- password immediately after logging in. This block is idempotent - it does
-- nothing if that email already has an account.
-- ---------------------------------------------------------------------------

do $$
declare
  v_email text := 'pgaayathri96@gmail.com';
  v_password text := 'CHANGE_ME_BEFORE_RUNNING';
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

  raise notice 'Teacher account created for %.', v_email;
end $$;
