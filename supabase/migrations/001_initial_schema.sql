-- =====================================================================
-- FitPulse — Migration 001: schema, RLS, server-side functions
-- Run once on a fresh Supabase project (SQL Editor → paste → Run).
--
-- Security model
--   * Every table has RLS enabled.
--   * Clients can only SELECT what RLS allows. Almost all writes go
--     through SECURITY DEFINER functions (RPCs) that verify auth.uid(),
--     ownership and admin status on the server.
--   * Column-level grants stop clients from touching role / ownership
--     columns even on their own rows.
--   * Templates (plans/days/exercises/meals) are separate from history
--     (daily_logs, workout_completions, meal_completions). History rows
--     snapshot the template data and use ON DELETE SET NULL, so editing
--     or deleting a plan never destroys past records.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public._arr(p jsonb)
returns jsonb language sql immutable as $$
  select case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end;
$$;

create or replace function public._valid_tz(p_tz text)
returns boolean language sql stable as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz);
$$;

-- ---------------------------------------------------------------------
-- 1. PROFILES
-- ---------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  username              text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name          text check (char_length(display_name) <= 60),
  bio                   text check (char_length(bio) <= 300),
  avatar_url            text,
  role                  text not null default 'user' check (role in ('user', 'admin')),
  timezone              text not null default 'UTC',
  preferred_units       text not null default 'metric' check (preferred_units in ('metric', 'imperial')),
  profile_visibility    text not null default 'public' check (profile_visibility in ('public', 'private')),
  show_stats            boolean not null default false,
  onboarding_completed  boolean not null default false,
  notify_workout        boolean not null default true,
  notify_meals          boolean not null default true,
  notify_water          boolean not null default false,
  notify_missed         boolean not null default true,
  browser_notifications boolean not null default false,
  water_goal_ml         integer not null default 2500 check (water_goal_ml between 0 and 10000),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_profiles_visibility on public.profiles(profile_visibility);

