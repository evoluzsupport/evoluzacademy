-- Calendar connections: each person saves their own Zoho MCP link once. Run on the Evoluz Academy project.
create table if not exists public.calendar_connections (
  profile_id text primary key references public.profiles(id) on delete cascade,
  mcp_url text not null,
  updated_at timestamptz not null default now()
);

alter table public.calendar_connections enable row level security;

-- the link is a secret: only its owner can read or change it
create policy calendar_conn_read on public.calendar_connections for select
  using (profile_id = (select public.my_profile_id()));
create policy calendar_conn_insert on public.calendar_connections for insert
  with check (profile_id = (select public.my_profile_id()));
create policy calendar_conn_update on public.calendar_connections for update
  using (profile_id = (select public.my_profile_id())) with check (profile_id = (select public.my_profile_id()));
create policy calendar_conn_delete on public.calendar_connections for delete
  using (profile_id = (select public.my_profile_id()));

-- admins never see the links; the availability API asks for them through this function (admins only)
create or replace function public.admin_calendar_urls(p_emails text[])
returns table (email text, mcp_url text)
language sql stable security definer set search_path = public as $$
  select lower(p.email), c.mcp_url
  from public.calendar_connections c
  join public.profiles p on p.id = c.profile_id
  where (select public.is_admin()) and lower(p.email) = any (p_emails);
$$;
revoke all on function public.admin_calendar_urls(text[]) from public, anon;
grant execute on function public.admin_calendar_urls(text[]) to authenticated;
