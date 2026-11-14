-- SL Connect: lets admins verify / unverify a user from the new Admin Control Room.
-- Run once in Supabase -> SQL Editor. Safe to re-run. (chat.sql must already be run.)

create or replace function admin_set_verified(target uuid, make boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not slc_is_admin() then raise exception 'not allowed'; end if;
  if make then
    if not exists (select 1 from verified_users where user_id = target) then
      insert into verified_users (user_id) values (target);
    end if;
  else
    delete from verified_users where user_id = target;
  end if;
end $$;
