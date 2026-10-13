-- SINAN initial clinical workspace schema
-- Run against a new, dedicated Supabase project after reviewing this migration.
-- This migration intentionally does not DROP or rewrite any existing table.
begin;
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 180),
  name_en text,
  timezone text not null default 'Asia/Aden',
  default_locale text not null default 'ar' check (default_locale in ('ar','en','bi')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','clinic_admin','dentist','clinician','assistant','receptionist','billing')),
  status text not null default 'active' check (status in ('invited','active','suspended','removed')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index if not exists memberships_user_status_idx on public.organization_memberships(user_id, status);

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public, auth, pg_temp
as $$ select exists(select 1 from public.organization_memberships m where m.organization_id = p_org and m.user_id = auth.uid() and m.status = 'active'); $$;

create or replace function public.has_org_role(p_org uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public, auth, pg_temp
as $$ select exists(select 1 from public.organization_memberships m where m.organization_id = p_org and m.user_id = auth.uid() and m.status = 'active' and m.role = any(p_roles)); $$;

create or replace function public.create_clinic(p_name text, p_name_en text default null, p_timezone text default 'Asia/Aden')
returns uuid language plpgsql security definer set search_path = public, auth, pg_temp
as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 180 then raise exception 'invalid clinic name'; end if;
  insert into public.organizations(name, name_en, timezone, created_by) values(trim(p_name), nullif(trim(p_name_en),''), coalesce(nullif(trim(p_timezone),''),'Asia/Aden'), auth.uid()) returning id into new_id;
  insert into public.organization_memberships(organization_id,user_id,role,status) values(new_id,auth.uid(),'owner','active');
  insert into public.clinic_settings(organization_id, clinic_name_ar, clinic_name_en) values(new_id, trim(p_name), nullif(trim(p_name_en),''));
  return new_id;
end; $$;

create table if not exists public.clinic_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  clinic_name_ar text not null,
  clinic_name_en text,
  logo_storage_key text,
  address_ar text,
  address_en text,
  phone text,
  email text,
  website text,
  default_report_language text not null default 'ar' check (default_report_language in ('ar','en','bi')),
  paper_size text not null default 'A4' check (paper_size in ('A4','Letter')),
  tooth_notation text not null default 'FDI' check (tooth_notation in ('FDI','Universal','Palmer')),
  recording_policy_version text not null default 'clinic-policy-v1',
  audio_retention_days integer not null default 30 check (audio_retention_days between 0 and 3650),
  settings_version integer not null default 1,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinicians (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, display_name text not null,
  specialty text not null default 'dentistry', professional_number text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_number text, full_name text not null check (char_length(trim(full_name)) between 2 and 180),
  date_of_birth date, sex text not null default 'unspecified' check (sex in ('female','male','unspecified')),
  phone text, email text, address text, chief_complaint text,
  record_status text not null default 'active' check (record_status in ('active','inactive','merged','archived')),
  created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, patient_number)
);
create index if not exists patients_org_updated_idx on public.patients(organization_id, updated_at desc) where deleted_at is null;
create index if not exists patients_org_name_idx on public.patients(organization_id, lower(full_name));

create table if not exists public.patient_medical_history_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  category text not null check (category in ('condition','allergy','medication','surgery','family_history','social_history','dental_history','other')),
  title text not null, value jsonb, state text not null check (state in ('positive','explicitly_negative','not_asked','not_recorded','unknown','not_applicable','needs_review')),
  source text, source_encounter_id uuid, last_reviewed_by uuid references auth.users(id), last_reviewed_at timestamptz,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists medical_history_patient_idx on public.patient_medical_history_items(organization_id, patient_id, category);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade, clinician_id uuid references public.clinicians(id) on delete set null,
  scheduled_start timestamptz not null, scheduled_end timestamptz not null, timezone text not null default 'Asia/Aden',
  appointment_type text not null default 'dental_visit', status text not null default 'scheduled' check (status in ('scheduled','confirmed','arrived','in_progress','completed','cancelled','no_show')),
  note text, created_by uuid not null references auth.users(id), updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint appointments_valid_range check (scheduled_end > scheduled_start)
);
create index if not exists appointments_org_start_idx on public.appointments(organization_id, scheduled_start);

create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade, clinician_user_id uuid references auth.users(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null, encounter_type text not null default 'dental_visit',
  status text not null default 'draft' check (status in ('draft','recording','processing','needs_review','approved','corrected','cancelled','processing_failed')),
  started_at timestamptz, ended_at timestamptz, chief_complaint text,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists encounters_patient_timeline_idx on public.encounters(organization_id, patient_id, created_at desc);

create table if not exists public.recording_consents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade, patient_id uuid not null references public.patients(id) on delete cascade,
  recorded_by uuid not null references auth.users(id), consent_state text not null check (consent_state in ('confirmed','declined','withdrawn','not_required','needs_review')),
  method text not null, policy_version text not null, scope text not null, recorded_at timestamptz not null,
  withdrawn_at timestamptz, withdrawal_note text, created_at timestamptz not null default now()
);

create table if not exists public.recording_sessions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade, patient_id uuid not null references public.patients(id) on delete cascade,
  consent_id uuid not null references public.recording_consents(id), created_by uuid not null references auth.users(id),
  capture_state text not null default 'capturing' check (capture_state in ('capturing','paused','uploading','queued','transcribing','structuring','needs_review','failed','deleted')),
  mime_type text not null default 'audio/webm', started_at timestamptz not null default now(), last_chunk_at timestamptz,
  finished_at timestamptz, duration_ms bigint, deletion_due_at timestamptz, error_code text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists recording_sessions_org_state_idx on public.recording_sessions(organization_id, capture_state, created_at desc);

create table if not exists public.recording_chunks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  recording_session_id uuid not null references public.recording_sessions(id) on delete cascade, chunk_index integer not null check (chunk_index >= 0),
  storage_key text not null, mime_type text not null, byte_size bigint not null check (byte_size > 0), uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(), unique (recording_session_id, chunk_index), unique (storage_key)
);
create index if not exists recording_chunks_order_idx on public.recording_chunks(organization_id, recording_session_id, chunk_index);

