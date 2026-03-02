-- Run this in the Supabase SQL editor.
-- Creates a DB-backed achievements system:
-- 1) Catalog table + seeded badges
-- 2) Per-user unlock table
-- 3) RPCs for idempotent unlock writes and user achievement status reads

begin;

-- 1) Badge catalog
create table if not exists public.achievement_badges (
  badge_id text,
  achievement_key text not null,
  milestone_value integer not null check (milestone_value > 0),
  milestone_label text not null,
  local_asset_path text,
  storage_bucket text,
  storage_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.achievement_badges
  add column if not exists badge_id text,
  add column if not exists achievement_key text,
  add column if not exists milestone_value integer,
  add column if not exists milestone_label text,
  add column if not exists local_asset_path text,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.achievement_badges
set badge_id = achievement_key || ':' || milestone_value::text
where badge_id is null
  and achievement_key is not null
  and milestone_value is not null;

update public.achievement_badges
set local_asset_path = 'assets/badges/' || storage_path
where local_asset_path is null
  and storage_path is not null;

create unique index if not exists achievement_badges_badge_id_uq
  on public.achievement_badges (badge_id);

create unique index if not exists achievement_badges_key_milestone_uq
  on public.achievement_badges (achievement_key, milestone_value);

with seed(achievement_key, milestone_value, milestone_label) as (
  values
    ('longest_current_streak', 2, '2 days'),
    ('longest_current_streak', 5, '5 days'),
    ('longest_current_streak', 7, '7 days'),
    ('longest_current_streak', 14, '14 days'),
    ('longest_current_streak', 30, '30 days'),
    ('longest_current_streak', 60, '60 days'),
    ('longest_current_streak', 90, '90 days'),
    ('longest_current_streak', 100, '100 days'),
    ('longest_current_streak', 180, '180 days'),
    ('longest_current_streak', 275, '275 days'),
    ('longest_current_streak', 365, '365 days'),
    ('longest_habit_streak', 2, '2 days'),
    ('longest_habit_streak', 5, '5 days'),
    ('longest_habit_streak', 7, '7 days'),
    ('longest_habit_streak', 14, '14 days'),
    ('longest_habit_streak', 30, '30 days'),
    ('longest_habit_streak', 60, '60 days'),
    ('longest_habit_streak', 90, '90 days'),
    ('longest_habit_streak', 100, '100 days'),
    ('longest_habit_streak', 180, '180 days'),
    ('longest_habit_streak', 275, '275 days'),
    ('longest_habit_streak', 365, '365 days'),
    ('total_habit_completions', 1, '1 habit completion'),
    ('total_habit_completions', 5, '5 habit completions'),
    ('total_habit_completions', 10, '10 habit completions'),
    ('total_habit_completions', 25, '25 habit completions'),
    ('total_habit_completions', 50, '50 habit completions'),
    ('total_habit_completions', 100, '100 habit completions'),
    ('total_habit_completions', 250, '250 habit completions'),
    ('total_habit_completions', 500, '500 habit completions'),
    ('total_habit_completions', 1000, '1000 habit completions'),
    ('total_habits_achieved', 1, '1 habit achieved'),
    ('total_habits_achieved', 3, '3 habits achieved'),
    ('total_habits_achieved', 5, '5 habits achieved'),
    ('total_habits_achieved', 10, '10 habits achieved'),
    ('total_habits_achieved', 25, '25 habits achieved'),
    ('total_habits_achieved', 50, '50 habits achieved'),
    ('total_habits_achieved', 75, '75 habits achieved'),
    ('total_habits_achieved', 100, '100 habits achieved'),
    ('account_age', 1, '1 month'),
    ('account_age', 3, '3 months'),
    ('account_age', 6, '6 months'),
    ('account_age', 9, '9 months'),
    ('account_age', 12, '1 year'),
    ('account_age', 24, '2 years'),
    ('account_age', 36, '3 years'),
    ('account_age', 48, '4 years'),
    ('account_age', 60, '5 years')
),
resolved_seed as (
  select
    s.achievement_key,
    s.milestone_value,
    s.milestone_label,
    case
      when s.achievement_key = 'longest_current_streak'
        then 'longest current streak/current' || s.milestone_value::text || '.png'
      when s.achievement_key = 'longest_habit_streak'
        then 'longest habit streak/habitstreak' || s.milestone_value::text || '.png'
      when s.achievement_key = 'total_habit_completions'
        then 'habits completed/completion' || s.milestone_value::text || '.png'
      when s.achievement_key = 'total_habits_achieved'
        then 'total habits achieved/totalhabits' || s.milestone_value::text || '.png'
      when s.achievement_key = 'account_age' and s.milestone_value = 12
        then 'account age/account age 1 year.png'
      when s.achievement_key = 'account_age' and s.milestone_value in (24, 36, 48, 60)
        then 'account age/account age ' || (s.milestone_value / 12)::text || ' years.png'
      when s.achievement_key = 'account_age'
        then 'account age/account age ' || s.milestone_value::text || ' months.png'
      else null
    end as derived_storage_path
  from seed s
)
insert into public.achievement_badges (
  badge_id,
  achievement_key,
  milestone_value,
  milestone_label,
  local_asset_path,
  storage_bucket,
  storage_path,
  is_active
)
select
  resolved_seed.achievement_key || ':' || resolved_seed.milestone_value::text as badge_id,
  resolved_seed.achievement_key,
  resolved_seed.milestone_value,
  resolved_seed.milestone_label,
  coalesce(
    existing.local_asset_path,
    case
      when existing.storage_path is not null then 'assets/badges/' || existing.storage_path
      when resolved_seed.derived_storage_path is not null
        then 'assets/badges/' || resolved_seed.derived_storage_path
      else 'assets/badges/default.png'
    end
  ) as local_asset_path,
  coalesce(existing.storage_bucket, 'achievement-badges') as storage_bucket,
  coalesce(existing.storage_path, resolved_seed.derived_storage_path) as storage_path,
  true as is_active
from resolved_seed
left join public.achievement_badges existing
  on existing.achievement_key = resolved_seed.achievement_key
 and existing.milestone_value = resolved_seed.milestone_value
on conflict (achievement_key, milestone_value)
do update
set
  badge_id = excluded.badge_id,
  milestone_label = excluded.milestone_label,
  local_asset_path = coalesce(excluded.local_asset_path, public.achievement_badges.local_asset_path),
  storage_bucket = coalesce(public.achievement_badges.storage_bucket, excluded.storage_bucket),
  storage_path = coalesce(public.achievement_badges.storage_path, excluded.storage_path),
  is_active = true,
  updated_at = now();

drop view if exists public.v_achievement_badges;
create view public.v_achievement_badges as
select
  b.badge_id,
  b.achievement_key,
  b.milestone_value,
  b.milestone_label,
  b.local_asset_path,
  b.storage_bucket,
  b.storage_path
from public.achievement_badges b
where coalesce(b.is_active, true) = true;

alter table public.achievement_badges enable row level security;

grant usage on schema public to authenticated;
grant select on public.achievement_badges to authenticated;
grant select on public.v_achievement_badges to authenticated;

drop policy if exists "achievement_badges_select_authenticated" on public.achievement_badges;
create policy "achievement_badges_select_authenticated"
  on public.achievement_badges
  for select
  to authenticated
  using (true);

-- 2) Per-user unlocks
create table if not exists public.user_achievement_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null,
  achievement_key text not null,
  milestone_value integer not null check (milestone_value > 0),
  unlocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, badge_id),
  constraint user_achievement_unlocks_badge_id_ck
    check (badge_id = achievement_key || ':' || milestone_value::text)
);

