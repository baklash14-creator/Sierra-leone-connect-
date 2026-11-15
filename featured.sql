-- SL Connect: featured posts + views counter.
-- Run once in Supabase -> SQL Editor. Safe to re-run. (chat.sql must already be run.)

alter table posts add column if not exists featured boolean not null default false;
alter table posts add column if not exists featured_at timestamptz;
alter table posts add column if not exists views integer not null default 0;

-- one row per (post, viewer) so each person counts once
create table if not exists post_views (
  post_id text not null,
  viewer uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, viewer)
);
alter table post_views enable row level security;   -- no policies: only the function below can write

-- signed-in people open a post -> count it once (the owner's own views are ignored)
create or replace function bump_view(pid text) returns void
language plpgsql security definer set search_path = public as $$
declare added int;
begin
  if auth.uid() is null then return; end if;
  if exists (select 1 from posts where id::text = pid and owner = auth.uid()) then return; end if;
  if not exists (select 1 from posts where id::text = pid) then return; end if;
  insert into post_views (post_id, viewer) values (pid, auth.uid()) on conflict do nothing;
  get diagnostics added = row_count;
  if added > 0 then
    perform set_config('slc.allow', '1', true);
    update posts set views = views + 1 where id::text = pid;
  end if;
end $$;

-- only admins can feature / un-feature
create or replace function admin_set_featured(pid text, make boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not slc_is_admin() then raise exception 'not allowed'; end if;
  perform set_config('slc.allow', '1', true);
  update posts set featured = make, featured_at = case when make then now() else null end where id::text = pid;
end $$;

-- featured / views must not be editable by post owners through normal updates
-- (they only change through the two functions above)
create or replace function slc_lock_featured() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('slc.allow', true), '') <> '1'
     and (new.featured is distinct from old.featured or new.views is distinct from old.views or new.featured_at is distinct from old.featured_at) then
    new.featured := old.featured; new.views := old.views; new.featured_at := old.featured_at;
  end if;
  return new;
end $$;
drop trigger if exists slc_lock_featured_t on posts;
create trigger slc_lock_featured_t before update on posts for each row execute function slc_lock_featured();
