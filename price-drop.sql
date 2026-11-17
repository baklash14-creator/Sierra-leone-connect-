-- SL Connect: price drop badges. Run once in Supabase -> SQL Editor. Safe to re-run.
alter table posts add column if not exists old_price text;
alter table posts add column if not exists price_changed_at timestamptz;