create table if not exists public.ai_processing_jobs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade, recording_session_id uuid not null references public.recording_sessions(id) on delete cascade,
  job_type text not null, status text not null default 'queued' check (status in ('queued','transcribing','structuring','needs_review','completed','failed','cancelled')),
  requested_by uuid not null references auth.users(id), attempts integer not null default 0 check (attempts >= 0), progress_step text,
  model_provider text, model_name text, output_summary jsonb, error_message text,
  started_at timestamptz, finished_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ai_jobs_org_status_idx on public.ai_processing_jobs(organization_id, status, created_at desc);
create unique index if not exists ai_jobs_one_transcription_per_recording_idx on public.ai_processing_jobs(recording_session_id, job_type) where status not in ('failed','cancelled');

create table if not exists public.transcript_segments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade, source_job_id uuid references public.ai_processing_jobs(id) on delete set null,
  segment_index integer not null check (segment_index >= 0), start_ms bigint, end_ms bigint, text text not null,
  speaker_label text not null default 'غير محدد', speaker_confidence numeric(5,4), transcription_confidence numeric(5,4),
  state text not null default 'needs_review' check (state in ('needs_review','clinician_confirmed','corrected','uncertain')),
  reviewed_by uuid references auth.users(id), reviewed_at timestamptz, created_at timestamptz not null default now(),
  unique (encounter_id, source_job_id, segment_index)
);
create index if not exists transcript_segments_encounter_idx on public.transcript_segments(organization_id, encounter_id, segment_index);

