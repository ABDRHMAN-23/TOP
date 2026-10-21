-- Isolated persistent workspace entities for no-account Sinan testing.
-- This table is deliberately separate from the protected clinical production tables.

create table if not exists public.sinan_test_workspace_records (
  workspace_token uuid not null,
  resource_type text not null check (resource_type in (
    'appointments', 'clinic_settings', 'booking_settings', 'reports',
    'odontogram', 'endodontics', 'medical_history', 'encounters',
    'patient_details', 'booking_requests'
  )),
  record_id uuid not null,
  patient_id uuid null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_token, resource_type, record_id),
  check (pg_column_size(payload) <= 65536)
);

create index if not exists sinan_test_workspace_records_lookup
  on public.sinan_test_workspace_records(workspace_token, resource_type, created_at desc);

alter table public.sinan_test_workspace_records enable row level security;
revoke all on table public.sinan_test_workspace_records from public, anon, authenticated;

create or replace function public.sinan_test_list_records(p_workspace_token uuid, p_resource_type text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if p_workspace_token is null then raise exception 'workspace token required' using errcode = '22023'; end if;
  if p_resource_type is null or p_resource_type <> all(array[
    'appointments','clinic_settings','booking_settings','reports',
    'odontogram','endodontics','medical_history','encounters',
    'patient_details','booking_requests'
  ]) then raise exception 'unsupported workspace resource' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(
    r.payload || jsonb_build_object('id', r.record_id, 'patient_id', r.patient_id, 'created_at', r.created_at, 'updated_at', r.updated_at)
    order by r.created_at desc
  ), '[]'::jsonb)
  into result
  from (
    select record_id, patient_id, payload, created_at, updated_at
    from public.sinan_test_workspace_records
    where workspace_token = p_workspace_token and resource_type = p_resource_type
    order by created_at desc limit 500
  ) r;
  return result;
end;
$$;

create or replace function public.sinan_test_get_record(p_workspace_token uuid, p_resource_type text, p_record_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if p_workspace_token is null or p_record_id is null then raise exception 'workspace token and record id required' using errcode = '22023'; end if;
  if p_resource_type is null or p_resource_type <> all(array[
    'appointments','clinic_settings','booking_settings','reports',
    'odontogram','endodontics','medical_history','encounters',
    'patient_details','booking_requests'
  ]) then raise exception 'unsupported workspace resource' using errcode = '22023'; end if;
  select r.payload || jsonb_build_object('id', r.record_id, 'patient_id', r.patient_id, 'created_at', r.created_at, 'updated_at', r.updated_at)
    into result
  from public.sinan_test_workspace_records r
  where r.workspace_token = p_workspace_token and r.resource_type = p_resource_type and r.record_id = p_record_id;
  return result;
end;
$$;

create or replace function public.sinan_test_upsert_record(
  p_workspace_token uuid, p_resource_type text, p_record_id uuid, p_patient_id uuid, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare saved public.sinan_test_workspace_records%rowtype; target_id uuid := coalesce(p_record_id, gen_random_uuid());
begin
  if p_workspace_token is null then raise exception 'workspace token required' using errcode = '22023'; end if;
  if p_resource_type is null or p_resource_type <> all(array[
    'appointments','clinic_settings','booking_settings','reports',
    'odontogram','endodontics','medical_history','encounters',
    'patient_details','booking_requests'
  ]) then raise exception 'unsupported workspace resource' using errcode = '22023'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 65536 then
    raise exception 'invalid or oversized payload' using errcode = '22023';
  end if;
  if p_patient_id is not null and not exists (
    select 1 from public.sinan_test_patients p where p.id = p_patient_id and p.workspace_token = p_workspace_token
  ) then raise exception 'patient not found in this workspace' using errcode = 'P0002'; end if;
  insert into public.sinan_test_workspace_records(workspace_token, resource_type, record_id, patient_id, payload, created_at, updated_at)
  values (p_workspace_token, p_resource_type, target_id, p_patient_id, p_payload, now(), now())
  on conflict (workspace_token, resource_type, record_id)
  do update set patient_id = excluded.patient_id, payload = excluded.payload, updated_at = now()
  returning * into saved;
  return saved.payload || jsonb_build_object('id', saved.record_id, 'patient_id', saved.patient_id, 'created_at', saved.created_at, 'updated_at', saved.updated_at);
end;
$$;

create or replace function public.sinan_test_delete_record(p_workspace_token uuid, p_resource_type text, p_record_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare deleted_count integer;
begin
  if p_workspace_token is null or p_record_id is null then raise exception 'workspace token and record id required' using errcode = '22023'; end if;
  if p_resource_type is null or p_resource_type <> all(array[
    'appointments','clinic_settings','booking_settings','reports',
    'odontogram','endodontics','medical_history','encounters',
    'patient_details','booking_requests'
  ]) then raise exception 'unsupported workspace resource' using errcode = '22023'; end if;
  delete from public.sinan_test_workspace_records
  where workspace_token = p_workspace_token and resource_type = p_resource_type and record_id = p_record_id;
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

create or replace function public.sinan_test_update_patient(
  p_workspace_token uuid, p_patient_id uuid, p_full_name text, p_reported_age_years smallint, p_chief_complaint text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare saved public.sinan_test_patients%rowtype;
begin
  if p_workspace_token is null or p_patient_id is null then raise exception 'workspace token and patient id required' using errcode = '22023'; end if;
  if p_full_name is null or char_length(btrim(p_full_name)) < 2 or char_length(btrim(p_full_name)) > 180 then raise exception 'invalid patient name' using errcode = '22023'; end if;
  if p_reported_age_years is not null and p_reported_age_years not between 1 and 120 then raise exception 'invalid age' using errcode = '22023'; end if;
  if p_chief_complaint is not null and char_length(p_chief_complaint) > 2000 then raise exception 'complaint too long' using errcode = '22023'; end if;
  update public.sinan_test_patients
  set full_name = btrim(p_full_name), reported_age_years = p_reported_age_years, chief_complaint = nullif(btrim(p_chief_complaint), '')
  where id = p_patient_id and workspace_token = p_workspace_token
  returning * into saved;
  if not found then raise exception 'patient not found' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', saved.id, 'patient_number', saved.patient_number, 'full_name', saved.full_name,
    'reported_age_years', saved.reported_age_years, 'chief_complaint', saved.chief_complaint,
    'created_at', saved.created_at, 'record_status', saved.record_status);
end;
$$;

revoke all on function public.sinan_test_list_records(uuid, text) from public;
revoke all on function public.sinan_test_get_record(uuid, text, uuid) from public;
revoke all on function public.sinan_test_upsert_record(uuid, text, uuid, uuid, jsonb) from public;
revoke all on function public.sinan_test_delete_record(uuid, text, uuid) from public;
revoke all on function public.sinan_test_update_patient(uuid, uuid, text, smallint, text) from public;
grant execute on function public.sinan_test_list_records(uuid, text) to anon, authenticated;
grant execute on function public.sinan_test_get_record(uuid, text, uuid) to anon, authenticated;
grant execute on function public.sinan_test_upsert_record(uuid, text, uuid, uuid, jsonb) to anon, authenticated;
grant execute on function public.sinan_test_delete_record(uuid, text, uuid) to anon, authenticated;
grant execute on function public.sinan_test_update_patient(uuid, uuid, text, smallint, text) to anon, authenticated;
