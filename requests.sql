-- SL Connect: Hire / Apply requests + verified-badge requests. Run once in Supabase -> SQL Editor. Safe to re-run.
create table if not exists post_requests(
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts on delete cascade,
  owner_id uuid not null references auth.users on delete cascade,
  sender_id uuid not null references auth.users on delete cascade,
  sender_name text, sender_phone text,
  message text not null check(char_length(message) between 3 and 500),
  status text not null default 'new' check(status in('new','accepted','declined')),
  created_at timestamptz not null default now(),
  unique(post_id,sender_id), check(owner_id<>sender_id));
create index if not exists post_requests_owner on post_requests(owner_id,created_at desc);
alter table post_requests enable row level security;
drop policy if exists "req read" on post_requests;
create policy "req read" on post_requests for select using(sender_id=auth.uid() or owner_id=auth.uid());
drop policy if exists "req insert" on post_requests;
create policy "req insert" on post_requests for insert with check(
  sender_id=auth.uid() and status='new' and exists(select 1 from posts p where p.id=post_id and p.owner=owner_id));
drop policy if exists "req owner update" on post_requests;
create policy "req owner update" on post_requests for update using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists "req delete own" on post_requests;
create policy "req delete own" on post_requests for delete using(sender_id=auth.uid() and status='new');

create table if not exists verify_requests(
  user_id uuid primary key references auth.users on delete cascade,
  name text, phone text, note text,
  status text not null default 'pending' check(status in('pending','done')),
  created_at timestamptz not null default now());
alter table verify_requests enable row level security;
drop policy if exists "vr own read" on verify_requests;
create policy "vr own read" on verify_requests for select using(user_id=auth.uid() or exists(select 1 from admins where user_id=auth.uid()));
drop policy if exists "vr insert" on verify_requests;
create policy "vr insert" on verify_requests for insert with check(user_id=auth.uid() and status='pending');
drop policy if exists "vr admin update" on verify_requests;
create policy "vr admin update" on verify_requests for update using(exists(select 1 from admins where user_id=auth.uid()));