-- ---------------------------------------------------------------------
-- 2. WORKOUT TEMPLATES
-- ---------------------------------------------------------------------
create table public.workout_plans (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references public.profiles(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 100),
  description     text check (char_length(description) <= 2000),
  duration_days   integer not null default 7 check (duration_days in (5, 6, 7)),
  difficulty      text check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  category        text check (char_length(category) <= 50),
  equipment       text check (char_length(equipment) <= 200),
  visibility      text not null default 'private' check (visibility in ('private', 'public')),
  is_premade      boolean not null default false,
  source_plan_id  uuid references public.workout_plans(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint workout_plans_owner_required check (is_premade or owner_id is not null)
);
create index idx_workout_plans_owner on public.workout_plans(owner_id);
create index idx_workout_plans_public on public.workout_plans(visibility, is_premade);

create table public.workout_days (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.workout_plans(id) on delete cascade,
  weekday      integer not null check (weekday between 0 and 6),   -- 0 = Monday … 6 = Sunday
  title        text not null default '' check (char_length(title) <= 80),
  is_rest_day  boolean not null default false,
  sort_order   integer not null default 0,
  constraint workout_days_plan_weekday_key unique (plan_id, weekday)
);

create table public.workout_exercises (
  id              uuid primary key default gen_random_uuid(),
  workout_day_id  uuid not null references public.workout_days(id) on delete cascade,
  exercise_name   text not null check (char_length(exercise_name) between 1 and 100),
  sets            integer not null default 3 check (sets between 1 and 100),
  reps            integer not null default 10 check (reps between 1 and 1000),
  target_weight   numeric(7,2) check (target_weight >= 0),
  rest_seconds    integer check (rest_seconds between 0 and 3600),
  instructions    text check (char_length(instructions) <= 1000),
  notes           text check (char_length(notes) <= 1000),
  sort_order      integer not null default 0
);
create index idx_workout_exercises_day on public.workout_exercises(workout_day_id, sort_order);

-- ---------------------------------------------------------------------
-- 3. DIET TEMPLATES
-- ---------------------------------------------------------------------
create table public.diet_plans (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references public.profiles(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 100),
  description     text check (char_length(description) <= 2000),
  duration_days   integer not null default 7 check (duration_days in (5, 6, 7)),
  difficulty      text check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  category        text check (char_length(category) <= 50),
  visibility      text not null default 'private' check (visibility in ('private', 'public')),
  is_premade      boolean not null default false,
  source_plan_id  uuid references public.diet_plans(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint diet_plans_owner_required check (is_premade or owner_id is not null)
);
create index idx_diet_plans_owner on public.diet_plans(owner_id);
create index idx_diet_plans_public on public.diet_plans(visibility, is_premade);

create table public.diet_days (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.diet_plans(id) on delete cascade,
  weekday     integer not null check (weekday between 0 and 6),
  title       text not null default '' check (char_length(title) <= 80),
  sort_order  integer not null default 0,
  constraint diet_days_plan_weekday_key unique (plan_id, weekday)
);

create table public.diet_meals (
  id              uuid primary key default gen_random_uuid(),
  diet_day_id     uuid not null references public.diet_days(id) on delete cascade,
  meal_name       text not null check (char_length(meal_name) between 1 and 80),
  scheduled_time  time,
  notes           text check (char_length(notes) <= 1000),
  sort_order      integer not null default 0
);
create index idx_diet_meals_day on public.diet_meals(diet_day_id, sort_order);

create table public.meal_items (
  id             uuid primary key default gen_random_uuid(),
  meal_id        uuid not null references public.diet_meals(id) on delete cascade,
  food_name      text not null check (char_length(food_name) between 1 and 100),
  quantity       text check (char_length(quantity) <= 50),
  calories       numeric(7,1) check (calories >= 0),
  protein        numeric(6,1) check (protein >= 0),
  carbohydrates  numeric(6,1) check (carbohydrates >= 0),
  fats           numeric(6,1) check (fats >= 0),
  sort_order     integer not null default 0
);
create index idx_meal_items_meal on public.meal_items(meal_id, sort_order);

-- ---------------------------------------------------------------------
-- 4. ACTIVE PLAN (one row per user)
-- ---------------------------------------------------------------------
create table public.user_active_plans (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  workout_plan_id  uuid references public.workout_plans(id) on delete set null,
  diet_plan_id     uuid references public.diet_plans(id) on delete set null,
  workout_since    date,
  diet_since       date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. HISTORY (never overwritten by template edits)
-- ---------------------------------------------------------------------
-- One row per user per calendar date (in the user's timezone).
create table public.daily_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  log_date         date not null,
  weekday          integer not null check (weekday between 0 and 6),
  workout_plan_id  uuid references public.workout_plans(id) on delete set null,
  workout_title    text,
  workout_is_rest  boolean,          -- null = no active workout plan that day
  diet_plan_id     uuid references public.diet_plans(id) on delete set null,
  diet_title       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint daily_logs_user_date_key unique (user_id, log_date)
);

create table public.workout_completions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  plan_id         uuid references public.workout_plans(id) on delete set null,
  exercise_id     uuid references public.workout_exercises(id) on delete set null,
  scheduled_date  date not null,
  day_title       text,
  exercise_name   text not null,
  target_sets     integer,
  target_reps     integer,
  target_weight   numeric(7,2),
  sort_order      integer not null default 0,
  completed       boolean not null default false,
  completed_at    timestamptz,
  actual_sets     integer check (actual_sets between 0 and 100),
  actual_reps     integer check (actual_reps between 0 and 1000),
  actual_weight   numeric(7,2) check (actual_weight >= 0),
  notes           text check (char_length(notes) <= 1000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint workout_completions_unique unique (user_id, exercise_id, scheduled_date)
);
create index idx_workout_completions_user_date on public.workout_completions(user_id, scheduled_date);

create table public.meal_completions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  plan_id         uuid references public.diet_plans(id) on delete set null,
  meal_id         uuid references public.diet_meals(id) on delete set null,
  scheduled_date  date not null,
  meal_name       text not null,
  scheduled_time  time,
  items           jsonb not null default '[]'::jsonb,
  total_calories  numeric(8,1),
  total_protein   numeric(7,1),
  total_carbs     numeric(7,1),
  total_fats      numeric(7,1),
  sort_order      integer not null default 0,
  completed       boolean not null default false,
  completed_at    timestamptz,
  notes           text check (char_length(notes) <= 1000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint meal_completions_unique unique (user_id, meal_id, scheduled_date)
);
create index idx_meal_completions_user_date on public.meal_completions(user_id, scheduled_date);

create table public.water_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  logged_date  date not null,
  amount_ml    integer not null default 0 check (amount_ml between 0 and 20000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint water_logs_user_date_key unique (user_id, logged_date)
);

-- ---------------------------------------------------------------------
-- 6. updated_at triggers
-- ---------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_workout_plans_updated before update on public.workout_plans for each row execute function public.handle_updated_at();
create trigger trg_diet_plans_updated    before update on public.diet_plans    for each row execute function public.handle_updated_at();
create trigger trg_active_plans_updated  before update on public.user_active_plans for each row execute function public.handle_updated_at();
create trigger trg_daily_logs_updated    before update on public.daily_logs    for each row execute function public.handle_updated_at();
create trigger trg_wc_updated            before update on public.workout_completions for each row execute function public.handle_updated_at();
create trigger trg_mc_updated            before update on public.meal_completions for each row execute function public.handle_updated_at();
create trigger trg_water_updated         before update on public.water_logs    for each row execute function public.handle_updated_at();

-- Profile guard: role can never be changed through the API; timezone must be valid.
create or replace function public.profile_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_jwt_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  if new.role is distinct from old.role and v_jwt_role in ('anon', 'authenticated') then
    raise exception 'Changing role is not permitted' using errcode = '42501';
  end if;
  if new.id <> old.id then
    raise exception 'Changing id is not permitted' using errcode = '42501';
  end if;
  if new.timezone is distinct from old.timezone and not public._valid_tz(new.timezone) then
    raise exception 'Invalid timezone: %', new.timezone using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger trg_profile_guard before update on public.profiles
  for each row execute function public.profile_guard();

-- Create profile automatically on sign-up. Never fails sign-up because of
-- a bad/duplicate username: falls back to a generated one.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_username text := regexp_replace(lower(coalesce(new.raw_user_meta_data ->> 'username', '')), '[^a-z0-9_]', '', 'g');
  v_tz       text := coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC');
  v_display  text := nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 60), '');
begin
  if v_username !~ '^[a-z0-9_]{3,20}$'
     or exists (select 1 from public.profiles where username = v_username) then
    v_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;
  if not public._valid_tz(v_tz) then
    v_tz := 'UTC';
  end if;
  insert into public.profiles (id, username, display_name, timezone)
  values (new.id, v_username, coalesce(v_display, v_username), v_tz);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 7. Permission helpers (SECURITY DEFINER so they can read profiles)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.can_view_workout_plan(p_plan_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.workout_plans p
    left join public.profiles o on o.id = p.owner_id
    where p.id = p_plan_id
      and (
        p.owner_id = auth.uid()
        or (p.is_premade and (p.visibility = 'public' or public.is_admin()))
        or (not p.is_premade and p.visibility = 'public' and o.profile_visibility = 'public')
      )
  );
$$;

create or replace function public.can_edit_workout_plan(p_plan_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workout_plans p
    where p.id = p_plan_id
      and ((not p.is_premade and p.owner_id = auth.uid()) or (p.is_premade and public.is_admin()))
  );
$$;

create or replace function public.can_view_diet_plan(p_plan_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.diet_plans p
    left join public.profiles o on o.id = p.owner_id
    where p.id = p_plan_id
      and (
        p.owner_id = auth.uid()
        or (p.is_premade and (p.visibility = 'public' or public.is_admin()))
        or (not p.is_premade and p.visibility = 'public' and o.profile_visibility = 'public')
      )
  );
$$;

create or replace function public.can_edit_diet_plan(p_plan_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.diet_plans p
    where p.id = p_plan_id
      and ((not p.is_premade and p.owner_id = auth.uid()) or (p.is_premade and public.is_admin()))
  );
$$;

create or replace function public._user_today(p_uid uuid)
returns date language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce((select timezone from public.profiles where id = p_uid), 'UTC'))::date;
$$;

