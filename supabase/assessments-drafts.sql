-- Assessments: no time limit, unfinished exams stay as drafts, feedback text.
-- Run once in the Supabase SQL editor (Evoluz Academy project).

-- Feedback written by staff for the person who took the exam.
alter table public.assessment_assignments add column if not exists feedback text not null default '';

-- Submitting no longer discards answers that arrive after the old time limit.
create or replace function public.submit_assessment(p_id text, p_answers jsonb)
returns public.assessment_assignments
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r public.assessment_assignments;
  sc integer;
  tot integer;
  ans jsonb := coalesce(p_answers, '{}'::jsonb);
begin
  select a.* into r from public.assessment_assignments a
   where a.id = p_id and a.trainee_id = (select public.my_profile_id()) for update;
  if not found then raise exception 'Assessment not found'; end if;
  if r.status = 'submitted' then raise exception 'Already submitted'; end if;
  if r.started_at is null then raise exception 'Start the assessment first'; end if;
  -- multiple-choice questions are scored here; written ones are marked later by staff
  select coalesce(sum(q.marks), 0),
         coalesce(sum(case when q.kind = 'mcq' and ans ->> q.id = k.answer::text then q.marks else 0 end), 0)
    into tot, sc
    from public.assessment_questions q left join public.assessment_keys k on k.question_id = q.id
   where q.assessment_id = r.assessment_id;
  update public.assessment_assignments
     set status = 'submitted', submitted_at = now(), score = sc, total = tot, answers = ans
   where id = p_id returning * into r;
  return r;
end $function$;

-- Saves the answers of an exam that has been started but not submitted (the draft).
create or replace function public.save_assessment_draft(p_id text, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.assessment_assignments
     set answers = coalesce(p_answers, '{}'::jsonb)
   where id = p_id
     and trainee_id = (select public.my_profile_id())
     and status = 'in-progress';
end $function$;
