begin;

alter table public.patients
  add column if not exists reported_age_years smallint
    check (reported_age_years is null or reported_age_years between 1 and 120);

alter table public.appointments
  alter column patient_id drop not null,
  alter column created_by drop not null;

alter table public.appointments
  add column if not exists patient_name_snapshot text,
  add column if not exists patient_age_years smallint
    check (patient_age_years is null or patient_age_years between 1 and 120),
  add column if not exists patient_phone_snapshot text,
  add column if not exists booking_source text not null default 'staff',
  add column if not exists booking_status text not null default 'not_applicable',
  add column if not exists booking_reference text,
  add column if not exists booking_idempotency_key text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='appointments_booking_source_check') then
    alter table public.appointments add constraint appointments_booking_source_check
      check (booking_source in ('staff','public_link'));
  end if;
  if not exists (select 1 from pg_constraint where conname='appointments_booking_status_check') then
    alter table public.appointments add constraint appointments_booking_status_check
      check (booking_status in ('not_applicable','requested','confirmed','declined'));
  end if;
  if not exists (select 1 from pg_constraint where conname='appointments_public_request_snapshot_check') then
    alter table public.appointments add constraint appointments_public_request_snapshot_check
      check (
        (booking_source='staff' and patient_id is not null and booking_status='not_applicable')
        or
        (booking_source='public_link' and patient_name_snapshot is not null and patient_age_years is not null and patient_phone_snapshot is not null and booking_status in ('requested','confirmed','declined'))
      );
  end if;
end $$;

create unique index if not exists appointments_public_booking_reference_uidx
  on public.appointments(booking_reference) where booking_reference is not null;
create unique index if not exists appointments_public_booking_idempotency_uidx
  on public.appointments(organization_id, booking_idempotency_key) where booking_idempotency_key is not null;
create index if not exists appointments_public_request_schedule_idx
  on public.appointments(organization_id, scheduled_start, booking_status)
  where booking_source='public_link';
create index if not exists appointments_public_phone_schedule_idx
  on public.appointments(organization_id, patient_phone_snapshot, scheduled_start)
  where booking_source='public_link';

create table if not exists public.clinic_booking_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  public_slug text not null unique check (public_slug ~ '^[a-z0-9][a-z0-9-]{2,49}$'),
  booking_enabled boolean not null default false,
  slot_minutes smallint not null default 30 check (slot_minutes in (10,15,20,30,45,60)),
  max_bookings_per_slot smallint not null default 1 check (max_bookings_per_slot between 1 and 25),
  advance_booking_days smallint not null default 30 check (advance_booking_days between 1 and 180),
  min_notice_minutes integer not null default 60 check (min_notice_minutes between 0 and 10080),
  public_title_ar text,
  public_title_en text,
  public_message_ar text,
  public_message_en text,
  require_phone boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_booking_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  shift text not null check (shift in ('morning','evening')),
  enabled boolean not null default false,
  start_time time not null default '08:00',
  end_time time not null default '12:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_booking_hours_valid_range check (end_time > start_time),
  constraint clinic_booking_hours_unique_shift unique (organization_id, weekday, shift)
);

alter table public.clinic_booking_settings enable row level security;
alter table public.clinic_booking_hours enable row level security;
drop policy if exists clinic_booking_settings_member_read on public.clinic_booking_settings;
create policy clinic_booking_settings_member_read on public.clinic_booking_settings
  for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists clinic_booking_hours_member_read on public.clinic_booking_hours;
create policy clinic_booking_hours_member_read on public.clinic_booking_hours
  for select to authenticated using (public.is_org_member(organization_id));
revoke all on public.clinic_booking_settings from anon, authenticated;
revoke all on public.clinic_booking_hours from anon, authenticated;
grant select on public.clinic_booking_settings to authenticated;
grant select on public.clinic_booking_hours to authenticated;

create or replace view public.patient_directory
with (security_invoker = true)
as
select id, organization_id, patient_number, full_name, date_of_birth, phone,
       record_status, created_at, updated_at, reported_age_years
from public.patients
where public.is_org_member(organization_id) and deleted_at is null;

create or replace function public.save_clinic_booking_settings(
  p_organization_id uuid,
  p_settings jsonb,
  p_hours jsonb
) returns jsonb
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_settings public.clinic_booking_settings%rowtype;
  v_row jsonb;
  v_weekday integer;
  v_shift text;
  v_enabled boolean;
  v_start time;
  v_end time;
  v_enabled_count integer := 0;
  v_hours jsonb;
