-- SL Connect: Available now, Top workers, Saved searches, Job tracker. Run once in Supabase SQL editor. Safe to re-run.

-- 1) Available now
alter table posts add column if not exists available_until timestamptz;

-- 2) Saved searches
create table if not exists saved_searches(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  q text not null default '' check(char_length(q)<=60),
  type text not null default '' check(type in('','service','job','rent','land')),
  loc text not null default '' check(char_length(loc)<=60),
  seen_at timestamptz not null default now(),
  created_at timestamptz not null default now());
create index if not exists saved_searches_user on saved_searches(user_id);
alter table saved_searches enable row level security;
drop policy if exists "ss own" on saved_searches;
create policy "ss own" on saved_searches for all using(user_id=auth.uid()) with check(user_id=auth.uid());

-- 3) Job tracker
create table if not exists jobs(
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts on delete set null,
  worker_id uuid not null references auth.users on delete cascade,
  client_id uuid not null references auth.users on delete cascade,
  worker_name text, client_name text,
  title text not null check(char_length(title) between 3 and 120),
  status text not null default 'booked' check(status in('booked','started','done','paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(worker_id<>client_id));
create index if not exists jobs_worker on jobs(worker_id,created_at desc);
create index if not exists jobs_client on jobs(client_id,created_at desc);
alter table jobs enable row level security;
drop policy if exists "jobs read" on jobs;
create policy "jobs read" on jobs for select using(worker_id=auth.uid() or client_id=auth.uid());
drop policy if exists "jobs worker insert" on jobs;
create policy "jobs worker insert" on jobs for insert with check(worker_id=auth.uid() and status='booked');
drop policy if exists "jobs parties update" on jobs;
create policy "jobs parties update" on jobs for update using(worker_id=auth.uid() or client_id=auth.uid()) with check(worker_id=auth.uid() or client_id=auth.uid());

-- only the right person can move a job forward, and nothing else can change
create or replace function jobs_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.worker_id<>old.worker_id or new.client_id<>old.client_id or new.post_id is distinct from old.post_id
     or new.title<>old.title or new.created_at<>old.created_at then
    raise exception 'Only the status can change';
  end if;
  if new.status<>old.status then
    if auth.uid()=old.worker_id and ((old.status='booked' and new.status='started') or (old.status='started' and new.status='done')) then null;
    elsif auth.uid()=old.client_id and old.status='done' and new.status='paid' then null;
    else raise exception 'Not allowed'; end if;
    new.updated_at:=now();
  end if;
  return new;
end $$;
drop trigger if exists jobs_guard_t on jobs;
create trigger jobs_guard_t before update on jobs for each row execute function jobs_guard();

-- 4) Top workers board (reads everyone's reviews and finished jobs, returns only totals)
create or replace function slc_top_workers() returns table(
  post_id uuid, owner uuid, title text, cat text, loc text, by_name text, avg_rating numeric, reviews bigint, jobs_done bigint)
language sql security definer stable set search_path=public as $$
  select p.id, p.owner, p.title, p.cat, p.loc, p.by_name, round(avg(r.rating)::numeric,1), count(r.id),
    (select count(*) from jobs j where j.worker_id=p.owner and j.status in('done','paid'))
  from posts p join reviews r on r.post_id=p.id
  where p.type='service' and p.status<>'taken'
  group by p.id
  order by avg(r.rating) desc, count(r.id) desc
  limit 30 $$;
grant execute on function slc_top_workers() to anon, authenticated;