-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.workout_plans       enable row level security;
alter table public.workout_days        enable row level security;
alter table public.workout_exercises   enable row level security;
alter table public.diet_plans          enable row level security;
alter table public.diet_days           enable row level security;
alter table public.diet_meals          enable row level security;
alter table public.meal_items          enable row level security;
alter table public.user_active_plans   enable row level security;
alter table public.daily_logs          enable row level security;
alter table public.workout_completions enable row level security;
alter table public.meal_completions    enable row level security;
alter table public.water_logs          enable row level security;

-- Profiles: full row only for its owner. Public data is exposed through
-- the public_profiles view and get_public_profile() (limited columns).
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Templates: readable when visible; writes only through RPCs, except
-- metadata/visibility updates (column-restricted below).
create policy workout_plans_select on public.workout_plans
  for select using (public.can_view_workout_plan(id));
create policy workout_plans_update on public.workout_plans
  for update to authenticated
  using (public.can_edit_workout_plan(id)) with check (public.can_edit_workout_plan(id));

create policy workout_days_select on public.workout_days
  for select using (public.can_view_workout_plan(plan_id));

create policy workout_exercises_select on public.workout_exercises
  for select using (
    public.can_view_workout_plan((select d.plan_id from public.workout_days d where d.id = workout_day_id))
  );

create policy diet_plans_select on public.diet_plans
  for select using (public.can_view_diet_plan(id));
create policy diet_plans_update on public.diet_plans
  for update to authenticated
  using (public.can_edit_diet_plan(id)) with check (public.can_edit_diet_plan(id));

create policy diet_days_select on public.diet_days
  for select using (public.can_view_diet_plan(plan_id));

create policy diet_meals_select on public.diet_meals
  for select using (
    public.can_view_diet_plan((select d.plan_id from public.diet_days d where d.id = diet_day_id))
  );

create policy meal_items_select on public.meal_items
  for select using (
    public.can_view_diet_plan((
      select d.plan_id from public.diet_meals m join public.diet_days d on d.id = m.diet_day_id
      where m.id = meal_id
    ))
  );

-- Private per-user data: owner can read; writes through RPCs only.
create policy active_plans_select_own on public.user_active_plans
  for select to authenticated using (user_id = auth.uid());
create policy daily_logs_select_own on public.daily_logs
  for select to authenticated using (user_id = auth.uid());
create policy workout_completions_select_own on public.workout_completions
  for select to authenticated using (user_id = auth.uid());
create policy meal_completions_select_own on public.meal_completions
  for select to authenticated using (user_id = auth.uid());
create policy water_logs_select_own on public.water_logs
  for select to authenticated using (user_id = auth.uid());

-- Table / column privileges (defence in depth on top of RLS)
revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;

grant update (username, display_name, bio, avatar_url, timezone, preferred_units,
              profile_visibility, show_stats, onboarding_completed, notify_workout,
              notify_meals, notify_water, notify_missed, browser_notifications, water_goal_ml)
  on public.profiles to authenticated;
grant update (name, description, visibility, difficulty, category, equipment)
  on public.workout_plans to authenticated;
grant update (name, description, visibility, difficulty, category)
  on public.diet_plans to authenticated;

-- Safe public projection of profiles (owned by postgres → bypasses RLS,
-- but only exposes non-sensitive columns of PUBLIC profiles).
create view public.public_profiles as
  select id, username, display_name, bio, avatar_url, created_at
  from public.profiles
  where profile_visibility = 'public';
grant select on public.public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. PLAN WRITE FUNCTIONS
-- ---------------------------------------------------------------------

