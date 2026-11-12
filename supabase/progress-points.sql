-- Subtopic progress: which "What we cover" points were delivered to a learner, and by which trainer.
-- Lets a session be saved with only some subtopics ticked, each with its own trainer.
-- Run once in the Supabase SQL editor (Evoluz Academy project).

create table if not exists public.progress_points (
  trainee_id text not null references public.profiles(id) on delete cascade,
  course_id  text not null references public.courses(id)  on delete cascade,
  topic_id   text not null references public.topics(id)   on delete cascade,
  point      integer not null,
  done_on    date not null,
  trainer    text not null default '',
  session_id text references public.sessions(id) on delete cascade,
  primary key (trainee_id, course_id, topic_id, point)
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