create table if not exists public.clinical_notes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade, patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid not null references auth.users(id), status text not null default 'needs_review' check (status in ('draft','needs_review','ready_for_approval','approved','corrected','superseded')),
  version integer not null default 1 check (version > 0), draft_json jsonb not null, transcript_text text,
  model_provider text, model_name text, provenance jsonb not null default '{}'::jsonb, reviewer_user_id uuid references auth.users(id), reviewed_at timestamptz,
  approved_by uuid references auth.users(id), approved_at timestamptz, supersedes_note_id uuid references public.clinical_notes(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists clinical_notes_patient_idx on public.clinical_notes(organization_id, patient_id, created_at desc);
create index if not exists clinical_notes_encounter_idx on public.clinical_notes(organization_id, encounter_id, version desc);
create unique index if not exists clinical_notes_encounter_version_uidx on public.clinical_notes(organization_id, encounter_id, version);
create unique index if not exists clinical_notes_one_successor_idx on public.clinical_notes(supersedes_note_id) where supersedes_note_id is not null;

create table if not exists public.clinical_facts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade, encounter_id uuid references public.encounters(id) on delete set null,
  fact_type text not null, concept_code text, value jsonb, unit text, state text not null check (state in ('patient_reported','observed','ai_suggested','clinician_confirmed','explicitly_negative','unknown','not_collected','not_applicable')),
  source_quote text, source_segment_id uuid references public.transcript_segments(id) on delete set null, confidence numeric(5,4),
  created_by uuid references auth.users(id), confirmed_by uuid references auth.users(id), confirmed_at timestamptz, valid_from timestamptz not null default now(), superseded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists clinical_facts_patient_idx on public.clinical_facts(organization_id, patient_id, fact_type);

create table if not exists public.dental_tooth_entries (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade, encounter_id uuid references public.encounters(id) on delete set null,
  tooth_number text not null, notation_system text not null default 'FDI' check (notation_system in ('FDI','Universal','Palmer')),
  status text not null, surfaces text[] not null default '{}', note text, state text not null default 'needs_review' check (state in ('needs_review','ai_suggested','clinician_confirmed','corrected')),
  source_segment_id uuid references public.transcript_segments(id) on delete set null, created_by uuid references auth.users(id), confirmed_by uuid references auth.users(id), confirmed_at timestamptz,
  supersedes_entry_id uuid references public.dental_tooth_entries(id), created_at timestamptz not null default now()
);
create index if not exists dental_tooth_patient_idx on public.dental_tooth_entries(organization_id, patient_id, tooth_number, created_at desc);

create table if not exists public.procedures (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade, encounter_id uuid not null references public.encounters(id) on delete cascade,
  tooth_number text, code text, name text not null, status text not null check (status in ('proposed','planned','in_progress','completed','deferred','stopped','cancelled')),
  note text, state text not null default 'needs_review' check (state in ('ai_suggested','needs_review','clinician_confirmed')),
  performed_at timestamptz, created_by uuid references auth.users(id), confirmed_by uuid references auth.users(id), confirmed_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.endodontic_cases (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade, encounter_id uuid references public.encounters(id) on delete set null,
  tooth_number text not null, notation_system text not null default 'FDI', diagnosis text, diagnosis_state text not null default 'needs_review' check (diagnosis_state in ('needs_review','ai_suggested','clinician_confirmed')),
  stage text not null default 'planned' check (stage in ('planned','in_progress','completed','deferred','stopped')),
  follow_up_at timestamptz, follow_up_note text, note text, created_by uuid references auth.users(id), confirmed_by uuid references auth.users(id), confirmed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.endodontic_canals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  endodontic_case_id uuid not null references public.endodontic_cases(id) on delete cascade, canal_name text not null,
  measurement_type text not null check (measurement_type in ('estimated_length','working_length','measured_length','recheck')),
  length_value numeric(6,2), unit text not null default 'mm' check (unit in ('mm','cm')),
  method text, source_quote text, state text not null default 'needs_review' check (state in ('needs_review','ai_suggested','clinician_confirmed','corrected')),
  measured_by uuid references auth.users(id), measured_at timestamptz, verified_by uuid references auth.users(id), verified_at timestamptz, created_at timestamptz not null default now(),
  check (length_value is null or length_value > 0)
);
create index if not exists endodontic_case_idx on public.endodontic_canals(organization_id, endodontic_case_id);

create table if not exists public.document_assets (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade, encounter_id uuid references public.encounters(id) on delete set null,
  storage_key text not null unique, file_name text not null, mime_type text not null, byte_size bigint not null,
  asset_type text not null check (asset_type in ('radiograph','clinical_image','attachment','report','signature','other')),
  uploaded_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade, encounter_id uuid references public.encounters(id) on delete set null,
  clinical_note_id uuid references public.clinical_notes(id) on delete set null, report_type text not null, language text not null default 'ar' check (language in ('ar','en','bi')),
  status text not null default 'draft' check (status in ('draft','generated','issued','corrected','superseded')),
  source_record_version integer, clinic_identity_snapshot jsonb not null default '{}'::jsonb, content_snapshot jsonb not null,
  storage_key text, created_by uuid not null references auth.users(id), issued_by uuid references auth.users(id), issued_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade, clinical_note_id uuid not null references public.clinical_notes(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id), action text not null check (action in ('approved','corrected','superseded','rejected')),
  method text not null, record_version integer not null, created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id), action text not null, resource_type text not null, resource_id uuid,
  metadata jsonb not null default '{}'::jsonb, request_id text, ip_hash text, created_at timestamptz not null default now()
);
create index if not exists audit_events_org_time_idx on public.audit_events(organization_id, created_at desc);

-- Transactional recording kickoff: patient validation, encounter, consent evidence,
-- session and audit record commit together or roll back together.
create or replace function public.start_clinical_recording(
  p_organization_id uuid,
  p_patient_id uuid,
  p_content_type text default 'audio/webm',
  p_policy_version text default 'clinic-policy-v1'
) returns jsonb
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_patient public.patients%rowtype;
  v_encounter uuid;
  v_consent uuid;
  v_recording uuid;
  v_type text;
begin
  if v_user is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not public.has_org_role(p_organization_id, array['owner','clinic_admin','dentist','clinician']) then
    raise exception 'clinical recording permission required' using errcode = '42501';
  end if;
  select * into v_patient from public.patients
    where id = p_patient_id and organization_id = p_organization_id and deleted_at is null;
  if not found then raise exception 'patient not found in clinic' using errcode = 'P0002'; end if;
  v_type := lower(split_part(coalesce(p_content_type, 'audio/webm'), ';', 1));
  if v_type not in ('audio/webm','audio/ogg','audio/wav','audio/mpeg','audio/mp4') then
    raise exception 'unsupported audio content type' using errcode = '22023';
  end if;
  if p_policy_version is null or char_length(trim(p_policy_version)) < 1 or char_length(p_policy_version) > 60 then
    raise exception 'invalid recording policy version' using errcode = '22023';
  end if;
  insert into public.encounters(organization_id, patient_id, clinician_user_id, status, encounter_type, started_at, created_by)
  values (p_organization_id, v_patient.id, v_user, 'recording', 'dental_visit', now(), v_user)
  returning id into v_encounter;
  insert into public.recording_consents(organization_id, encounter_id, patient_id, recorded_by, consent_state, method, policy_version, scope, recorded_at)
  values (p_organization_id, v_encounter, v_patient.id, v_user, 'confirmed', 'clinician_attested', trim(p_policy_version), 'audio_recording_and_transcription', now())
  returning id into v_consent;
  insert into public.recording_sessions(organization_id, encounter_id, patient_id, consent_id, created_by, capture_state, mime_type, started_at)
  values (p_organization_id, v_encounter, v_patient.id, v_consent, v_user, 'capturing', v_type, now())
  returning id into v_recording;
  insert into public.audit_events(organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (p_organization_id, v_user, 'recording.started', 'recording_session', v_recording, jsonb_build_object('encounter_id', v_encounter, 'consent_id', v_consent, 'policy_version', trim(p_policy_version)));
  return jsonb_build_object('recording_id', v_recording, 'encounter_id', v_encounter, 'state', 'capturing', 'content_type', v_type);
end;
$$;
revoke all on function public.start_clinical_recording(uuid,uuid,text,text) from public, anon;
grant execute on function public.start_clinical_recording(uuid,uuid,text,text) to authenticated;

-- Atomic, version-checked clinician approval. The note, encounter, approval ledger and audit row
-- are committed together; direct authenticated UPDATE of clinical_notes is revoked below.
create or replace function public.approve_clinical_note(
  p_organization_id uuid,
  p_encounter_id uuid,
  p_clinical_note_id uuid,
  p_expected_version integer,
  p_method text default 'clinician_review'
) returns jsonb
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_note public.clinical_notes%rowtype;
  v_now timestamptz := now();
begin
  if v_user is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not public.has_org_role(p_organization_id, array['owner','clinic_admin','dentist','clinician']) then
    raise exception 'clinical approval permission required' using errcode = '42501';
  end if;
  if p_method not in ('clinician_review','electronic_signature') then raise exception 'invalid approval method' using errcode = '22023'; end if;
  select * into v_note from public.clinical_notes
    where id = p_clinical_note_id and organization_id = p_organization_id and encounter_id = p_encounter_id
    for update;
  if not found then raise exception 'clinical note not found' using errcode = 'P0002'; end if;
  if v_note.version <> p_expected_version then raise exception 'clinical note version conflict' using errcode = '40001'; end if;
  if v_note.status = 'approved' and v_note.approved_by is not null and v_note.approved_at is not null then
    return jsonb_build_object('id',v_note.id,'encounter_id',p_encounter_id,'status','approved','version',v_note.version,'approved_by',v_note.approved_by,'approved_at',v_note.approved_at,'already_approved',true);
  end if;
  if v_note.status not in ('needs_review','ready_for_approval') then raise exception 'clinical note is not approvable' using errcode = '55000'; end if;
  update public.clinical_notes set status='approved', approved_by=v_user, approved_at=v_now,
    reviewer_user_id=v_user, reviewed_at=v_now, updated_at=v_now
    where id=v_note.id and organization_id=p_organization_id and version=p_expected_version;
  update public.encounters set status='approved', updated_at=v_now
    where id=p_encounter_id and organization_id=p_organization_id;
  if not found then raise exception 'encounter not found' using errcode = 'P0002'; end if;
  insert into public.approvals(organization_id,encounter_id,clinical_note_id,actor_user_id,action,method,record_version)
    values(p_organization_id,p_encounter_id,v_note.id,v_user,'approved',p_method,v_note.version);
  insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
    values(p_organization_id,v_user,'clinical_note.approved','clinical_note',v_note.id,
      jsonb_build_object('version',v_note.version,'method',p_method));
  return jsonb_build_object('id',v_note.id,'encounter_id',p_encounter_id,'status','approved','version',v_note.version,'approved_by',v_user,'approved_at',v_now);
end;
$$;

-- Atomic clinical note revision. Old approved notes cannot be modified by clients; changes create
-- a successor version and preserve the exact historical document/approval.
create or replace function public.revise_clinical_note(
  p_organization_id uuid,
  p_clinical_note_id uuid,
  p_expected_version integer,
  p_draft_json jsonb,
  p_transcript_text text default null
) returns jsonb
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_old public.clinical_notes%rowtype;
  v_new public.clinical_notes%rowtype;
  v_now timestamptz := now();
begin
  if v_user is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not public.has_org_role(p_organization_id, array['owner','clinic_admin','dentist','clinician']) then
    raise exception 'clinical editing permission required' using errcode = '42501';
  end if;
  if p_draft_json is null or jsonb_typeof(p_draft_json) <> 'object' then raise exception 'invalid clinical draft' using errcode = '22023'; end if;
  select * into v_old from public.clinical_notes
    where id=p_clinical_note_id and organization_id=p_organization_id for update;
  if not found then raise exception 'clinical note not found' using errcode = 'P0002'; end if;
  if v_old.version <> p_expected_version then raise exception 'clinical note version conflict' using errcode = '40001'; end if;
  if v_old.status = 'superseded' then
    select * into v_new from public.clinical_notes where organization_id=p_organization_id and supersedes_note_id=v_old.id;
    if found then
      return jsonb_build_object('id',v_new.id,'encounter_id',v_new.encounter_id,'patient_id',v_new.patient_id,'status',v_new.status,'version',v_new.version,'draft_json',v_new.draft_json,'created_at',v_new.created_at,'already_revised',true);
    end if;
  end if;
  if v_old.status not in ('draft','needs_review','ready_for_approval') then raise exception 'clinical note is immutable in this state' using errcode = '55000'; end if;
  update public.clinical_notes set status='superseded', updated_at=v_now where id=v_old.id and organization_id=p_organization_id;
  insert into public.clinical_notes(organization_id,encounter_id,patient_id,created_by,status,version,draft_json,transcript_text,model_provider,model_name,provenance,supersedes_note_id,created_at,updated_at)
  values(p_organization_id,v_old.encounter_id,v_old.patient_id,v_user,'needs_review',v_old.version+1,p_draft_json,
    coalesce(p_transcript_text,v_old.transcript_text),v_old.model_provider,v_old.model_name,
    coalesce(v_old.provenance,'{}'::jsonb) || jsonb_build_object('revised_from',v_old.id,'revision_reason','clinician_edit'),v_old.id,v_now,v_now)
  returning * into v_new;
  insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
    values(p_organization_id,v_user,'clinical_note.revised','clinical_note',v_new.id,
      jsonb_build_object('previous_note_id',v_old.id,'version',v_new.version));
  return jsonb_build_object('id',v_new.id,'encounter_id',v_new.encounter_id,'patient_id',v_new.patient_id,'status',v_new.status,'version',v_new.version,'draft_json',v_new.draft_json,'created_at',v_new.created_at);
end;
$$;
revoke all on function public.approve_clinical_note(uuid,uuid,uuid,integer,text) from public, anon;
revoke all on function public.revise_clinical_note(uuid,uuid,integer,jsonb,text) from public, anon;
grant execute on function public.approve_clinical_note(uuid,uuid,uuid,integer,text) to authenticated;
grant execute on function public.revise_clinical_note(uuid,uuid,integer,jsonb,text) to authenticated;

-- The encounter status cannot be marked approved just because a client updates the encounter row.
-- The transaction above changes the note first; this guard requires a matching approved note.
create or replace function public.guard_encounter_approval()
returns trigger language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    if not exists (
      select 1 from public.clinical_notes n
      where n.organization_id = new.organization_id and n.encounter_id = new.id
        and n.status = 'approved' and n.approved_by is not null and n.approved_at is not null
    ) then
      raise exception 'encounter requires an explicitly approved clinical note' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_encounter_approval_before_write
before insert or update on public.encounters
for each row execute function public.guard_encounter_approval();

-- Enforce tenant isolation. Data-writing restrictions for consent, approval, audio, and clinical artifacts are role-aware.
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.clinicians enable row level security;
alter table public.patients enable row level security;
alter table public.patient_medical_history_items enable row level security;
alter table public.appointments enable row level security;
alter table public.encounters enable row level security;
alter table public.recording_consents enable row level security;
alter table public.recording_sessions enable row level security;
alter table public.recording_chunks enable row level security;
alter table public.ai_processing_jobs enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.clinical_notes enable row level security;
alter table public.clinical_facts enable row level security;
alter table public.dental_tooth_entries enable row level security;
alter table public.procedures enable row level security;
alter table public.endodontic_cases enable row level security;
alter table public.endodontic_canals enable row level security;
alter table public.document_assets enable row level security;
alter table public.reports enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_events enable row level security;

create policy org_select_member on public.organizations for select to authenticated using (public.is_org_member(id));
create policy memberships_select_self_or_org on public.organization_memberships for select to authenticated using (user_id = auth.uid() or public.is_org_member(organization_id));
create policy memberships_owner_manage on public.organization_memberships for all to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin']));

create policy clinic_settings_member_select on public.clinic_settings for select to authenticated using (public.is_org_member(organization_id));
create policy clinic_settings_admin_write on public.clinic_settings for all to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin']));
create policy clinicians_member_read on public.clinicians for select to authenticated using (public.is_org_member(organization_id));
create policy clinicians_admin_manage on public.clinicians for all to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin']));
create policy patients_clinical_select on public.patients for select to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician','assistant']) and deleted_at is null);
create policy patients_clinical_write on public.patients for insert to authenticated with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy patients_clinical_update on public.patients for update to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
-- Reception staff receive a deliberately reduced directory view. The base patient table
-- remains unavailable to roles that should not browse clinical fields directly.
create or replace view public.patient_directory as
select id, organization_id, patient_number, full_name, date_of_birth, phone,
       record_status, created_at, updated_at
from public.patients
where public.is_org_member(organization_id) and deleted_at is null;
grant select on public.patient_directory to authenticated;

create policy history_clinical_read on public.patient_medical_history_items for select to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician','assistant']));
create policy history_clinical_write on public.patient_medical_history_items for insert to authenticated with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician','assistant']));
create policy history_clinical_update on public.patient_medical_history_items for update to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician','assistant'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician','assistant']));
create policy appointments_member_read on public.appointments for select to authenticated using (public.is_org_member(organization_id));
create policy appointments_staff_insert on public.appointments for insert to authenticated with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician','receptionist']));
create policy appointments_staff_update on public.appointments for update to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician','receptionist'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician','receptionist']));
create policy appointments_admin_delete on public.appointments for delete to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist']));
create policy encounters_clinical_read on public.encounters for select to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician','assistant']));
create policy encounters_clinical_write on public.encounters for insert to authenticated with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy encounters_clinical_update on public.encounters for update to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy consent_clinical_read on public.recording_consents for select to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy consent_clinician_insert on public.recording_consents for insert to authenticated with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy recordings_clinical_access on public.recording_sessions for select to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy recordings_clinical_insert on public.recording_sessions for insert to authenticated with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy recordings_clinical_update on public.recording_sessions for update to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy audio_chunks_clinical_access on public.recording_chunks for all to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy jobs_member_access on public.ai_processing_jobs for select to authenticated using (public.is_org_member(organization_id));
create policy jobs_clinical_write on public.ai_processing_jobs for insert to authenticated with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy jobs_clinical_update on public.ai_processing_jobs for update to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy transcript_clinical_access on public.transcript_segments for all to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy notes_clinical_read on public.clinical_notes for select to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy notes_clinical_insert on public.clinical_notes for insert to authenticated with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']) and status in ('draft','needs_review') and approved_by is null and approved_at is null);
create policy facts_clinical_access on public.clinical_facts for all to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy teeth_clinical_access on public.dental_tooth_entries for all to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy procedures_clinical_access on public.procedures for all to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy endo_clinical_access on public.endodontic_cases for all to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy endo_canals_clinical_access on public.endodontic_canals for all to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician'])) with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy document_assets_member_read on public.document_assets for select to authenticated using (public.is_org_member(organization_id));
create policy document_assets_clinical_write on public.document_assets for insert to authenticated with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician','assistant']));
create policy reports_clinical_read on public.reports for select to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy reports_clinical_write on public.reports for insert to authenticated with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy approvals_member_read on public.approvals for select to authenticated using (public.is_org_member(organization_id));
create policy approvals_clinician_insert on public.approvals for insert to authenticated with check (actor_user_id = auth.uid() and public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy audit_member_read on public.audit_events for select to authenticated using (public.has_org_role(organization_id, array['owner','clinic_admin']));
create policy audit_clinical_insert on public.audit_events for insert to authenticated with check (actor_user_id = auth.uid() and public.is_org_member(organization_id));

-- Prevent direct authenticated clients from editing or deleting a note, or inserting a final note.
-- Revisions and approvals must flow through the version-checked SECURITY DEFINER transactions above.
revoke all on public.clinical_notes from anon, authenticated;
grant select, insert on public.clinical_notes to authenticated;
revoke insert, update, delete on public.approvals from anon, authenticated;
grant select on public.approvals to authenticated;

-- No end user should rewrite its own org/role membership to elevate privileges.
revoke insert, update, delete on public.organizations from anon, authenticated;
revoke insert, update, delete on public.organization_memberships from anon, authenticated;
revoke execute on function public.create_clinic(text,text,text) from public, anon;
grant execute on function public.create_clinic(text,text,text) to authenticated;

-- Private audio storage: keys are <organization UUID>/<recording UUID>/<chunk file>.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('clinical-audio-private','clinical-audio-private',false,12582912,array['audio/webm','audio/ogg','audio/wav','audio/mpeg','audio/mp4'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy sinan_audio_select_member on storage.objects for select to authenticated
using (
  bucket_id = 'clinical-audio-private'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
  and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner','clinic_admin','dentist','clinician'])
  and exists (select 1 from public.recording_sessions rs where rs.id = ((storage.foldername(name))[2])::uuid and rs.organization_id = ((storage.foldername(name))[1])::uuid and rs.created_by = auth.uid())
);
create policy sinan_audio_insert_clinical on storage.objects for insert to authenticated
with check (
  bucket_id = 'clinical-audio-private'
  and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner','clinic_admin','dentist','clinician'])
  and exists (select 1 from public.recording_sessions rs where rs.id = ((storage.foldername(name))[2])::uuid and rs.organization_id = ((storage.foldername(name))[1])::uuid and rs.created_by = auth.uid() and rs.capture_state in ('capturing','paused','uploading'))
);
create policy sinan_audio_update_clinical on storage.objects for update to authenticated
using (
  bucket_id = 'clinical-audio-private'
  and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner','clinic_admin','dentist','clinician'])
  and exists (select 1 from public.recording_sessions rs where rs.id = ((storage.foldername(name))[2])::uuid and rs.organization_id = ((storage.foldername(name))[1])::uuid and rs.created_by = auth.uid() and rs.capture_state in ('capturing','paused','uploading'))
)
with check (
  bucket_id = 'clinical-audio-private'
  and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner','clinic_admin','dentist','clinician'])
  and exists (select 1 from public.recording_sessions rs where rs.id = ((storage.foldername(name))[2])::uuid and rs.organization_id = ((storage.foldername(name))[1])::uuid and rs.created_by = auth.uid() and rs.capture_state in ('capturing','paused','uploading'))
);

commit;
