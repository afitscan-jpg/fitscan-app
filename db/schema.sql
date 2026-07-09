-- =====================================================================
-- FitScan — Supabase schema (v1)
-- Run this in the Supabase SQL editor (or as a migration).
--
-- Design notes:
--  * Deferred auth: enable Anonymous Sign-ins in Supabase Auth settings.
--    Logged-out users get a real (anonymous) auth.users row, so all the
--    per-user tables + RLS work immediately and convert cleanly when they
--    sign up. No separate device-id scheme needed.
--  * Per-user tables are locked down with RLS (a user sees only their rows).
--  * Shared tables (products, news_articles) are world-readable to signed-in
--    users; only your backend (service_role, which bypasses RLS) writes them.
--  * Maintenance/target calories are computed server-side by a trigger so the
--    number is always consistent with the profile.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type sex_type        as enum ('male','female','other');
create type goal_type       as enum ('lose','maintain','gain');
create type meal_type       as enum ('breakfast','lunch','dinner','snack');
create type log_source      as enum ('scan','search','ai_estimate','quick_add','manual');
create type verdict_type    as enum ('good','ok','avoid');
create type product_source  as enum ('off','ocr','manual');
create type news_category   as enum ('nutrition','fitness','safety','research','general');
create type sub_tier        as enum ('free','premium');
create type platform_type   as enum ('ios','android','web');

-- ---------- shared helper: keep updated_at fresh ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =====================================================================
-- profiles  (1:1 with auth.users)
-- =====================================================================
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  language          text not null default 'en',          -- 'en','hinglish','hi','ta',...
  units             text not null default 'metric',       -- 'metric' | 'imperial'

  -- inputs for the maintenance calc (Mifflin–St Jeor)
  sex               sex_type,
  birth_year        int check (birth_year between 1900 and extract(year from now())::int),
  height_cm         numeric(5,1) check (height_cm > 0),
  weight_kg         numeric(5,1) check (weight_kg > 0),
  activity_factor   numeric(4,3) not null default 1.375,   -- 1.2 / 1.375 / 1.55 / 1.725
  goal              goal_type not null default 'maintain',

  -- computed by trigger below (do not set from client)
  bmr_kcal          int,
  maintenance_kcal  int,
  daily_target_kcal int,

  water_goal_glasses int not null default 8,
  onboarded         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- compute BMR -> maintenance -> daily target whenever inputs change
create or replace function compute_targets()
returns trigger language plpgsql as $$
declare
  age   int;
  s     int;
  bmr   numeric;
  adj   int;
begin
  if new.sex is not null and new.birth_year is not null
     and new.height_cm is not null and new.weight_kg is not null then
    age := extract(year from now())::int - new.birth_year;
    s   := case new.sex when 'male' then 5 when 'female' then -161 else -78 end;
    bmr := 10*new.weight_kg + 6.25*new.height_cm - 5*age + s;
    adj := case new.goal when 'lose' then -400 when 'gain' then 300 else 0 end;

    new.bmr_kcal          := round(bmr);
    new.maintenance_kcal  := round(bmr * new.activity_factor / 10) * 10;  -- nearest 10
    new.daily_target_kcal := new.maintenance_kcal + adj;
  end if;
  return new;
end $$;

create trigger trg_profiles_targets
  before insert or update of sex, birth_year, height_cm, weight_kg, activity_factor, goal
  on profiles for each row execute function compute_targets();

create trigger trg_profiles_updated
  before update on profiles for each row execute function set_updated_at();

-- auto-create a profile row when a new auth user appears
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger trg_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- =====================================================================
-- products  (shared cache: Open Food Facts lookups + OCR submissions)
-- =====================================================================
create table products (
  id                 uuid primary key default gen_random_uuid(),
  barcode            text unique,                 -- null for OCR-only items
  name               text,
  brand              text,
  categories         text[] not null default '{}',
  is_beverage        boolean not null default false,
  image_url          text,
  nutriments         jsonb not null default '{}', -- per-100 values from OFF/OCR
  nova_group         int,
  additives          text[] not null default '{}',
  source             product_source not null default 'off',

  -- cached scoring-engine output (recomputed if the engine changes)
  score              int,
  grade              text,
  verdict            verdict_type,
  flags              text[] not null default '{}',

  contributed_to_off boolean not null default false,  -- submit-back tracking
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_products_barcode on products(barcode);
create trigger trg_products_updated
  before update on products for each row execute function set_updated_at();

-- =====================================================================
-- food_logs  (per-user diary entries: home food + scans)
-- =====================================================================
create table food_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  log_date     date not null default current_date,   -- user's local date (set by app)
  logged_at    timestamptz not null default now(),
  meal_type    meal_type not null default 'snack',
  source       log_source not null default 'manual',
  product_id   uuid references products(id),         -- set only for scans

  name         text not null,                        -- e.g. 'Dal, rice & sabzi' / 'Poha'
  quantity     numeric(8,2),
  unit         text,                                 -- 'g','ml','roti','bowl',...
  kcal         int    not null default 0,
  protein_g    numeric(6,1) not null default 0,
  carbs_g      numeric(6,1) not null default 0,
  fat_g        numeric(6,1) not null default 0,
  sugar_g      numeric(6,1) not null default 0,

  verdict      verdict_type,                          -- for scanned items
  ai_raw_input text,                                  -- the "2 roti, dal" text, if any
  created_at   timestamptz not null default now()
);
create index idx_food_logs_user_date on food_logs(user_id, log_date);

