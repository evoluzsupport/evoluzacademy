-- Multiple training sessions per topic.
-- A topic can be logged in any number of sessions, by different trainers on different dates, with a duration and notes.
-- Run once in the Supabase SQL editor (Evoluz Academy project).

-- 1. Duration and notes for each session.
alter table public.sessions add column if not exists duration_min integer check (duration_min is null or (duration_min > 0 and duration_min <= 1440));
alter table public.sessions add column if not exists notes text not null default '';

-- 2. Subtopics ("What we cover" points) delivered to a learner in a session, and by which trainer.
--    One row per learner, subtopic and session, so the same subtopic can be delivered again in a later session.
create table if not exists public.progress_points (
  trainee_id text not null references public.profiles(id) on delete cascade,
  course_id  text not null references public.courses(id)  on delete cascade,
  topic_id   text not null references public.topics(id)   on delete cascade,
  point      integer not null,
  session_id text not null references public.sessions(id) on delete cascade,
  done_on    date not null,
  trainer    text not null default '',
  primary key (trainee_id, course_id, topic_id, point, session_id)
);

alter table public.progress_points enable row level security;

-- Staff can read and write everything; a learner can read their own.
create policy progress_points_read on public.progress_points
  for select to authenticated
  using ((select public.is_staff()) or trainee_id = (select public.my_profile_id()));

create policy progress_points_write on public.progress_points
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
