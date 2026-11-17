-- SL Connect: Wanted Items + Team Up. Run once in Supabase -> SQL Editor. Safe to re-run.
create extension if not exists pgcrypto;

create table if not exists wanted_items(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null check(char_length(title) between 3 and 120),
  description text check(char_length(description)<=1500),
  min_budget numeric(14,2) check(min_budget>=0), max_budget numeric(14,2) check(max_budget>=0),
  category text, location text,
  status text not null default 'open' check(status in('open','matched','closed')),
  expires_at timestamptz, created_at timestamptz not null default now(),
  check(min_budget is null or max_budget is null or min_budget<=max_budget));
create index if not exists wanted_items_status on wanted_items(status,created_at desc);

create table if not exists wanted_offers(
  id uuid primary key default gen_random_uuid(),
  wanted_item_id uuid not null references wanted_items on delete cascade,
  seller_id uuid not null references auth.users on delete cascade,
  price numeric(14,2) check(price>=0), message text check(char_length(message)<=800),
  status text not null default 'pending' check(status in('pending','accepted','rejected')),
  created_at timestamptz not null default now());
create index if not exists wanted_offers_item on wanted_offers(wanted_item_id);

create table if not exists teams(
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references auth.users on delete cascade,
  name text not null check(char_length(name) between 3 and 80),
  description text check(char_length(description)<=1000), skills text, location text,
  availability text default 'available', status text not null default 'active',
  created_at timestamptz not null default now());

create table if not exists team_members(
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check(role in('leader','member')),
  status text not null default 'pending' check(status in('pending','invited','accepted','declined','removed')),
  created_at timestamptz not null default now(),
  unique(team_id,user_id));

alter table wanted_items enable row level security;
alter table wanted_offers enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;

create or replace function slc_team_leader(p_team uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from teams where id=p_team and leader_id=auth.uid()) $$;
create or replace function slc_wanted_owner(p_item uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from wanted_items where id=p_item and user_id=auth.uid()) $$;
create or replace function slc_wanted_open(p_item uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from wanted_items where id=p_item and status='open' and user_id<>auth.uid() and (expires_at is null or expires_at>now())) $$;

-- wanted items
drop policy if exists "wanted read" on wanted_items;
create policy "wanted read" on wanted_items for select using(true);
drop policy if exists "wanted insert" on wanted_items;
create policy "wanted insert" on wanted_items for insert with check(user_id=auth.uid());
drop policy if exists "wanted update own" on wanted_items;
create policy "wanted update own" on wanted_items for update using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "wanted delete" on wanted_items;
create policy "wanted delete" on wanted_items for delete using(user_id=auth.uid());

-- offers: visible only to the seller and the person who wants the item
drop policy if exists "offers read" on wanted_offers;
create policy "offers read" on wanted_offers for select using(seller_id=auth.uid() or slc_wanted_owner(wanted_item_id));
drop policy if exists "offers insert" on wanted_offers;
create policy "offers insert" on wanted_offers for insert with check(seller_id=auth.uid() and status='pending' and slc_wanted_open(wanted_item_id));
drop policy if exists "offers owner update" on wanted_offers;
create policy "offers owner update" on wanted_offers for update using(slc_wanted_owner(wanted_item_id)) with check(slc_wanted_owner(wanted_item_id));
drop policy if exists "offers delete own" on wanted_offers;
create policy "offers delete own" on wanted_offers for delete using(seller_id=auth.uid() and status='pending');

-- teams
drop policy if exists "teams read" on teams;
create policy "teams read" on teams for select using(true);
drop policy if exists "teams insert" on teams;
create policy "teams insert" on teams for insert with check(leader_id=auth.uid());
drop policy if exists "teams update" on teams;
create policy "teams update" on teams for update using(leader_id=auth.uid()) with check(leader_id=auth.uid());
drop policy if exists "teams delete" on teams;
create policy "teams delete" on teams for delete using(leader_id=auth.uid());

-- members: accepted members are public; pending/invited rows are seen by that person and the leader
drop policy if exists "members read" on team_members;
create policy "members read" on team_members for select using(status='accepted' or user_id=auth.uid() or slc_team_leader(team_id));
drop policy if exists "members insert" on team_members;
create policy "members insert" on team_members for insert with check(
  (user_id=auth.uid() and role='member' and status='pending')
  or (slc_team_leader(team_id) and user_id=auth.uid() and role='leader' and status='accepted')
  or (slc_team_leader(team_id) and role='member' and status='invited'));
drop policy if exists "members update" on team_members;
create policy "members update" on team_members for update
  using(slc_team_leader(team_id) or (user_id=auth.uid() and status='invited'))
  with check((slc_team_leader(team_id) and role='member') or (user_id=auth.uid() and role='member' and status in('accepted','declined')));
drop policy if exists "members delete" on team_members;
create policy "members delete" on team_members for delete using(user_id=auth.uid() or slc_team_leader(team_id));
