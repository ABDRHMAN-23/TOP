-- Sinan database security hardening.
-- Make the patient directory honor the querying user's table privileges and RLS.
begin;

create or replace view public.patient_directory
with (security_invoker = true)
as
select id, organization_id, patient_number, full_name, date_of_birth, phone,
       record_status, created_at, updated_at
from public.patients
where public.is_org_member(organization_id) and deleted_at is null;

revoke execute on function public.is_org_member(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
revoke execute on function public.has_org_role(uuid, text[]) from public, anon;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

revoke execute on function public.guard_encounter_approval() from public, anon, authenticated;

revoke execute on function public.approve_clinical_note(uuid, uuid, uuid, integer, text) from public, anon;
grant execute on function public.approve_clinical_note(uuid, uuid, uuid, integer, text) to authenticated;
revoke execute on function public.revise_clinical_note(uuid, uuid, integer, jsonb, text) from public, anon;
grant execute on function public.revise_clinical_note(uuid, uuid, integer, jsonb, text) to authenticated;
revoke execute on function public.start_clinical_recording(uuid, uuid, text, text) from public, anon;
grant execute on function public.start_clinical_recording(uuid, uuid, text, text) to authenticated;

commit;
