-- SL Connect: Skill tested badges, worker stats. Run once in Supabase SQL editor. Safe to re-run.
create table if not exists quiz_questions(id serial primary key, skill text not null, q text not null, opts jsonb not null, ans int not null, unique(skill,q));
alter table quiz_questions enable row level security;  -- no policies: answers are never readable by the app
create table if not exists skill_badges(user_id uuid not null references auth.users on delete cascade, skill text not null, score int not null, created_at timestamptz not null default now(), primary key(user_id,skill));
alter table skill_badges enable row level security;
drop policy if exists "badges read" on skill_badges; create policy "badges read" on skill_badges for select using(true);  -- no insert policy: only the grader below can award
create table if not exists quiz_attempts(user_id uuid not null, skill text not null, at timestamptz not null default now());
alter table quiz_attempts enable row level security;
create index if not exists quiz_attempts_u on quiz_attempts(user_id,skill,at desc);

create or replace function slc_quiz_skills() returns setof text language sql security definer stable set search_path=public as $$ select distinct skill from quiz_questions order by 1 $$;
create or replace function slc_quiz_get(p_skill text) returns table(id int,q text,opts jsonb) language sql security definer volatile set search_path=public as $$
  select id,q,opts from quiz_questions where skill=p_skill order by random() limit 5 $$;
create or replace function slc_quiz_submit(p_skill text, p_ids int[], p_ans int[]) returns json language plpgsql security definer set search_path=public as $$
declare s int:=0; i int; ok boolean;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if array_length(p_ids,1) is distinct from 5 or array_length(p_ans,1) is distinct from 5 then raise exception 'Answer all 5 questions'; end if;
  if exists(select 1 from quiz_attempts where user_id=auth.uid() and skill=p_skill and at>now()-interval '1 day') then raise exception 'You can try this skill once a day. Come back tomorrow.'; end if;
  if (select count(distinct x) from unnest(p_ids) x)<>5 then raise exception 'Bad answers'; end if;
  for i in 1..5 loop
    select (ans=p_ans[i]) into ok from quiz_questions where id=p_ids[i] and skill=p_skill;
    if ok is null then raise exception 'Bad question'; end if;
    if ok then s:=s+1; end if;
  end loop;
  insert into quiz_attempts(user_id,skill) values(auth.uid(),p_skill);
  if s>=4 then insert into skill_badges(user_id,skill,score) values(auth.uid(),p_skill,s) on conflict(user_id,skill) do update set score=greatest(skill_badges.score,excluded.score); end if;
  return json_build_object('score',s,'total',5,'passed',s>=4);
end $$;
grant execute on function slc_quiz_skills() to authenticated;
grant execute on function slc_quiz_get(text) to authenticated;
grant execute on function slc_quiz_submit(text,int[],int[]) to authenticated;

create or replace function slc_worker_stats(p_uid uuid) returns json language sql security definer stable set search_path=public as $$
  select json_build_object(
    'jobs_done',(select count(*) from jobs where worker_id=p_uid and status in('done','paid')),
    'reviews',(select count(*) from reviews r join posts p on p.id=r.post_id where p.owner=p_uid and p.type='service'),
    'avg',(select round(avg(r.rating)::numeric,1) from reviews r join posts p on p.id=r.post_id where p.owner=p_uid and p.type='service'),
    'badges',coalesce((select json_agg(skill order by skill) from skill_badges where user_id=p_uid),'[]'::json)) $$;
grant execute on function slc_worker_stats(uuid) to anon, authenticated;

