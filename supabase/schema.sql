-- Cal AI Supabase schema. Run once in Supabase Dashboard -> SQL Editor.
-- Creates profiles, goals, food_logs with Row Level Security so each user
-- only sees their own rows. Requires Supabase Auth (email + Google).

-- 1. Profiles (1 row per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'User',
  age text default '',
  weight text default '',
  height text default '',
  created_at timestamptz default now()
);

-- 2. Goals (1 row per user, upserted)
create table if not exists public.goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calories int not null default 2000,
  protein int not null default 120,
  carbs int not null default 250,
  fat int not null default 60,
  updated_at timestamptz default now()
);

-- 3. Food logs (many rows per user)
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  serving_size text default 'Unknown',
  logged_at timestamptz not null default now(),
  created_at timestamptz default now()
);
create index if not exists food_logs_user_logged_idx on public.food_logs (user_id, logged_at desc);

-- 4. Enable RLS
alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.food_logs enable row level security;

-- 5. Policies (drop if re-running, then create)
drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users manage own goals" on public.goals;
create policy "Users manage own goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own food logs" on public.food_logs;
create policy "Users manage own food logs" on public.food_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. Weekly totals helper (used by /history instead of JS loops)
create or replace function public.weekly_calories(p_user uuid)
returns table (day date, calories numeric, protein numeric, carbs numeric, fat numeric)
language sql stable as $$
  select
    date_trunc('day', logged_at)::date as day,
    coalesce(sum(calories), 0),
    coalesce(sum(protein), 0),
    coalesce(sum(carbs), 0),
    coalesce(sum(fat), 0)
  from public.food_logs
  where user_id = p_user
    and logged_at >= date_trunc('day', now()) - interval '6 days'
  group by 1 order by 1;
$$;
