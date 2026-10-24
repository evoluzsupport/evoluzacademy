-- Applied to the Evoluz Academy project as migration "tickets".
create sequence if not exists public.ticket_no_seq;

create table public.tickets (
  id text primary key default gen_random_uuid()::text,
  number integer not null default nextval('public.ticket_no_seq'),
  raised_by text not null references public.profiles(id) on delete cascade,
  category text not null default 'Other',
  priority text not null default 'Medium' check (priority in ('Low','Medium','High')),
  subject text not null,
  description text not null default '',
  status text not null default 'open' check (status in ('open','in-progress','resolved','closed')),
  response text not null default '',
  handled_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_raised_by_idx on public.tickets (raised_by);

alter table public.tickets enable row level security;

create policy tickets_read on public.tickets for select
  using ((select public.is_admin()) or raised_by = (select public.my_profile_id()));
create policy tickets_insert on public.tickets for insert
  with check (raised_by = (select public.my_profile_id()) and status = 'open' and response = '' and handled_by = '');
create policy tickets_update on public.tickets for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy tickets_delete on public.tickets for delete
  using ((select public.is_admin()));
