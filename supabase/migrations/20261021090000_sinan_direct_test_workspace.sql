-- Anonymous, per-browser persistent workspace for direct Sinan evaluation.
-- This deliberately stores only isolated test records, not records in the clinic's clinical tables.
create table if not exists public.sinan_test_patients (
  id uuid primary key default gen_random_uuid(),
  workspace_token uuid not null,
  patient_number text not null default ('TEST-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 180),
  reported_age_years smallint check (reported_age_years is null or reported_age_years between 1 and 120),
  chief_complaint text check (chief_complaint is null or char_length(chief_complaint) <= 2000),
  record_status text not null default 'active' check (record_status in ('active','inactive','archived')),
  created_at timestamptz not null default now()
);
alter table public.sinan_test_patients enable row level security;
revoke all on table public.sinan_test_patients from anon, authenticated;

create or replace function public.sinan_test_list_patients(p_workspace_token uuid)
returns table (
  id uuid,
  patient_number text,
  full_name text,
  reported_age_years smallint,
  chief_complaint text,
  created_at timestamptz,
  record_status text
)
language sql
security definer
set search_path = ''
as $$
  select p.id, p.patient_number, p.full_name, p.reported_age_years,
         p.chief_complaint, p.created_at, p.record_status
  from public.sinan_test_patients p
  where p.workspace_token = p_workspace_token
  order by p.created_at desc
  limit 100;
$$;

create or replace function public.sinan_test_create_patient(
  p_workspace_token uuid,
  p_full_name text,
  p_reported_age_years smallint default null,
  p_chief_complaint text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted public.sinan_test_patients%rowtype;
begin
  if p_workspace_token is null then
    raise exception 'workspace token required' using errcode = '22023';
  end if;
  if p_full_name is null or char_length(btrim(p_full_name)) < 2 or char_length(btrim(p_full_name)) > 180 then
    raise exception 'invalid patient name' using errcode = '22023';
  end if;
  if p_reported_age_years is not null and p_reported_age_years not between 1 and 120 then
    raise exception 'invalid age' using errcode = '22023';
  end if;
  if p_chief_complaint is not null and char_length(p_chief_complaint) > 2000 then
    raise exception 'complaint too long' using errcode = '22023';
  end if;

  insert into public.sinan_test_patients(workspace_token, full_name, reported_age_years, chief_complaint)
  values (p_workspace_token, btrim(p_full_name), p_reported_age_years, nullif(btrim(p_chief_complaint), ''))
  returning * into inserted;

  return jsonb_build_object(
    'id', inserted.id,
    'patient_number', inserted.patient_number,
    'full_name', inserted.full_name,
    'reported_age_years', inserted.reported_age_years,
    'chief_complaint', inserted.chief_complaint,
    'created_at', inserted.created_at,
    'record_status', inserted.record_status
  );
end;
$$;

revoke all on function public.sinan_test_list_patients(uuid) from public;
revoke all on function public.sinan_test_create_patient(uuid,text,smallint,text) from public;
grant execute on function public.sinan_test_list_patients(uuid) to anon, authenticated;
grant execute on function public.sinan_test_create_patient(uuid,text,smallint,text) to anon, authenticated;
