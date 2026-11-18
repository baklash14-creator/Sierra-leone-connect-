-- SL Connect: paid verified badge (Le 30 per 30 days) via Monime. Run once in Supabase -> SQL Editor. Safe to re-run.
alter table verified_users add column if not exists expires_at timestamptz;   -- null = verified by an admin, never expires

create table if not exists verify_payments(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  amount numeric(12,2) not null,
  status text not null default 'pending' check(status in('pending','successful','failed')),
  provider_session_id text unique, provider_order text, note text,
  created_at timestamptz not null default now(), paid_at timestamptz);
create index if not exists verify_payments_user on verify_payments(user_id,status);
alter table verify_payments enable row level security;
drop policy if exists "own verify payments" on verify_payments;
create policy "own verify payments" on verify_payments for select using(user_id=auth.uid() or exists(select 1 from admins where user_id=auth.uid()));
-- no insert/update policies: only the server functions (service role) write here.

-- called by the server after Monime confirms the payment
create or replace function finalize_verify_payment(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare r verify_payments; cur timestamptz;
begin
  select * into r from verify_payments where id=p_id for update;
  if not found or r.status<>'pending' then return; end if;
  update verify_payments set status='successful', paid_at=now() where id=p_id;
  select expires_at into cur from verified_users where user_id=r.user_id;
  if exists(select 1 from verified_users where user_id=r.user_id) and cur is null then return; end if; -- admin-verified forever: keep
  insert into verified_users(user_id,expires_at) values(r.user_id, greatest(now(),coalesce(cur,now())) + interval '30 days')
  on conflict (user_id) do update set expires_at=excluded.expires_at;
end $$;
revoke all on function finalize_verify_payment(uuid) from public, anon, authenticated;

-- removes expired paid badges (the app calls this when it opens)
create or replace function slc_expire_verified() returns void language sql security definer set search_path=public as $$
  delete from verified_users where expires_at is not null and expires_at < now() $$;
grant execute on function slc_expire_verified() to anon, authenticated;