insert into quiz_questions(skill,q,opts,ans) values
('Plumber','Which tool is used to grip and turn pipes?','["Tape measure", "Pipe wrench", "Hammer", "Paint brush"]',1),
('Plumber','What do you wrap on threaded pipe joints to stop leaks?','["Cotton cloth", "PTFE (plumber''s) tape", "Paper", "Sticky tape from a shop"]',1),
('Plumber','Before changing a tap washer, what should you do first?','["Heat the pipe", "Turn off the water supply", "Open all taps in the house", "Remove the sink"]',1),
('Plumber','A toilet keeps running after you flush. What is the most likely cause?','["A blocked roof", "A cold day", "Too much soap", "Faulty flapper or float valve"]',3),
('Plumber','What does the P-trap under a sink do?','["Filters drinking water", "Heats the water", "Holds water that blocks sewer smell", "Increases pressure"]',2),
('Plumber','Which is best for a hot water supply pipe?','["Garden hose", "Cardboard tube", "Thin drain pipe", "PPR or copper pipe made for hot water"]',3),
('Plumber','All taps in a house suddenly have low pressure. What do you check first?','["The wall colour", "The door lock", "The main valve, tank level and pump", "The paint"]',2),
('Plumber','What is a good sign of a hidden leak?','["The water is cold", "The water meter moves when every tap is off", "The pipe is long", "The taps are shiny"]',1),
('Electrician','Before working on a circuit, what must you do first?','["Switch off and isolate the power", "Wet your hands", "Touch the wire to test", "Remove your shoes only"]',0),
('Electrician','Which colours mark the earth wire?','["Blue", "White", "Green and yellow", "Red and black"]',2),
('Electrician','A breaker keeps tripping. What is the most likely cause?','["The wire is too new", "Overload or a short circuit", "The bulb is too bright", "The wall is cold"]',1),
('Electrician','What does a fuse protect against?','["Noise", "Too much current", "Low light", "Dust"]',1),
('Electrician','Which tool checks if a wire is live?','["Saw", "Voltage tester", "Hammer", "Spirit level"]',1),
('Electrician','What is the unit of electrical power?','["Metre", "Kilogram", "Watt", "Litre"]',2),
('Electrician','A cooker or air conditioner needs:','["Thicker wire and its own proper breaker", "A loose plug", "No earth", "Thinner wire than a bulb"]',0),
('Electrician','A person is stuck to a live wire. What do you do first?','["Pull them with bare hands", "Switch off the power if you can", "Pour water", "Shout and wait"]',1),
('Carpenter','Why do carpenters measure twice and cut once?','["To avoid wasting wood", "To look busy", "To make wood heavy", "To save glue only"]',0),
('Carpenter','Which saw is best for cutting across the grain?','["Axe only", "Crosscut saw", "Hacksaw for metal", "Bread knife"]',1),
('Carpenter','What holds glued pieces tight while the glue dries?','["A brush", "A clamp", "A nail file", "A hammer"]',1),
('Carpenter','What happens when wood takes in and loses moisture?','["Nothing ever", "It warps or swells", "It becomes glass", "It turns to metal"]',1),
('Carpenter','A pilot hole before screwing helps to:','["Make the screw longer", "Change the wood colour", "Stop the wood from splitting", "Save the drill"]',2),
('Carpenter','Which of these is a hardwood?','["Balsa", "Teak", "Foam", "Cardboard"]',1),
('Carpenter','A set square is used to check:','["Temperature", "Right angles", "Colour", "Weight"]',1),
('Carpenter','Which tool smooths a rough wooden surface?','["Pliers", "Plane or sandpaper", "Tape", "Spanner"]',1),
('Driver','Before a long trip you should check:','["Only the paint", "Tyres, oil, water and brakes", "Only the radio", "Nothing"]',1),
('Driver','A red oil warning light means:','["Time to speed up", "Music is on", "The tank is full", "Low oil pressure: stop safely and check"]',3),
('Driver','Why keep a two second gap behind the car in front?','["To have room to brake safely", "To save fuel only", "It is not needed", "To look slow"]',0),
('Driver','On a wet road you should:','["Drive faster", "Drive slower and brake earlier", "Brake suddenly", "Close your eyes"]',1),
('Driver','What does overloading a vehicle do?','["Saves fuel", "Makes it harder to stop and steer", "Nothing", "Makes braking safer"]',1),
('Driver','Your engine is overheating. What is safe?','["Stop, switch off and let it cool first", "Open the radiator cap at once", "Pour cold water on the hot engine", "Keep driving fast"]',0),
('Driver','You get a flat tyre on a busy road. You should:','["Stop in the middle", "Slow gently, move off the road and use hazard lights", "Speed up", "Brake hard"]',1),
('Driver','Using a phone while driving is:','["Safe if short", "Required", "Dangerous and distracting", "Good for fuel"]',2),
('Tailor','Which measurements are needed for a shirt?','["Only weight", "Only height", "Chest, shoulder, sleeve and neck", "Only shoe size"]',2),
('Tailor','What do tailors use to mark fabric?','["Paint", "Cement", "Tailor''s chalk", "Engine oil"]',2),
('Tailor','What is a seam allowance?','["The price", "A button", "Extra fabric beyond the stitching line", "A zip"]',2),
('Tailor','The grain line of fabric runs:','["Across the corner", "In circles", "Parallel to the selvage (edge)", "Anywhere"]',2),
('Tailor','How do you stop raw edges from fraying?','["Zigzag or overlock stitch", "Cut it shorter only", "Leave it wet", "Hang it"]',0),
('Tailor','Why wash cotton fabric before cutting?','["To change the price", "To make it heavier", "No reason", "To pre-shrink it"]',3),
('Tailor','What is a dart used for?','["To shape fabric to the body", "To hold buttons", "To measure", "To iron"]',0),
('Tailor','Which needle suits thick denim?','["A heavy denim needle", "No needle", "A nail", "A very thin silk needle"]',0)
on conflict(skill,q) do update set opts=excluded.opts, ans=excluded.ans;
