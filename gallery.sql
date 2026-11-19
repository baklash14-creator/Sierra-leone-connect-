-- SL Connect: worker past-work photos + review photos. Safe to re-run. (Already applied if Claude ran it for you.)
alter table posts add column if not exists work_photos text[] not null default '{}';
do $$ begin if not exists (select 1 from pg_constraint where conname='posts_work_photos_max') then
  alter table posts add constraint posts_work_photos_max check (cardinality(work_photos) <= 8); end if; end $$;
alter table reviews add column if not exists photo_url text;
