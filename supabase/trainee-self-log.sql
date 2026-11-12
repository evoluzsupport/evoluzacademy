-- Trainees can log their own topics (My Course -> Mark Topic Covered).
-- Run once in the Supabase SQL editor (Evoluz Academy project).
--
-- A trainee may only INSERT a progress row for themselves, on a course they are assigned.
-- They cannot update or delete progress: once a topic is covered, only staff can change it.

create policy progress_self_insert on public.progress
  for insert to authenticated
  with check (
    trainee_id = (select public.my_profile_id())
    and exists (
      select 1 from public.assignments a
      where a.trainee_id = progress.trainee_id
        and a.course_id = progress.course_id
    )
  );
