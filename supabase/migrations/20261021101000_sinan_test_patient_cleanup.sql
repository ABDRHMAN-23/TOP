-- Scoped cleanup for disposable no-login workspace patients.
-- It can only delete a patient and its associated isolated workspace records
-- when both the exact workspace token and patient ID are provided.

create or replace function public.sinan_test_delete_patient(
  p_workspace_token uuid,
  p_patient_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare deleted_count integer;
begin
  if p_workspace_token is null or p_patient_id is null then
    raise exception 'workspace token and patient id required' using errcode = '22023';
  end if;

  delete from public.sinan_test_workspace_records
  where workspace_token = p_workspace_token and patient_id = p_patient_id;

  delete from public.sinan_test_patients
  where workspace_token = p_workspace_token and id = p_patient_id;
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

revoke all on function public.sinan_test_delete_patient(uuid, uuid) from public;
grant execute on function public.sinan_test_delete_patient(uuid, uuid) to anon, authenticated;
