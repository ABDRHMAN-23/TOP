-- No-login audio capture is restricted to the isolated per-browser test workspace.
-- It never writes to the protected production recording/session/note tables.

create table if not exists public.sinan_test_recordings (
  id uuid primary key default gen_random_uuid(),
  workspace_token uuid not null,
  patient_id uuid not null references public.sinan_test_patients(id) on delete cascade,
  encounter_id uuid not null default gen_random_uuid(),
  content_type text not null check (content_type in ('audio/webm','audio/ogg','audio/wav','audio/mpeg','audio/mp4')),
  status text not null default 'capturing' check (status in ('capturing','paused','uploading','processing','needs_review','failed')),
  consent_confirmed boolean not null default false check (consent_confirmed is true),
  consent_policy_version text not null default 'clinic-policy-v1' check (char_length(consent_policy_version) between 1 and 60),
  consented_at timestamptz not null default now(),
  transcript_text text,
  draft_json jsonb check (draft_json is null or jsonb_typeof(draft_json) = 'object'),
  chunk_count integer not null default 0 check (chunk_count >= 0 and chunk_count <= 2000),
  total_bytes bigint not null default 0 check (total_bytes >= 0 and total_bytes <= 8388608),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (workspace_token, id),
  unique (workspace_token, encounter_id)
);

create index if not exists sinan_test_recordings_workspace_created
  on public.sinan_test_recordings(workspace_token, created_at desc);

create table if not exists public.sinan_test_recording_chunks (
  workspace_token uuid not null,
  recording_id uuid not null,
  chunk_index integer not null check (chunk_index between 0 and 2000),
  audio_bytes bytea not null check (octet_length(audio_bytes) between 1 and 30000),
  mime_type text not null check (mime_type in ('audio/webm','audio/ogg','audio/wav','audio/mpeg','audio/mp4')),
  created_at timestamptz not null default now(),
  primary key (workspace_token, recording_id, chunk_index),
  foreign key (workspace_token, recording_id)
    references public.sinan_test_recordings(workspace_token, id) on delete cascade
);

alter table public.sinan_test_recordings enable row level security;
alter table public.sinan_test_recording_chunks enable row level security;
revoke all on table public.sinan_test_recordings from public, anon, authenticated;
revoke all on table public.sinan_test_recording_chunks from public, anon, authenticated;