alter table public.user_achievement_unlocks
  add column if not exists user_id uuid,
  add column if not exists badge_id text,
  add column if not exists achievement_key text,
  add column if not exists milestone_value integer,
  add column if not exists unlocked_at timestamptz default now(),
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists user_achievement_unlocks_user_idx
  on public.user_achievement_unlocks (user_id, unlocked_at desc);

create index if not exists user_achievement_unlocks_key_milestone_idx
  on public.user_achievement_unlocks (achievement_key, milestone_value);

-- Ensure ON CONFLICT (user_id, badge_id) is valid even on pre-existing schemas.
delete from public.user_achievement_unlocks a
using public.user_achievement_unlocks b
where a.ctid < b.ctid
  and a.user_id is not distinct from b.user_id
  and a.badge_id is not distinct from b.badge_id;

create unique index if not exists user_achievement_unlocks_user_badge_uq
  on public.user_achievement_unlocks (user_id, badge_id);

alter table public.user_achievement_unlocks enable row level security;

grant select, insert, update, delete on public.user_achievement_unlocks to authenticated;

drop policy if exists "user_achievement_unlocks_select_own" on public.user_achievement_unlocks;
create policy "user_achievement_unlocks_select_own"
  on public.user_achievement_unlocks
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_achievement_unlocks_insert_own" on public.user_achievement_unlocks;
create policy "user_achievement_unlocks_insert_own"
  on public.user_achievement_unlocks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_achievement_unlocks_update_own" on public.user_achievement_unlocks;
