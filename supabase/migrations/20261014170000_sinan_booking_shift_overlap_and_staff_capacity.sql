begin;

create or replace function public.reject_overlapping_clinic_booking_hours()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.enabled and exists (
    select 1 from public.clinic_booking_hours h
    where h.organization_id=new.organization_id
      and h.weekday=new.weekday
      and h.enabled=true
      and h.id is distinct from new.id
      and new.start_time < h.end_time
      and new.end_time > h.start_time
  ) then
    raise exception 'working shifts on the same day may not overlap' using errcode='22023';
  end if;
  return new;
end;
$$;

drop trigger if exists clinic_booking_hours_no_overlap on public.clinic_booking_hours;
create trigger clinic_booking_hours_no_overlap
before insert or update of organization_id, weekday, enabled, start_time, end_time
on public.clinic_booking_hours
for each row execute function public.reject_overlapping_clinic_booking_hours();

create or replace function public.create_clinic_appointment(
  p_organization_id uuid,
  p_patient_id uuid,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz,
  p_timezone text default 'Asia/Aden',
  p_appointment_type text default 'dental_visit',
  p_note text default null
) returns jsonb
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_booking public.clinic_booking_settings%rowtype;
  v_patient public.patients%rowtype;
  v_appointment public.appointments%rowtype;
  v_overlaps integer := 0;
begin
  if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not public.has_org_role(p_organization_id,array['owner','clinic_admin','dentist','clinician','receptionist']) then
    raise exception 'appointment creation permission required' using errcode='42501';
  end if;
  if p_scheduled_start is null or p_scheduled_end is null or p_scheduled_end <= p_scheduled_start then
    raise exception 'invalid appointment time range' using errcode='22023';
  end if;
  if not exists (
    select 1 from pg_timezone_names where name=coalesce(nullif(trim(p_timezone),''),'Asia/Aden')
  ) then raise exception 'invalid appointment timezone' using errcode='22023'; end if;
  if coalesce(char_length(trim(p_appointment_type)),0)<2 or char_length(p_appointment_type)>80 then
    raise exception 'invalid appointment type' using errcode='22023';
  end if;
  if p_note is not null and char_length(p_note)>2000 then
    raise exception 'appointment note is too long' using errcode='22023';
  end if;

  select * into v_patient from public.patients
    where id=p_patient_id and organization_id=p_organization_id
      and deleted_at is null and record_status='active';
  if not found then raise exception 'patient not found in clinic' using errcode='P0002'; end if;

  -- The setting-row lock serializes manual appointments with public booking
  -- requests, even when public-link publishing is currently switched off.
  select * into v_booking from public.clinic_booking_settings
    where organization_id=p_organization_id
    for update;
  if found then
    select count(*)::integer into v_overlaps from public.appointments a
      where a.organization_id=p_organization_id
        and a.scheduled_start < p_scheduled_end
        and a.scheduled_end > p_scheduled_start
        and a.status not in ('cancelled','no_show')
        and coalesce(a.booking_status,'not_applicable') <> 'declined';
    if v_overlaps >= v_booking.max_bookings_per_slot then
      raise exception 'appointment capacity reached for this time' using errcode='P0002';
    end if;
  end if;

  insert into public.appointments(
    organization_id,patient_id,scheduled_start,scheduled_end,timezone,
    appointment_type,status,note,created_by,updated_by,booking_source,booking_status
  ) values (
    p_organization_id,p_patient_id,p_scheduled_start,p_scheduled_end,coalesce(nullif(trim(p_timezone),''),'Asia/Aden'),
    trim(p_appointment_type),'scheduled',nullif(trim(p_note),''),v_user,v_user,'staff','not_applicable'
  ) returning * into v_appointment;

  insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
    values(p_organization_id,v_user,'appointment.created','appointment',v_appointment.id,
      jsonb_build_object('source','staff','scheduled_start',v_appointment.scheduled_start,'scheduled_end',v_appointment.scheduled_end));

  return jsonb_build_object('appointment',to_jsonb(v_appointment));
end;
$$;

revoke all on function public.reject_overlapping_clinic_booking_hours() from public, anon, authenticated;
revoke all on function public.create_clinic_appointment(uuid,uuid,timestamptz,timestamptz,text,text,text) from public, anon;
grant execute on function public.create_clinic_appointment(uuid,uuid,timestamptz,timestamptz,text,text,text) to authenticated;

commit;