-- Upsert a workout plan tree in place: existing day/exercise ids are kept
-- (so history links survive), new ones inserted, removed ones deleted.
create or replace function public._upsert_workout_plan(
  p_owner uuid, p_plan_id uuid, p_plan jsonb, p_is_premade boolean, p_source uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_plan_id   uuid := p_plan_id;
  v_dur       integer := coalesce((p_plan ->> 'duration_days')::int, 7);
  v_name      text := nullif(trim(p_plan ->> 'name'), '');
  d           jsonb;
  e           jsonb;
  v_day_id    uuid;
  v_ex_id     uuid;
  v_weekday   integer;
  v_rest      boolean;
  v_keep_days uuid[] := '{}';
  v_keep_ex   uuid[] := '{}';
  j           integer;
begin
  if v_name is null then raise exception 'Plan name is required' using errcode = '22023'; end if;
  if v_dur not in (5, 6, 7) then raise exception 'Duration must be 5, 6 or 7 days' using errcode = '22023'; end if;

  if v_plan_id is null then
    insert into public.workout_plans (owner_id, name, description, duration_days, difficulty, category,
                                      equipment, visibility, is_premade, source_plan_id)
    values (p_owner, v_name, nullif(p_plan ->> 'description', ''), v_dur, nullif(p_plan ->> 'difficulty', ''),
            nullif(p_plan ->> 'category', ''), nullif(p_plan ->> 'equipment', ''),
            coalesce(nullif(p_plan ->> 'visibility', ''), 'private'), p_is_premade, p_source)
    returning id into v_plan_id;
  else
    update public.workout_plans set
      name          = v_name,
      description   = nullif(p_plan ->> 'description', ''),
      duration_days = v_dur,
      difficulty    = nullif(p_plan ->> 'difficulty', ''),
      category      = nullif(p_plan ->> 'category', ''),
      equipment     = nullif(p_plan ->> 'equipment', ''),
      visibility    = coalesce(nullif(p_plan ->> 'visibility', ''), visibility)
    where id = v_plan_id;
  end if;

  for d in select * from jsonb_array_elements(public._arr(p_plan -> 'days')) loop
    v_weekday := (d ->> 'weekday')::int;
    continue when v_weekday is null or v_weekday < 0 or v_weekday >= v_dur;
    v_rest := coalesce((d ->> 'is_rest_day')::boolean, false);

    insert into public.workout_days (plan_id, weekday, title, is_rest_day, sort_order)
    values (v_plan_id, v_weekday, left(coalesce(d ->> 'title', ''), 80), v_rest, v_weekday)
    on conflict (plan_id, weekday) do update
      set title = excluded.title, is_rest_day = excluded.is_rest_day, sort_order = excluded.sort_order
    returning id into v_day_id;
    v_keep_days := v_keep_days || v_day_id;

    continue when v_rest;
    j := 0;
    for e in select * from jsonb_array_elements(public._arr(d -> 'exercises')) loop
      continue when nullif(trim(e ->> 'exercise_name'), '') is null;
      v_ex_id := nullif(e ->> 'id', '')::uuid;
      if v_ex_id is not null then
        update public.workout_exercises set
          workout_day_id = v_day_id,
          exercise_name  = trim(e ->> 'exercise_name'),
          sets           = coalesce((e ->> 'sets')::int, 3),
          reps           = coalesce((e ->> 'reps')::int, 10),
          target_weight  = nullif(e ->> 'target_weight', '')::numeric,
          rest_seconds   = nullif(e ->> 'rest_seconds', '')::int,
          instructions   = nullif(e ->> 'instructions', ''),
          notes          = nullif(e ->> 'notes', ''),
          sort_order     = j
        where id = v_ex_id
          and workout_day_id in (select id from public.workout_days where plan_id = v_plan_id);
        if not found then v_ex_id := null; end if;
      end if;
      if v_ex_id is null then
        insert into public.workout_exercises (workout_day_id, exercise_name, sets, reps, target_weight,
                                              rest_seconds, instructions, notes, sort_order)
        values (v_day_id, trim(e ->> 'exercise_name'), coalesce((e ->> 'sets')::int, 3),
                coalesce((e ->> 'reps')::int, 10), nullif(e ->> 'target_weight', '')::numeric,
                nullif(e ->> 'rest_seconds', '')::int, nullif(e ->> 'instructions', ''),
                nullif(e ->> 'notes', ''), j)
        returning id into v_ex_id;
      end if;
      v_keep_ex := v_keep_ex || v_ex_id;
      j := j + 1;
    end loop;
  end loop;

  delete from public.workout_exercises
   where workout_day_id in (select id from public.workout_days where plan_id = v_plan_id)
     and not (id = any (v_keep_ex));
  delete from public.workout_days
   where plan_id = v_plan_id and not (id = any (v_keep_days));

  return v_plan_id;
end $$;

create or replace function public._upsert_diet_plan(
  p_owner uuid, p_plan_id uuid, p_plan jsonb, p_is_premade boolean, p_source uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_plan_id    uuid := p_plan_id;
  v_dur        integer := coalesce((p_plan ->> 'duration_days')::int, 7);
  v_name       text := nullif(trim(p_plan ->> 'name'), '');
  d            jsonb;
  m            jsonb;
  it           jsonb;
  v_day_id     uuid;
  v_meal_id    uuid;
  v_weekday    integer;
  v_keep_days  uuid[] := '{}';
  v_keep_meals uuid[] := '{}';
  j            integer;
  k            integer;
begin
  if v_name is null then raise exception 'Plan name is required' using errcode = '22023'; end if;
  if v_dur not in (5, 6, 7) then raise exception 'Duration must be 5, 6 or 7 days' using errcode = '22023'; end if;

  if v_plan_id is null then
    insert into public.diet_plans (owner_id, name, description, duration_days, difficulty, category,
                                   visibility, is_premade, source_plan_id)
    values (p_owner, v_name, nullif(p_plan ->> 'description', ''), v_dur, nullif(p_plan ->> 'difficulty', ''),
            nullif(p_plan ->> 'category', ''), coalesce(nullif(p_plan ->> 'visibility', ''), 'private'),
            p_is_premade, p_source)
    returning id into v_plan_id;
  else
    update public.diet_plans set
      name          = v_name,
      description   = nullif(p_plan ->> 'description', ''),
      duration_days = v_dur,
      difficulty    = nullif(p_plan ->> 'difficulty', ''),
      category      = nullif(p_plan ->> 'category', ''),
      visibility    = coalesce(nullif(p_plan ->> 'visibility', ''), visibility)
    where id = v_plan_id;
  end if;

  for d in select * from jsonb_array_elements(public._arr(p_plan -> 'days')) loop
    v_weekday := (d ->> 'weekday')::int;
    continue when v_weekday is null or v_weekday < 0 or v_weekday >= v_dur;

    insert into public.diet_days (plan_id, weekday, title, sort_order)
    values (v_plan_id, v_weekday, left(coalesce(d ->> 'title', ''), 80), v_weekday)
    on conflict (plan_id, weekday) do update set title = excluded.title, sort_order = excluded.sort_order
    returning id into v_day_id;
    v_keep_days := v_keep_days || v_day_id;

    j := 0;
    for m in select * from jsonb_array_elements(public._arr(d -> 'meals')) loop
      continue when nullif(trim(m ->> 'meal_name'), '') is null;
      v_meal_id := nullif(m ->> 'id', '')::uuid;
      if v_meal_id is not null then
        update public.diet_meals set
          diet_day_id    = v_day_id,
          meal_name      = trim(m ->> 'meal_name'),
          scheduled_time = nullif(m ->> 'scheduled_time', '')::time,
          notes          = nullif(m ->> 'notes', ''),
          sort_order     = j
        where id = v_meal_id
          and diet_day_id in (select id from public.diet_days where plan_id = v_plan_id);
        if not found then v_meal_id := null; end if;
      end if;
      if v_meal_id is null then
        insert into public.diet_meals (diet_day_id, meal_name, scheduled_time, notes, sort_order)
        values (v_day_id, trim(m ->> 'meal_name'), nullif(m ->> 'scheduled_time', '')::time,
                nullif(m ->> 'notes', ''), j)
        returning id into v_meal_id;
      end if;
      v_keep_meals := v_keep_meals || v_meal_id;

      -- Food items have no history links: replace them wholesale.
      delete from public.meal_items where meal_id = v_meal_id;
      k := 0;
      for it in select * from jsonb_array_elements(public._arr(m -> 'items')) loop
        continue when nullif(trim(it ->> 'food_name'), '') is null;
        insert into public.meal_items (meal_id, food_name, quantity, calories, protein, carbohydrates, fats, sort_order)
        values (v_meal_id, trim(it ->> 'food_name'), nullif(it ->> 'quantity', ''),
                nullif(it ->> 'calories', '')::numeric, nullif(it ->> 'protein', '')::numeric,
                nullif(it ->> 'carbohydrates', '')::numeric, nullif(it ->> 'fats', '')::numeric, k);
        k := k + 1;
      end loop;
      j := j + 1;
    end loop;
  end loop;

  delete from public.diet_meals
   where diet_day_id in (select id from public.diet_days where plan_id = v_plan_id)
     and not (id = any (v_keep_meals));
  delete from public.diet_days
   where plan_id = v_plan_id and not (id = any (v_keep_days));

  return v_plan_id;
end $$;

-- JSON export of a plan tree (used for copying)
create or replace function public._workout_plan_json(p_plan_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', p.name, 'description', p.description, 'duration_days', p.duration_days,
    'difficulty', p.difficulty, 'category', p.category, 'equipment', p.equipment,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekday', d.weekday, 'title', d.title, 'is_rest_day', d.is_rest_day,
        'exercises', coalesce((
          select jsonb_agg(jsonb_build_object(
            'exercise_name', e.exercise_name, 'sets', e.sets, 'reps', e.reps,
            'target_weight', e.target_weight, 'rest_seconds', e.rest_seconds,
            'instructions', e.instructions, 'notes', e.notes) order by e.sort_order)
          from public.workout_exercises e where e.workout_day_id = d.id), '[]'::jsonb)
      ) order by d.weekday)
      from public.workout_days d where d.plan_id = p.id), '[]'::jsonb))
  from public.workout_plans p where p.id = p_plan_id;