begin
  if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not public.has_org_role(p_organization_id, array['owner','clinic_admin','dentist','clinician']) then
    raise exception 'booking settings permission required' using errcode='42501';
  end if;
  if jsonb_typeof(p_settings) <> 'object' or jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) <> 14 then
    raise exception 'invalid booking settings payload' using errcode='22023';
  end if;
  if coalesce(p_settings->>'public_slug','') !~ '^[a-z0-9][a-z0-9-]{2,49}$' then
    raise exception 'invalid public booking link' using errcode='22023';
  end if;
  if coalesce((p_settings->>'slot_minutes')::integer,0) not in (10,15,20,30,45,60)
    or coalesce((p_settings->>'max_bookings_per_slot')::integer,0) not between 1 and 25
    or coalesce((p_settings->>'advance_booking_days')::integer,0) not between 1 and 180
    or coalesce((p_settings->>'min_notice_minutes')::integer,-1) not between 0 and 10080 then
    raise exception 'invalid slot capacity or booking window' using errcode='22023';
  end if;
  if char_length(coalesce(p_settings->>'public_title_ar','')) > 180
    or char_length(coalesce(p_settings->>'public_title_en','')) > 180
    or char_length(coalesce(p_settings->>'public_message_ar','')) > 600
    or char_length(coalesce(p_settings->>'public_message_en','')) > 600 then
    raise exception 'booking copy is too long' using errcode='22023';
  end if;

  for v_row in select value from jsonb_array_elements(p_hours)
  loop
    v_weekday := (v_row->>'weekday')::integer;
    v_shift := v_row->>'shift';
    v_enabled := coalesce((v_row->>'enabled')::boolean,false);
    if v_weekday not between 0 and 6 or v_shift not in ('morning','evening')
      or coalesce(v_row->>'start_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(v_row->>'end_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'invalid weekday, shift or time' using errcode='22023';
    end if;
    v_start := (v_row->>'start_time')::time;
    v_end := (v_row->>'end_time')::time;
    if v_end <= v_start then raise exception 'shift end must be after shift start' using errcode='22023'; end if;
    if v_enabled then v_enabled_count := v_enabled_count + 1; end if;
    if exists (
      select 1 from jsonb_array_elements(p_hours) as x(value)
      where (x.value->>'weekday')::integer = v_weekday
        and x.value->>'shift' = v_shift
        and x.value <> v_row
    ) then
      raise exception 'duplicate weekday shift' using errcode='22023';
    end if;
  end loop;

  if coalesce((p_settings->>'booking_enabled')::boolean,false) and v_enabled_count = 0 then
    raise exception 'at least one working shift is required before publishing' using errcode='22023';
  end if;

  insert into public.clinic_booking_settings(
    organization_id, public_slug, booking_enabled, slot_minutes, max_bookings_per_slot,
    advance_booking_days, min_notice_minutes, public_title_ar, public_title_en,
    public_message_ar, public_message_en, require_phone, created_by, updated_by
  ) values (
    p_organization_id, p_settings->>'public_slug',
    coalesce((p_settings->>'booking_enabled')::boolean,false),
    (p_settings->>'slot_minutes')::smallint,
    (p_settings->>'max_bookings_per_slot')::smallint,
    (p_settings->>'advance_booking_days')::smallint,
    (p_settings->>'min_notice_minutes')::integer,
    nullif(trim(p_settings->>'public_title_ar'),''),
    nullif(trim(p_settings->>'public_title_en'),''),
    nullif(trim(p_settings->>'public_message_ar'),''),
    nullif(trim(p_settings->>'public_message_en'),''),
    coalesce((p_settings->>'require_phone')::boolean,true),
    v_user, v_user
  )
  on conflict (organization_id) do update set
    public_slug=excluded.public_slug, booking_enabled=excluded.booking_enabled,
    slot_minutes=excluded.slot_minutes, max_bookings_per_slot=excluded.max_bookings_per_slot,
    advance_booking_days=excluded.advance_booking_days, min_notice_minutes=excluded.min_notice_minutes,
    public_title_ar=excluded.public_title_ar, public_title_en=excluded.public_title_en,
    public_message_ar=excluded.public_message_ar, public_message_en=excluded.public_message_en,
    require_phone=excluded.require_phone, updated_by=v_user, updated_at=now()
  returning * into v_settings;

  delete from public.clinic_booking_hours where organization_id=p_organization_id;
  for v_row in select value from jsonb_array_elements(p_hours)
  loop
    insert into public.clinic_booking_hours(organization_id,weekday,shift,enabled,start_time,end_time,updated_at)
    values(p_organization_id,(v_row->>'weekday')::smallint,v_row->>'shift',
      coalesce((v_row->>'enabled')::boolean,false),(v_row->>'start_time')::time,(v_row->>'end_time')::time,now());
  end loop;

  insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
  values(p_organization_id,v_user,'clinic.booking_settings_updated','clinic_booking_settings',p_organization_id,
    jsonb_build_object('booking_enabled',v_settings.booking_enabled,'slot_minutes',v_settings.slot_minutes,'capacity',v_settings.max_bookings_per_slot));

  select coalesce(jsonb_agg(jsonb_build_object(
    'weekday',weekday,'shift',shift,'enabled',enabled,
    'start_time',to_char(start_time,'HH24:MI'),'end_time',to_char(end_time,'HH24:MI')
  ) order by weekday,shift),'[]'::jsonb) into v_hours
  from public.clinic_booking_hours where organization_id=p_organization_id;

  return jsonb_build_object('settings',to_jsonb(v_settings),'hours',v_hours);
end;
$$;

create or replace function public.get_public_booking_info(p_slug text)
returns jsonb
language plpgsql stable security definer
set search_path = public, auth, pg_temp
as $$
declare v_booking public.clinic_booking_settings%rowtype; v_org public.organizations%rowtype; v_hours jsonb;
begin
  select * into v_booking from public.clinic_booking_settings
    where public_slug=lower(trim(coalesce(p_slug,''))) and booking_enabled=true;
  if not found then return null; end if;
  select * into v_org from public.organizations where id=v_booking.organization_id;
  select coalesce(jsonb_agg(jsonb_build_object('weekday',weekday,'shift',shift,'start_time',to_char(start_time,'HH24:MI'),'end_time',to_char(end_time,'HH24:MI'))
    order by weekday,shift),'[]'::jsonb) into v_hours
    from public.clinic_booking_hours where organization_id=v_booking.organization_id and enabled=true;
  return jsonb_build_object(
    'clinic_name_ar',v_org.name,'clinic_name_en',coalesce(v_org.name_en,v_org.name),
    'title_ar',coalesce(v_booking.public_title_ar,v_org.name),'title_en',coalesce(v_booking.public_title_en,v_org.name_en,v_org.name),
    'message_ar',v_booking.public_message_ar,'message_en',v_booking.public_message_en,
    'timezone',v_org.timezone,'slot_minutes',v_booking.slot_minutes,
    'advance_booking_days',v_booking.advance_booking_days,'min_notice_minutes',v_booking.min_notice_minutes,
    'require_phone',v_booking.require_phone,'hours',v_hours
  );
end;
$$;

create or replace function public.get_public_booking_slots(p_slug text,p_date date)
returns jsonb
language plpgsql stable security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_booking public.clinic_booking_settings%rowtype;
  v_org public.organizations%rowtype;
  v_local_slot timestamp without time zone;
  v_local_end timestamp without time zone;
  v_start timestamptz;
  v_end timestamptz;
  v_count integer;
  v_slots jsonb := '[]'::jsonb;
  v_hours record;
begin
  select * into v_booking from public.clinic_booking_settings
    where public_slug=lower(trim(coalesce(p_slug,''))) and booking_enabled=true;
  if not found then return jsonb_build_object('available',false,'slots','[]'::jsonb); end if;
  select * into v_org from public.organizations where id=v_booking.organization_id;
  if p_date < (now() at time zone v_org.timezone)::date
    or p_date > (now() at time zone v_org.timezone)::date + v_booking.advance_booking_days then
    return jsonb_build_object('available',true,'timezone',v_org.timezone,'date',p_date,'slots','[]'::jsonb);
  end if;
  for v_hours in select weekday,start_time,end_time from public.clinic_booking_hours
    where organization_id=v_booking.organization_id and enabled=true and weekday=extract(dow from p_date)::integer
    order by start_time
  loop
    v_local_slot := p_date + v_hours.start_time;
    v_local_end := p_date + v_hours.end_time;
    while v_local_slot + make_interval(mins=>v_booking.slot_minutes) <= v_local_end loop
      v_start := v_local_slot at time zone v_org.timezone;
      v_end := (v_local_slot + make_interval(mins=>v_booking.slot_minutes)) at time zone v_org.timezone;
      select count(*)::integer into v_count from public.appointments a
        where a.organization_id=v_booking.organization_id
          and a.scheduled_start < v_end and a.scheduled_end > v_start
          and a.status not in ('cancelled','no_show')
          and coalesce(a.booking_status,'not_applicable') <> 'declined';
      if v_count < v_booking.max_bookings_per_slot and v_start >= now()+make_interval(mins=>v_booking.min_notice_minutes) then
        v_slots := v_slots || jsonb_build_array(jsonb_build_object(
          'start_at',v_start,'end_at',v_end,'time',to_char(v_local_slot,'HH24:MI'),
          'remaining',v_booking.max_bookings_per_slot-v_count
        ));
      end if;
      v_local_slot := v_local_slot + make_interval(mins=>v_booking.slot_minutes);
    end loop;
  end loop;
  return jsonb_build_object('available',true,'timezone',v_org.timezone,'date',p_date,'slot_minutes',v_booking.slot_minutes,'slots',v_slots);
end;
$$;

create or replace function public.create_public_booking_request(
  p_slug text,
  p_full_name text,
  p_age_years integer,
  p_phone text,
  p_scheduled_start timestamptz,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_booking public.clinic_booking_settings%rowtype;
  v_org public.organizations%rowtype;
  v_hours record;
  v_name text := trim(coalesce(p_full_name,''));
  v_phone text := regexp_replace(trim(coalesce(p_phone,'')),'[^0-9+]','','g');
  v_digits text := regexp_replace(trim(coalesce(p_phone,'')),'[^0-9]','','g');
  v_local_start timestamp without time zone;
  v_start timestamptz := p_scheduled_start;
  v_end timestamptz;
  v_count integer;
  v_phone_count integer;
  v_reference text;
  v_appointment public.appointments%rowtype;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 120 or v_name ~ '[<>]' then
    raise exception 'invalid patient name' using errcode='22023';
  end if;
  if p_age_years is null or p_age_years not between 1 and 120 then
    raise exception 'invalid patient age' using errcode='22023';
  end if;
  if char_length(v_digits) < 7 or char_length(v_digits) > 15 then
    raise exception 'valid phone number required' using errcode='22023';
  end if;
  if coalesce(p_idempotency_key,'') !~ '^[0-9a-fA-F-]{36}$' then
    raise exception 'invalid booking request key' using errcode='22023';
  end if;

  select * into v_booking from public.clinic_booking_settings
    where public_slug=lower(trim(coalesce(p_slug,''))) and booking_enabled=true
    for update;
  if not found then raise exception 'booking is not available' using errcode='P0002'; end if;

  select * into v_org from public.organizations where id=v_booking.organization_id;
  v_local_start := v_start at time zone v_org.timezone;
  v_end := v_start + make_interval(mins=>v_booking.slot_minutes);
  if v_local_start <= (now() at time zone v_org.timezone)
    or v_local_start::date > (now() at time zone v_org.timezone)::date + v_booking.advance_booking_days
    or v_start < now()+make_interval(mins=>v_booking.min_notice_minutes) then
    raise exception 'selected appointment time is no longer available' using errcode='22023';
  end if;
  if p_scheduled_start is null or date_trunc('minute',v_local_start) <> v_local_start then
    raise exception 'invalid appointment start time' using errcode='22023';
  end if;

  select * into v_hours from public.clinic_booking_hours h
    where h.organization_id=v_booking.organization_id
      and h.weekday=extract(dow from v_local_start::date)::integer
      and h.enabled=true
      and v_local_start::time >= h.start_time
      and v_local_start::time + make_interval(mins=>v_booking.slot_minutes) <= h.end_time
    order by h.start_time limit 1;
  if not found then raise exception 'selected time is outside clinic hours' using errcode='22023'; end if;
  if mod(extract(epoch from (v_local_start-(v_local_start::date+v_hours.start_time)))::integer,v_booking.slot_minutes*60) <> 0 then
    raise exception 'selected time is not a valid appointment slot' using errcode='22023';
  end if;

  select * into v_appointment from public.appointments
    where organization_id=v_booking.organization_id and booking_idempotency_key=p_idempotency_key;
  if found then
    return jsonb_build_object('reference',v_appointment.booking_reference,'start_at',v_appointment.scheduled_start,'status',v_appointment.booking_status,'reused',true);
  end if;

  select count(*)::integer into v_phone_count from public.appointments a
    where a.organization_id=v_booking.organization_id and a.booking_source='public_link'
      and a.patient_phone_snapshot is not null
      and regexp_replace(a.patient_phone_snapshot,'[^0-9]','','g')=v_digits
      and (a.scheduled_start at time zone v_org.timezone)::date=v_local_start::date
      and a.status not in ('cancelled','no_show') and a.booking_status <> 'declined';
  if v_phone_count >= 3 then raise exception 'daily phone booking limit reached' using errcode='22023'; end if;

  select count(*)::integer into v_count from public.appointments a
    where a.organization_id=v_booking.organization_id
      and a.scheduled_start < v_end and a.scheduled_end > v_start
      and a.status not in ('cancelled','no_show')
      and coalesce(a.booking_status,'not_applicable') <> 'declined';
  if v_count >= v_booking.max_bookings_per_slot then
    raise exception 'selected appointment time is no longer available' using errcode='P0002';
  end if;

  v_reference := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.appointments(
    organization_id,patient_id,clinician_id,scheduled_start,scheduled_end,timezone,
    appointment_type,status,note,created_by,updated_by,booking_source,booking_status,
    patient_name_snapshot,patient_age_years,patient_phone_snapshot,booking_reference,booking_idempotency_key
  ) values (
    v_booking.organization_id,null,null,v_start,v_end,v_org.timezone,
    'dental_consultation','scheduled',null,null,null,'public_link','requested',
    v_name,p_age_years,v_phone,v_reference,p_idempotency_key
  ) returning * into v_appointment;

  insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
    values(v_booking.organization_id,null,'appointment.public_booking_requested','appointment',v_appointment.id,
      jsonb_build_object('booking_reference',v_reference,'source','public_link'));

  return jsonb_build_object('reference',v_reference,'start_at',v_appointment.scheduled_start,'status',v_appointment.booking_status,'reused',false);
end;
$$;

create or replace function public.resolve_public_booking_request(
  p_organization_id uuid,
  p_appointment_id uuid,
  p_action text
) returns jsonb
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_appointment public.appointments%rowtype;
  v_patient_id uuid;
  v_patient public.patients%rowtype;
begin
  if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not public.has_org_role(p_organization_id,array['owner','clinic_admin','dentist','clinician','receptionist']) then
    raise exception 'appointment booking review permission required' using errcode='42501';
  end if;
  if p_action not in ('confirm','decline') then raise exception 'invalid booking action' using errcode='22023'; end if;
  select * into v_appointment from public.appointments
    where id=p_appointment_id and organization_id=p_organization_id and booking_source='public_link'
    for update;
  if not found then raise exception 'booking request not found' using errcode='P0002'; end if;
  if v_appointment.booking_status='confirmed' and p_action='confirm' then
    return jsonb_build_object('status','confirmed','appointment_id',v_appointment.id,'patient_id',v_appointment.patient_id,'reused',true);
  end if;
  if v_appointment.booking_status='declined' and p_action='decline' then
    return jsonb_build_object('status','declined','appointment_id',v_appointment.id,'reused',true);
  end if;
  if v_appointment.booking_status <> 'requested' then raise exception 'booking request has already been reviewed' using errcode='22023'; end if;

  if p_action='decline' then
    update public.appointments set booking_status='declined',status='cancelled',updated_by=v_user,updated_at=now()
      where id=v_appointment.id;
    insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
      values(p_organization_id,v_user,'appointment.public_booking_declined','appointment',v_appointment.id,jsonb_build_object('booking_reference',v_appointment.booking_reference));
    return jsonb_build_object('status','declined','appointment_id',v_appointment.id,'reused',false);
  end if;

  insert into public.patients(
    organization_id,patient_number,full_name,reported_age_years,sex,phone,record_status,created_by,updated_by
  ) values (
    p_organization_id,null,v_appointment.patient_name_snapshot,v_appointment.patient_age_years,'unspecified',
    v_appointment.patient_phone_snapshot,'active',v_user,v_user
  ) returning * into v_patient;

  update public.appointments set patient_id=v_patient.id, status='confirmed', booking_status='confirmed',
    updated_by=v_user,updated_at=now()
    where id=v_appointment.id;
  insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
    values(p_organization_id,v_user,'appointment.public_booking_confirmed','appointment',v_appointment.id,
      jsonb_build_object('booking_reference',v_appointment.booking_reference,'patient_id',v_patient.id));
  return jsonb_build_object('status','confirmed','appointment_id',v_appointment.id,'patient_id',v_patient.id,'patient_number',v_patient.patient_number,'reused',false);
end;
$$;

revoke all on function public.save_clinic_booking_settings(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.save_clinic_booking_settings(uuid,jsonb,jsonb) to authenticated;
revoke all on function public.get_public_booking_info(text) from public;
grant execute on function public.get_public_booking_info(text) to anon, authenticated;
revoke all on function public.get_public_booking_slots(text,date) from public;
grant execute on function public.get_public_booking_slots(text,date) to anon, authenticated;
revoke all on function public.create_public_booking_request(text,text,integer,text,timestamptz,text) from public;
grant execute on function public.create_public_booking_request(text,text,integer,text,timestamptz,text) to anon, authenticated;
revoke all on function public.resolve_public_booking_request(uuid,uuid,text) from public, anon;
grant execute on function public.resolve_public_booking_request(uuid,uuid,text) to authenticated;

commit;