create or replace function public.sinan_test_start_recording(
  p_workspace_token uuid,
  p_patient_id uuid,
  p_content_type text,
  p_consent_confirmed boolean,
  p_policy_version text default 'clinic-policy-v1'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_recording_id uuid := gen_random_uuid();
  v_encounter_id uuid := gen_random_uuid();
  v_content_type text := lower(split_part(coalesce(p_content_type, 'audio/webm'), ';', 1));
  v_policy text := coalesce(nullif(btrim(p_policy_version), ''), 'clinic-policy-v1');
  v_patient_name text;
begin
  if p_workspace_token is null or p_patient_id is null then
    raise exception 'workspace and patient are required' using errcode = '22023';
  end if;
  if p_consent_confirmed is distinct from true then
    raise exception 'recording consent is required' using errcode = '42501';
  end if;
  if v_content_type <> all(array['audio/webm','audio/ogg','audio/wav','audio/mpeg','audio/mp4']) then
    raise exception 'unsupported audio type' using errcode = '22023';
  end if;
  if char_length(v_policy) > 60 then raise exception 'invalid consent policy version' using errcode = '22023'; end if;

  select p.full_name into v_patient_name
  from public.sinan_test_patients p
  where p.id = p_patient_id and p.workspace_token = p_workspace_token;
  if not found then raise exception 'patient not found in this workspace' using errcode = 'P0002'; end if;

  insert into public.sinan_test_recordings(
    id, workspace_token, patient_id, encounter_id, content_type, status,
    consent_confirmed, consent_policy_version, consented_at
  ) values (
    v_recording_id, p_workspace_token, p_patient_id, v_encounter_id, v_content_type, 'capturing',
    true, v_policy, now()
  );

  insert into public.sinan_test_workspace_records(
    workspace_token, resource_type, record_id, patient_id, payload, created_at, updated_at
  ) values (
    p_workspace_token, 'encounters', v_encounter_id, p_patient_id,
    jsonb_build_object(
      'patient_id', p_patient_id, 'encounter_type', 'dental_visit',
      'status', 'draft', 'source', 'voice_recording',
      'recording_id', v_recording_id, 'consent_confirmed', true,
      'consent_policy_version', v_policy, 'consented_at', now()
    ), now(), now()
  );

  return jsonb_build_object(
    'recording_id', v_recording_id, 'encounter_id', v_encounter_id,
    'status', 'capturing', 'patient_id', p_patient_id,
    'consent_confirmed', true, 'consented_at', now()
  );
end;
$$;

create or replace function public.sinan_test_save_recording_chunk(
  p_workspace_token uuid,
  p_recording_id uuid,
  p_chunk_index integer,
  p_audio_base64 text,
  p_mime_type text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_bytes bytea;
  v_mime text := lower(split_part(coalesce(p_mime_type, 'audio/webm'), ';', 1));
  v_count integer;
  v_total bigint;
  v_status text;
begin
  if p_workspace_token is null or p_recording_id is null or p_chunk_index is null or p_chunk_index < 0 or p_chunk_index > 2000 then
    raise exception 'invalid recording chunk coordinates' using errcode = '22023';
  end if;
  if p_audio_base64 is null or length(p_audio_base64) < 4 or length(p_audio_base64) > 40000
     or p_audio_base64 !~ '^[A-Za-z0-9+/]*={0,2}$' then
    raise exception 'audio chunk encoding or size is invalid' using errcode = '22023';
  end if;
  if v_mime <> all(array['audio/webm','audio/ogg','audio/wav','audio/mpeg','audio/mp4']) then
    raise exception 'unsupported audio type' using errcode = '22023';
  end if;
  v_bytes := decode(p_audio_base64, 'base64');
  if octet_length(v_bytes) < 1 or octet_length(v_bytes) > 30000 then
    raise exception 'audio chunk exceeds the 30 KB test-workspace limit' using errcode = '22023';
  end if;

  select r.status into v_status from public.sinan_test_recordings r
   where r.id = p_recording_id and r.workspace_token = p_workspace_token for update;
  if not found then raise exception 'recording not found in this workspace' using errcode = 'P0002'; end if;
  if v_status not in ('capturing','paused') then
    raise exception 'recording is not accepting more audio chunks' using errcode = '22023';
  end if;

  insert into public.sinan_test_recording_chunks(workspace_token, recording_id, chunk_index, audio_bytes, mime_type)
  values (p_workspace_token, p_recording_id, p_chunk_index, v_bytes, v_mime)
  on conflict (workspace_token, recording_id, chunk_index)
  do update set audio_bytes = excluded.audio_bytes, mime_type = excluded.mime_type, created_at = now();

  select count(*)::integer, coalesce(sum(octet_length(c.audio_bytes)),0)::bigint
    into v_count, v_total
  from public.sinan_test_recording_chunks c
  where c.workspace_token = p_workspace_token and c.recording_id = p_recording_id;

  if v_total > 8388608 then
    raise exception 'recording exceeds the 8 MB direct-workspace limit' using errcode = '22023';
  end if;

  update public.sinan_test_recordings
    set chunk_count = v_count, total_bytes = v_total, updated_at = now()
    where id = p_recording_id and workspace_token = p_workspace_token;
  return jsonb_build_object('recording_id', p_recording_id, 'chunk_index', p_chunk_index, 'stored', true, 'chunk_count', v_count, 'total_bytes', v_total);
end;
$$;

create or replace function public.sinan_test_update_recording_state(
  p_workspace_token uuid,
  p_recording_id uuid,
  p_target_state text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_record public.sinan_test_recordings%rowtype;
begin
  if p_workspace_token is null or p_recording_id is null then raise exception 'workspace and recording are required' using errcode = '22023'; end if;
  if p_target_state <> all(array['paused','capturing','uploading','processing','needs_review','failed']) then
    raise exception 'invalid recording state' using errcode = '22023';
  end if;
  select * into v_record from public.sinan_test_recordings r
   where r.id = p_recording_id and r.workspace_token = p_workspace_token for update;
  if not found then raise exception 'recording not found in this workspace' using errcode = 'P0002'; end if;
  if v_record.status = p_target_state then
    return jsonb_build_object('recording_id', v_record.id, 'encounter_id', v_record.encounter_id, 'status', v_record.status, 'unchanged', true);
  end if;

  if p_target_state = 'paused' and v_record.status not in ('capturing') then
    raise exception 'recording cannot pause from the current state' using errcode = '22023';
  elsif p_target_state = 'capturing' and v_record.status <> 'paused' then
    raise exception 'recording cannot resume from the current state' using errcode = '22023';
  elsif p_target_state = 'uploading' then
    if v_record.status not in ('capturing','paused') or v_record.chunk_count < 1 then
      raise exception 'recording needs at least one saved audio chunk before finishing' using errcode = '22023';
    end if;
  elsif p_target_state = 'processing' and v_record.status not in ('uploading','failed') then
    raise exception 'recording is not ready for processing' using errcode = '22023';
  elsif p_target_state = 'needs_review' and v_record.status <> 'processing' then
    raise exception 'recording must be processing before it can enter review' using errcode = '22023';
  elsif p_target_state = 'failed' and v_record.status not in ('processing','uploading') then
    raise exception 'recording cannot be marked failed from the current state' using errcode = '22023';
  end if;

  update public.sinan_test_recordings
    set status = p_target_state,
        finished_at = case when p_target_state = 'uploading' then coalesce(finished_at, now()) else finished_at end,
        updated_at = now()
    where id = p_recording_id and workspace_token = p_workspace_token;

  select * into v_record from public.sinan_test_recordings r
   where r.id = p_recording_id and r.workspace_token = p_workspace_token;
  return jsonb_build_object('recording_id', v_record.id, 'encounter_id', v_record.encounter_id, 'status', v_record.status, 'chunk_count', v_record.chunk_count, 'total_bytes', v_record.total_bytes);
end;
$$;

create or replace function public.sinan_test_get_recording(p_workspace_token uuid, p_recording_id uuid)
returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'recording_id', r.id, 'encounter_id', r.encounter_id, 'patient_id', r.patient_id,
    'content_type', r.content_type, 'status', r.status,
    'consent_confirmed', r.consent_confirmed, 'consent_policy_version', r.consent_policy_version,
    'consented_at', r.consented_at, 'chunk_count', r.chunk_count, 'total_bytes', r.total_bytes,
    'transcript_text', r.transcript_text, 'draft_json', r.draft_json,
    'created_at', r.created_at, 'finished_at', r.finished_at
  )
  from public.sinan_test_recordings r
  where r.id = p_recording_id and r.workspace_token = p_workspace_token;
$$;

create or replace function public.sinan_test_list_recording_chunks(p_workspace_token uuid, p_recording_id uuid)
returns jsonb
language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'chunk_index', c.chunk_index, 'mime_type', c.mime_type,
      'audio_base64', encode(c.audio_bytes, 'base64')
    ) order by c.chunk_index
  ), '[]'::jsonb)
  from public.sinan_test_recording_chunks c
  join public.sinan_test_recordings r
    on r.id = c.recording_id and r.workspace_token = c.workspace_token
  where c.workspace_token = p_workspace_token and c.recording_id = p_recording_id
    and r.total_bytes <= 8388608;
