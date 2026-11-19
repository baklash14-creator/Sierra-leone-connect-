-- SL Connect AI: per-user daily usage counter (stops runaway cost). Run once in Supabase SQL editor.
create table if not exists public.ai_usage (
  user_id uuid not null,
  day date not null default current_date,
  n int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
-- no policies: only the edge function (service role) reads/writes it

create or replace function public.ai_hit(p_user uuid, p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into ai_usage(user_id, day, n) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set n = ai_usage.n + 1
  returning n into c;
  return c <= p_limit;
end $$;
revoke all on function public.ai_hit(uuid,int) from public, anon, authenticated;