-- =====================================================================
-- water_logs  (per-user intake events)
-- =====================================================================
create table water_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  log_date   date not null default current_date,
  logged_at  timestamptz not null default now(),
  amount_ml  int not null default 250               -- one glass ≈ 250ml
);
create index idx_water_logs_user_date on water_logs(user_id, log_date);

-- =====================================================================
-- reminders  (per-user notification schedules: water, log nudges, ...)
-- =====================================================================
create table reminders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,                          -- 'water','log','weigh_in',...
  enabled    boolean not null default true,
  schedule   jsonb not null default '{}',            -- {interval_min:120,start:"09:00",end:"21:00"}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, type)
);
create trigger trg_reminders_updated
  before update on reminders for each row execute function set_updated_at();

-- =====================================================================
-- push_tokens  (Expo/FCM tokens; user_id nullable so anon devices register,
-- then link on sign-in — same pattern as AIBrief24)
-- =====================================================================
create table push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  expo_token text not null unique,
  platform   platform_type,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_push_tokens_user on push_tokens(user_id);
create trigger trg_push_tokens_updated
  before update on push_tokens for each row execute function set_updated_at();

-- =====================================================================
-- news_articles  (shared feed from your ingestion pipeline)
-- =====================================================================
create table news_articles (
  id              uuid primary key default gen_random_uuid(),
  source          text not null,
  source_verified boolean not null default false,    -- credible-source whitelist flag
  url             text not null unique,
  title           text not null,
  summary         text,                               -- AI summary (gpt-4o-mini)
  category        news_category not null default 'general',
  image_url       text,
  language        text not null default 'en',
  published_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index idx_news_category_pub on news_articles(category, published_at desc);

-- per-user saved articles
create table news_bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references news_articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, article_id)
);

-- =====================================================================
-- subscriptions  (free / premium)
-- =====================================================================
create table subscriptions (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  tier               sub_tier not null default 'free',
  status             text,                            -- 'active','canceled','trialing',...
  provider           text,                            -- 'play','app_store','stripe'
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_subscriptions_updated
  before update on subscriptions for each row execute function set_updated_at();

-- =====================================================================
-- daily_intake  (view: totals per user per day — drives the Home ring)
-- =====================================================================
-- security_invoker => the view runs as the querying user, so food_logs RLS
-- applies and each user sees only their own totals (default views bypass RLS).
create view daily_intake with (security_invoker = true) as
select
  user_id,
  log_date,
  sum(kcal)::int        as kcal,
  sum(protein_g)        as protein_g,
  sum(carbs_g)          as carbs_g,
  sum(fat_g)            as fat_g,
  sum(sugar_g)          as sugar_g,
  count(*)              as items
from food_logs
group by user_id, log_date;

-- =====================================================================
-- Row Level Security
-- =====================================================================

-- per-user tables: each user touches only their own rows
alter table profiles       enable row level security;
alter table food_logs      enable row level security;
alter table water_logs     enable row level security;
alter table reminders      enable row level security;
alter table push_tokens    enable row level security;
alter table news_bookmarks enable row level security;
alter table subscriptions  enable row level security;

create policy "own profile"        on profiles       for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own food_logs"      on food_logs      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own water_logs"     on water_logs     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own reminders"      on reminders      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own bookmarks"      on news_bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subscription"   on subscriptions  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- push_tokens: allow null-owner (anon) inserts, and ownership once linked
create policy "push read own"   on push_tokens for select using (user_id is null or auth.uid() = user_id);
create policy "push insert"     on push_tokens for insert with check (user_id is null or auth.uid() = user_id);
create policy "push update own" on push_tokens for update using (user_id is null or auth.uid() = user_id) with check (auth.uid() = user_id);

-- shared tables: signed-in users read; writes happen via service_role (bypasses RLS)
alter table products      enable row level security;
alter table news_articles enable row level security;
create policy "products readable" on products      for select using (auth.role() = 'authenticated');
create policy "news readable"     on news_articles for select using (auth.role() = 'authenticated');

-- subscriptions row is created by the backend on first sign-in (service_role);
-- profiles row is created automatically by trg_auth_user_created.