create policy "user_achievement_unlocks_update_own"
  on public.user_achievement_unlocks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_achievement_unlocks_delete_own" on public.user_achievement_unlocks;
create policy "user_achievement_unlocks_delete_own"
  on public.user_achievement_unlocks
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Optional profile-level fallback mirror for unlock history.
-- This allows the app to keep an account-scoped unlock list even if
-- RPC/table routes are unavailable in older environments.
alter table if exists public.profiles
  add column if not exists achievement_unlocks jsonb not null default '[]'::jsonb;

-- 3) RPCs
drop function if exists public.unlock_achievement(text, integer);
create or replace function public.unlock_achievement(
  p_achievement_key text,
  p_milestone_value integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_badge_id text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_achievement_key is null or p_milestone_value is null or p_milestone_value <= 0 then
    raise exception 'Invalid achievement payload';
  end if;

  select b.badge_id
  into v_badge_id
  from public.achievement_badges b
  where b.achievement_key = p_achievement_key
    and b.milestone_value = p_milestone_value
    and coalesce(b.is_active, true) = true
  limit 1;

  if v_badge_id is null then
    raise exception 'Unknown or inactive achievement %:%', p_achievement_key, p_milestone_value;
  end if;

  insert into public.user_achievement_unlocks (
    user_id,
    badge_id,
    achievement_key,
    milestone_value
  )
  values (
    v_user_id,
    v_badge_id,
    p_achievement_key,
    p_milestone_value
  )
  on conflict (user_id, badge_id) do nothing;
end;
$$;

drop function if exists public.unlock_earned_achievements(jsonb);
create or replace function public.unlock_earned_achievements(
  p_unlocks jsonb default '[]'::jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_entry jsonb;
  v_achievement_key text;
  v_milestone_text text;
  v_milestone_value integer;
  v_badge_id text;
  v_inserted integer := 0;
  v_row_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_unlocks is null or jsonb_typeof(p_unlocks) <> 'array' then
    return 0;
  end if;

  for v_entry in
    select value
    from jsonb_array_elements(p_unlocks)
  loop
    v_achievement_key := nullif(trim(v_entry ->> 'achievement_key'), '');
    v_milestone_text := nullif(trim(v_entry ->> 'milestone_value'), '');
    if v_achievement_key is null or v_milestone_text is null then
      continue;
    end if;
    if v_milestone_text !~ '^\d+$' then
      continue;
    end if;

    v_milestone_value := v_milestone_text::integer;
    if v_milestone_value <= 0 then
      continue;
    end if;

    select b.badge_id
    into v_badge_id
    from public.achievement_badges b
    where b.achievement_key = v_achievement_key
      and b.milestone_value = v_milestone_value
      and coalesce(b.is_active, true) = true
    limit 1;

    if v_badge_id is null then
      continue;
    end if;

    insert into public.user_achievement_unlocks (
      user_id,
      badge_id,
      achievement_key,
      milestone_value
    )
    values (
      v_user_id,
      v_badge_id,
      v_achievement_key,
      v_milestone_value
    )
    on conflict (user_id, badge_id) do nothing;

    get diagnostics v_row_count = row_count;
    v_inserted := v_inserted + coalesce(v_row_count, 0);
  end loop;

  return v_inserted;
end;
$$;

drop function if exists public.get_my_achievement_status();
create or replace function public.get_my_achievement_status()
returns table (
  badge_id text,
  achievement_key text,
  milestone_value integer,
  milestone_label text,
  storage_bucket text,
  storage_path text,
  unlocked boolean,
  unlocked_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    b.badge_id,
    b.achievement_key,
    b.milestone_value,
    b.milestone_label,
    b.storage_bucket,
    b.storage_path,
    (u.user_id is not null) as unlocked,
    u.unlocked_at
  from public.achievement_badges b
  left join public.user_achievement_unlocks u
    on u.user_id = auth.uid()
   and u.badge_id = b.badge_id
  where coalesce(b.is_active, true) = true
  order by b.achievement_key, b.milestone_value;
$$;

revoke all on function public.unlock_achievement(text, integer) from public;
revoke all on function public.unlock_earned_achievements(jsonb) from public;
revoke all on function public.get_my_achievement_status() from public;

grant execute on function public.unlock_achievement(text, integer) to authenticated;
grant execute on function public.unlock_earned_achievements(jsonb) to authenticated;
grant execute on function public.get_my_achievement_status() to authenticated;

commit;