$$;

create or replace function public._diet_plan_json(p_plan_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', p.name, 'description', p.description, 'duration_days', p.duration_days,
    'difficulty', p.difficulty, 'category', p.category,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekday', d.weekday, 'title', d.title,
        'meals', coalesce((
          select jsonb_agg(jsonb_build_object(
            'meal_name', m.meal_name, 'scheduled_time', m.scheduled_time, 'notes', m.notes,
            'items', coalesce((
              select jsonb_agg(jsonb_build_object(
                'food_name', i.food_name, 'quantity', i.quantity, 'calories', i.calories,
                'protein', i.protein, 'carbohydrates', i.carbohydrates, 'fats', i.fats) order by i.sort_order)
              from public.meal_items i where i.meal_id = m.id), '[]'::jsonb)
          ) order by m.sort_order)
          from public.diet_meals m where m.diet_day_id = d.id), '[]'::jsonb)
      ) order by d.weekday)
      from public.diet_days d where d.plan_id = p.id), '[]'::jsonb))
  from public.diet_plans p where p.id = p_plan_id;
$$;

-- ---------------------------------------------------------------------
-- 10. DAILY RECORD GENERATION
-- ---------------------------------------------------------------------
-- Initialise (or, for today, refresh) one day of history for a user from
-- the currently active plans. Completed rows are never modified.
create or replace function public._init_day(p_uid uuid, p_date date, p_refresh boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_weekday integer := extract(isodow from p_date)::int - 1;
  v_wplan   uuid;
  v_dplan   uuid;
  v_wday    uuid;
  v_wtitle  text;
  v_wrest   boolean;
  v_dday    uuid;
  v_dtitle  text;
begin
  if not p_refresh and exists (select 1 from public.daily_logs where user_id = p_uid and log_date = p_date) then
    return;
  end if;

  select workout_plan_id, diet_plan_id into v_wplan, v_dplan
  from public.user_active_plans where user_id = p_uid;

  if v_wplan is not null then
    select id, title, is_rest_day into v_wday, v_wtitle, v_wrest
    from public.workout_days where plan_id = v_wplan and weekday = v_weekday;
    if v_wday is null then
      v_wrest := true; v_wtitle := 'Rest Day';
    elsif not v_wrest and not exists (select 1 from public.workout_exercises where workout_day_id = v_wday) then
      v_wrest := true;
    end if;
  end if;

  if v_dplan is not null then
    select id, title into v_dday, v_dtitle
    from public.diet_days where plan_id = v_dplan and weekday = v_weekday;
  end if;

  insert into public.daily_logs as dl (user_id, log_date, weekday, workout_plan_id, workout_title,
                                       workout_is_rest, diet_plan_id, diet_title)
  values (p_uid, p_date, v_weekday, v_wplan, v_wtitle, v_wrest, v_dplan, v_dtitle)
  on conflict (user_id, log_date) do update set
    workout_plan_id = excluded.workout_plan_id, workout_title = excluded.workout_title,
    workout_is_rest = excluded.workout_is_rest, diet_plan_id = excluded.diet_plan_id,
    diet_title = excluded.diet_title;

  -- Drop untouched rows that are no longer part of this day's schedule.
  delete from public.workout_completions c
   where c.user_id = p_uid and c.scheduled_date = p_date and not c.completed
     and c.actual_sets is null and c.actual_reps is null and c.actual_weight is null
     and coalesce(c.notes, '') = ''
     and (v_wday is null or v_wrest or c.exercise_id is null
          or not exists (select 1 from public.workout_exercises e
                         where e.id = c.exercise_id and e.workout_day_id = v_wday));

  if v_wday is not null and not v_wrest then
    insert into public.workout_completions as wc (user_id, plan_id, exercise_id, scheduled_date, day_title,
                                                  exercise_name, target_sets, target_reps, target_weight, sort_order)
    select p_uid, v_wplan, e.id, p_date, v_wtitle, e.exercise_name, e.sets, e.reps, e.target_weight, e.sort_order
    from public.workout_exercises e where e.workout_day_id = v_wday
    on conflict (user_id, exercise_id, scheduled_date) do update set
      plan_id = excluded.plan_id, day_title = excluded.day_title, exercise_name = excluded.exercise_name,
      target_sets = excluded.target_sets, target_reps = excluded.target_reps,
      target_weight = excluded.target_weight, sort_order = excluded.sort_order
    where not wc.completed;
  end if;

  delete from public.meal_completions c
   where c.user_id = p_uid and c.scheduled_date = p_date and not c.completed
     and coalesce(c.notes, '') = ''
     and (v_dday is null or c.meal_id is null
          or not exists (select 1 from public.diet_meals m where m.id = c.meal_id and m.diet_day_id = v_dday));

  if v_dday is not null then
    insert into public.meal_completions as mc (user_id, plan_id, meal_id, scheduled_date, meal_name, scheduled_time,
                                               items, total_calories, total_protein, total_carbs, total_fats, sort_order)
    select p_uid, v_dplan, m.id, p_date, m.meal_name, m.scheduled_time,
           coalesce((select jsonb_agg(jsonb_build_object('food_name', i.food_name, 'quantity', i.quantity,
                       'calories', i.calories, 'protein', i.protein, 'carbohydrates', i.carbohydrates,
                       'fats', i.fats) order by i.sort_order)
                     from public.meal_items i where i.meal_id = m.id), '[]'::jsonb),
           (select sum(i.calories) from public.meal_items i where i.meal_id = m.id),
           (select sum(i.protein) from public.meal_items i where i.meal_id = m.id),
           (select sum(i.carbohydrates) from public.meal_items i where i.meal_id = m.id),
           (select sum(i.fats) from public.meal_items i where i.meal_id = m.id),
           m.sort_order
    from public.diet_meals m where m.diet_day_id = v_dday
    on conflict (user_id, meal_id, scheduled_date) do update set
      plan_id = excluded.plan_id, meal_name = excluded.meal_name, scheduled_time = excluded.scheduled_time,
      items = excluded.items, total_calories = excluded.total_calories, total_protein = excluded.total_protein,
      total_carbs = excluded.total_carbs, total_fats = excluded.total_fats, sort_order = excluded.sort_order
    where not mc.completed;
  end if;
end $$;

-- Called by the app on load. Backfills days missed since the last visit
-- (max 30) using the plan that was active, then refreshes today.
-- Returns today's date in the user's timezone.
create or replace function public.ensure_today()
returns date language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_today date;
  v_last  date;
  d       date;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  v_today := public._user_today(v_uid);
  select max(log_date) into v_last from public.daily_logs where user_id = v_uid and log_date < v_today;
  if v_last is not null then
    d := greatest(v_last + 1, v_today - 30);
    while d < v_today loop
      perform public._init_day(v_uid, d, false);
      d := d + 1;
    end loop;
  end if;
  perform public._init_day(v_uid, v_today, true);
  return v_today;
end $$;

-- ---------------------------------------------------------------------
-- 11. PUBLIC RPCs
-- ---------------------------------------------------------------------
create or replace function public.save_workout_plan(p_plan jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_id      uuid := nullif(p_plan ->> 'id', '')::uuid;
  v_premade boolean := coalesce((p_plan ->> 'is_premade')::boolean, false);
  v_row     public.workout_plans%rowtype;
  v_active  boolean;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  if v_id is null then
    if v_premade and not public.is_admin() then
      raise exception 'Only administrators can create premade plans' using errcode = '42501';
    end if;
    return public._upsert_workout_plan(v_uid, null, p_plan, v_premade, null);
  end if;

  select * into v_row from public.workout_plans where id = v_id for update;
  if not found or not public.can_edit_workout_plan(v_id) then
    raise exception 'Plan not found or not editable' using errcode = '42501';
  end if;

  select exists (select 1 from public.user_active_plans where user_id = v_uid and workout_plan_id = v_id) into v_active;
  if v_active then perform public.ensure_today(); end if;   -- lock history with the old schedule first

  perform public._upsert_workout_plan(v_row.owner_id, v_id, p_plan, v_row.is_premade, v_row.source_plan_id);

  if v_active then perform public._init_day(v_uid, public._user_today(v_uid), true); end if;
  return v_id;
end $$;

create or replace function public.save_diet_plan(p_plan jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_id      uuid := nullif(p_plan ->> 'id', '')::uuid;
  v_premade boolean := coalesce((p_plan ->> 'is_premade')::boolean, false);
  v_row     public.diet_plans%rowtype;
  v_active  boolean;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  if v_id is null then
    if v_premade and not public.is_admin() then
      raise exception 'Only administrators can create premade plans' using errcode = '42501';
    end if;
    return public._upsert_diet_plan(v_uid, null, p_plan, v_premade, null);
  end if;

  select * into v_row from public.diet_plans where id = v_id for update;
  if not found or not public.can_edit_diet_plan(v_id) then
    raise exception 'Plan not found or not editable' using errcode = '42501';
  end if;

  select exists (select 1 from public.user_active_plans where user_id = v_uid and diet_plan_id = v_id) into v_active;
  if v_active then perform public.ensure_today(); end if;

  perform public._upsert_diet_plan(v_row.owner_id, v_id, p_plan, v_row.is_premade, v_row.source_plan_id);

  if v_active then perform public._init_day(v_uid, public._user_today(v_uid), true); end if;
  return v_id;
end $$;

-- Copy any plan the caller can view into a new private plan they own.
create or replace function public.copy_workout_plan(p_source uuid, p_activate boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_json jsonb;
  v_src  public.workout_plans%rowtype;
  v_new  uuid;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if not public.can_view_workout_plan(p_source) then
    raise exception 'Plan not found' using errcode = '42501';
  end if;
  select * into v_src from public.workout_plans where id = p_source;
  v_json := public._workout_plan_json(p_source);
  v_json := v_json || jsonb_build_object(
    'visibility', 'private',
    'name', left(case when v_src.owner_id = v_uid then v_src.name || ' (Copy)' else v_src.name end, 100));
  v_new := public._upsert_workout_plan(v_uid, null, v_json, false, p_source);
  if p_activate then perform public.set_active_plan('workout', v_new); end if;
  return v_new;
end $$;

create or replace function public.copy_diet_plan(p_source uuid, p_activate boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_json jsonb;
  v_src  public.diet_plans%rowtype;
  v_new  uuid;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if not public.can_view_diet_plan(p_source) then
    raise exception 'Plan not found' using errcode = '42501';
  end if;
  select * into v_src from public.diet_plans where id = p_source;
  v_json := public._diet_plan_json(p_source);
  v_json := v_json || jsonb_build_object(
    'visibility', 'private',
    'name', left(case when v_src.owner_id = v_uid then v_src.name || ' (Copy)' else v_src.name end, 100));
  v_new := public._upsert_diet_plan(v_uid, null, v_json, false, p_source);
  if p_activate then perform public.set_active_plan('diet', v_new); end if;
  return v_new;
end $$;

-- Activate (or clear with null) the caller's workout or diet plan.
create or replace function public.set_active_plan(p_kind text, p_plan_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_today date;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_kind not in ('workout', 'diet') then raise exception 'Invalid plan kind' using errcode = '22023'; end if;

  if p_plan_id is not null then
    if p_kind = 'workout' and not exists (
      select 1 from public.workout_plans where id = p_plan_id and owner_id = v_uid and not is_premade) then
      raise exception 'You can only activate your own plans' using errcode = '42501';
    end if;
    if p_kind = 'diet' and not exists (
      select 1 from public.diet_plans where id = p_plan_id and owner_id = v_uid and not is_premade) then
      raise exception 'You can only activate your own plans' using errcode = '42501';
    end if;
  end if;

  v_today := public.ensure_today();   -- record past days with the previous plan first

  insert into public.user_active_plans as a (user_id, workout_plan_id, workout_since, diet_plan_id, diet_since)
  values (v_uid,
          case when p_kind = 'workout' then p_plan_id end, case when p_kind = 'workout' then v_today end,
          case when p_kind = 'diet' then p_plan_id end,    case when p_kind = 'diet' then v_today end)
  on conflict (user_id) do update set
    workout_plan_id = case when p_kind = 'workout' then excluded.workout_plan_id else a.workout_plan_id end,
    workout_since   = case when p_kind = 'workout' then excluded.workout_since   else a.workout_since end,
    diet_plan_id    = case when p_kind = 'diet' then excluded.diet_plan_id else a.diet_plan_id end,
    diet_since      = case when p_kind = 'diet' then excluded.diet_since   else a.diet_since end;

  perform public._init_day(v_uid, v_today, true);
end $$;

create or replace function public.delete_plan(p_kind text, p_plan_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_kind = 'workout' then
    if not public.can_edit_workout_plan(p_plan_id) then raise exception 'Not permitted' using errcode = '42501'; end if;
    if exists (select 1 from public.user_active_plans where user_id = v_uid and workout_plan_id = p_plan_id) then
      perform public.ensure_today();
    end if;
    delete from public.workout_plans where id = p_plan_id;
  elsif p_kind = 'diet' then
    if not public.can_edit_diet_plan(p_plan_id) then raise exception 'Not permitted' using errcode = '42501'; end if;
    if exists (select 1 from public.user_active_plans where user_id = v_uid and diet_plan_id = p_plan_id) then
      perform public.ensure_today();
    end if;
    delete from public.diet_plans where id = p_plan_id;
  else
    raise exception 'Invalid plan kind' using errcode = '22023';
  end if;
end $$;

-- Patch a workout completion row the caller owns (no future dates).
create or replace function public.update_workout_completion(p_id uuid, p_patch jsonb)
returns public.workout_completions language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.workout_completions;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  update public.workout_completions set
    completed     = case when p_patch ? 'completed' then coalesce((p_patch ->> 'completed')::boolean, false) else completed end,
    completed_at  = case when p_patch ? 'completed'
                         then case when coalesce((p_patch ->> 'completed')::boolean, false) then coalesce(completed_at, now()) end
                         else completed_at end,
    actual_sets   = case when p_patch ? 'actual_sets'   then nullif(p_patch ->> 'actual_sets', '')::int else actual_sets end,
    actual_reps   = case when p_patch ? 'actual_reps'   then nullif(p_patch ->> 'actual_reps', '')::int else actual_reps end,
    actual_weight = case when p_patch ? 'actual_weight' then nullif(p_patch ->> 'actual_weight', '')::numeric else actual_weight end,
    notes         = case when p_patch ? 'notes'         then nullif(left(p_patch ->> 'notes', 1000), '') else notes end
  where id = p_id and user_id = v_uid and scheduled_date <= public._user_today(v_uid)
  returning * into v_row;
  if v_row.id is null then raise exception 'Record not found' using errcode = '42501'; end if;
  return v_row;
end $$;

create or replace function public.update_meal_completion(p_id uuid, p_patch jsonb)
returns public.meal_completions language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.meal_completions;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  update public.meal_completions set
    completed    = case when p_patch ? 'completed' then coalesce((p_patch ->> 'completed')::boolean, false) else completed end,
    completed_at = case when p_patch ? 'completed'
                        then case when coalesce((p_patch ->> 'completed')::boolean, false) then coalesce(completed_at, now()) end
                        else completed_at end,
    notes        = case when p_patch ? 'notes' then nullif(left(p_patch ->> 'notes', 1000), '') else notes end
  where id = p_id and user_id = v_uid and scheduled_date <= public._user_today(v_uid)
  returning * into v_row;
  if v_row.id is null then raise exception 'Record not found' using errcode = '42501'; end if;
  return v_row;
end $$;

-- Add (or subtract) water for today; returns today's total.
create or replace function public.log_water(p_delta_ml integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_total integer;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_delta_ml is null or abs(p_delta_ml) > 5000 then raise exception 'Invalid amount' using errcode = '22023'; end if;
  insert into public.water_logs as w (user_id, logged_date, amount_ml)
  values (v_uid, public._user_today(v_uid), greatest(p_delta_ml, 0))
  on conflict (user_id, logged_date) do update
    set amount_ml = least(greatest(w.amount_ml + p_delta_ml, 0), 20000)
  returning amount_ml into v_total;
  return v_total;
end $$;

-- Username availability without revealing anything else (works for
-- private profiles too, so sign-up never collides).
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(p_username) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(p_username));
$$;

-- Search PUBLIC profiles by username / display name.
create or replace function public.search_profiles(p_query text)
returns table (username text, display_name text, avatar_url text, bio text)
language sql stable security definer set search_path = '' as $$
  select p.username, p.display_name, p.avatar_url, left(p.bio, 140)
  from public.profiles p
  where p.profile_visibility = 'public'
    and char_length(trim(coalesce(p_query, ''))) >= 2
    and (p.username like '%' || replace(replace(replace(lower(trim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
         or lower(p.display_name) like '%' || replace(replace(replace(lower(trim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') || '%')
  order by (p.username = lower(trim(p_query))) desc, p.username
  limit 20;
$$;

-- Public profile payload. Private and non-existent usernames return the
-- same NULL result (no enumeration).
create or replace function public.get_public_profile(p_username text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_p     public.profiles%rowtype;
  v_stats jsonb := null;
begin
  select * into v_p from public.profiles
  where username = lower(p_username) and (profile_visibility = 'public' or id = auth.uid());
  if not found then return null; end if;

  if v_p.show_stats then
    v_stats := jsonb_build_object(
      'workout_days_completed', (
        select count(*) from (
          select scheduled_date from public.workout_completions
          where user_id = v_p.id group by scheduled_date having bool_and(completed)) t),
      'meals_completed', (select count(*) from public.meal_completions where user_id = v_p.id and completed),
      'member_since', v_p.created_at);
  end if;

  return jsonb_build_object(
    'id', v_p.id, 'username', v_p.username, 'display_name', v_p.display_name, 'bio', v_p.bio,
    'avatar_url', v_p.avatar_url, 'created_at', v_p.created_at, 'stats', v_stats,
    'workout_plans', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name, 'description', w.description,
               'duration_days', w.duration_days, 'difficulty', w.difficulty, 'category', w.category) order by w.created_at desc)
      from public.workout_plans w where w.owner_id = v_p.id and w.visibility = 'public' and not w.is_premade), '[]'::jsonb),
    'diet_plans', coalesce((
      select jsonb_agg(jsonb_build_object('id', dp.id, 'name', dp.name, 'description', dp.description,
               'duration_days', dp.duration_days, 'difficulty', dp.difficulty, 'category', dp.category) order by dp.created_at desc)
      from public.diet_plans dp where dp.owner_id = v_p.id and dp.visibility = 'public' and not dp.is_premade), '[]'::jsonb));
end $$;

-- Recent personal records (heaviest weight beaten for an exercise).
create or replace function public.recent_personal_records(p_limit integer default 5)
returns table (exercise_name text, actual_weight numeric, previous_best numeric, scheduled_date date)
language sql stable security definer set search_path = '' as $$
  select t.exercise_name, t.actual_weight, t.prev_max, t.scheduled_date
  from (
    select c.exercise_name, c.actual_weight, c.scheduled_date,
           max(c.actual_weight) over (partition by lower(c.exercise_name)
                                      order by c.scheduled_date, c.completed_at
                                      rows between unbounded preceding and 1 preceding) as prev_max
    from public.workout_completions c
    where c.user_id = auth.uid() and c.completed and c.actual_weight is not null
  ) t
  where t.prev_max is not null and t.actual_weight > t.prev_max
  order by t.scheduled_date desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- Permanently delete the caller's account and all their data.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  -- (the client removes avatar files through the Storage API beforehand)
  delete from auth.users where id = v_uid;   -- cascades to profiles and all owned rows
end $$;

-- ---------------------------------------------------------------------
-- 12. FUNCTION PRIVILEGES
-- ---------------------------------------------------------------------
revoke execute on function public._upsert_workout_plan(uuid, uuid, jsonb, boolean, uuid) from public, anon, authenticated;
revoke execute on function public._upsert_diet_plan(uuid, uuid, jsonb, boolean, uuid)    from public, anon, authenticated;
revoke execute on function public._workout_plan_json(uuid) from public, anon, authenticated;
revoke execute on function public._diet_plan_json(uuid)    from public, anon, authenticated;
revoke execute on function public._init_day(uuid, date, boolean) from public, anon, authenticated;
revoke execute on function public._user_today(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.save_workout_plan(jsonb)             from public, anon;
revoke execute on function public.save_diet_plan(jsonb)                from public, anon;
revoke execute on function public.copy_workout_plan(uuid, boolean)     from public, anon;
revoke execute on function public.copy_diet_plan(uuid, boolean)        from public, anon;
revoke execute on function public.set_active_plan(text, uuid)          from public, anon;
revoke execute on function public.delete_plan(text, uuid)              from public, anon;
revoke execute on function public.update_workout_completion(uuid, jsonb) from public, anon;
revoke execute on function public.update_meal_completion(uuid, jsonb)  from public, anon;
revoke execute on function public.log_water(integer)                   from public, anon;
revoke execute on function public.ensure_today()                       from public, anon;
revoke execute on function public.recent_personal_records(integer)     from public, anon;
revoke execute on function public.delete_my_account()                  from public, anon;

grant execute on function public.save_workout_plan(jsonb)             to authenticated;
grant execute on function public.save_diet_plan(jsonb)                to authenticated;
grant execute on function public.copy_workout_plan(uuid, boolean)     to authenticated;
grant execute on function public.copy_diet_plan(uuid, boolean)        to authenticated;
grant execute on function public.set_active_plan(text, uuid)          to authenticated;
grant execute on function public.delete_plan(text, uuid)              to authenticated;
grant execute on function public.update_workout_completion(uuid, jsonb) to authenticated;
grant execute on function public.update_meal_completion(uuid, jsonb)  to authenticated;
grant execute on function public.log_water(integer)                   to authenticated;
grant execute on function public.ensure_today()                       to authenticated;
grant execute on function public.recent_personal_records(integer)     to authenticated;
grant execute on function public.delete_my_account()                  to authenticated;
grant execute on function public.username_available(text)  to anon, authenticated;
grant execute on function public.search_profiles(text)      to anon, authenticated;
grant execute on function public.get_public_profile(text)   to anon, authenticated;
grant execute on function public.is_admin()                 to anon, authenticated;

-- ---------------------------------------------------------------------
-- 13. AVATAR STORAGE (public bucket, users write only to their folder)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