$$;

create or replace function public.sinan_test_save_recording_result(
  p_workspace_token uuid,
  p_recording_id uuid,
  p_transcript text,
  p_draft_json jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_record public.sinan_test_recordings%rowtype;
  v_saved_at timestamptz := now();
begin
  if p_workspace_token is null or p_recording_id is null then raise exception 'workspace and recording are required' using errcode = '22023'; end if;
  if p_transcript is null or char_length(p_transcript) < 1 or char_length(p_transcript) > 150000 then
    raise exception 'transcript is empty or too long' using errcode = '22023';
  end if;
  if p_draft_json is null or jsonb_typeof(p_draft_json) <> 'object' or pg_column_size(p_draft_json) > 32768 then
    raise exception 'clinical draft payload is invalid or too large' using errcode = '22023';
  end if;
  update public.sinan_test_recordings
    set transcript_text = p_transcript, draft_json = p_draft_json, status = 'needs_review',
        finished_at = coalesce(finished_at, v_saved_at), updated_at = v_saved_at
    where id = p_recording_id and workspace_token = p_workspace_token and status = 'processing'
    returning * into v_record;
  if not found then raise exception 'recording must be processing before saving result' using errcode = '22023'; end if;

  update public.sinan_test_workspace_records
    set payload = payload || jsonb_build_object(
      'recording_id', v_record.id, 'status', 'needs_review',
      'transcript_preview', left(p_transcript, 1200), 'draft_json', p_draft_json
    ), updated_at = v_saved_at
    where workspace_token = p_workspace_token and resource_type = 'encounters'
      and record_id = v_record.encounter_id and patient_id = v_record.patient_id;
  return jsonb_build_object(
    'recording_id', v_record.id, 'encounter_id', v_record.encounter_id,
    'status', v_record.status, 'transcript_text', v_record.transcript_text,
    'draft_json', v_record.draft_json, 'saved_at', v_saved_at
  );
end;
$$;

revoke all on function public.sinan_test_start_recording(uuid,uuid,text,boolean,text) from public;
revoke all on function public.sinan_test_save_recording_chunk(uuid,uuid,integer,text,text) from public;
revoke all on function public.sinan_test_update_recording_state(uuid,uuid,text) from public;
revoke all on function public.sinan_test_get_recording(uuid,uuid) from public;
revoke all on function public.sinan_test_list_recording_chunks(uuid,uuid) from public;
revoke all on function public.sinan_test_save_recording_result(uuid,uuid,text,jsonb) from public;
grant execute on function public.sinan_test_start_recording(uuid,uuid,text,boolean,text) to anon, authenticated;
grant execute on function public.sinan_test_save_recording_chunk(uuid,uuid,integer,text,text) to anon, authenticated;
grant execute on function public.sinan_test_update_recording_state(uuid,uuid,text) to anon, authenticated;
grant execute on function public.sinan_test_get_recording(uuid,uuid) to anon, authenticated;
grant execute on function public.sinan_test_list_recording_chunks(uuid,uuid) to anon, authenticated;
grant execute on function public.sinan_test_save_recording_result(uuid,uuid,text,jsonb) to anon, authenticated;