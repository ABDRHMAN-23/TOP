-- Tighten Sinan's authenticated grants to match the explicit API paths.
-- RLS remains enabled; these grants avoid bypassing append-only/transactional write paths.
begin;

revoke select, insert, update, delete on table
  public.organizations,
  public.organization_memberships,
  public.clinic_settings,
  public.clinicians,
  public.patients,
  public.patient_medical_history_items,
  public.appointments,
  public.encounters,
  public.recording_consents,
  public.recording_sessions,
  public.recording_chunks,
  public.ai_processing_jobs,
  public.transcript_segments,
  public.clinical_notes,
  public.clinical_facts,
  public.dental_tooth_entries,
  public.procedures,
  public.endodontic_cases,
  public.endodontic_canals,
  public.document_assets,
  public.reports,
  public.approvals,
  public.audit_events,
  public.clinic_booking_settings,
  public.clinic_booking_hours
from authenticated;

-- Read-only control plane: clinic and role membership are written by SECURITY DEFINER RPCs.
grant select on table public.organizations, public.organization_memberships to authenticated;

-- Clinic setup is updated through the existing authenticated clinic settings API.
grant select, insert, update on table public.clinic_settings to authenticated;
grant select, insert, update on table public.clinicians to authenticated;

-- Patient and clinical workflow tables.
grant select, insert, update on table public.patients to authenticated;
grant select, insert, update on table public.patient_medical_history_items to authenticated;
grant select, insert, update, delete on table public.appointments to authenticated;
grant select, insert, update on table public.encounters to authenticated;

-- Consent and recording-session creation remain atomic inside start_clinical_recording().
grant select on table public.recording_consents to authenticated;
grant select, update on table public.recording_sessions to authenticated;
grant select, insert, update on table public.recording_chunks to authenticated;
grant select, insert, update on table public.ai_processing_jobs to authenticated;

-- Transcript segments are append-only except for clearing segments of the current
-- user's active transcription job when a processing retry regenerates the transcript.
drop policy if exists transcript_clinical_access on public.transcript_segments;
create policy transcript_clinical_select on public.transcript_segments
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy transcript_clinical_insert on public.transcript_segments
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician']));
create policy transcript_retry_cleanup on public.transcript_segments
  for delete to authenticated
  using (
    public.has_org_role(organization_id, array['owner','clinic_admin','dentist','clinician'])
    and exists (
      select 1 from public.ai_processing_jobs j
      where j.id = source_job_id
        and j.organization_id = transcript_segments.organization_id
        and j.requested_by = auth.uid()
        and j.status = 'transcribing'
    )
  );
grant select, insert, delete on table public.transcript_segments to authenticated;

-- Clinical notes are immutable through the table API; revision/approval is via RPCs.
grant select, insert on table public.clinical_notes to authenticated;
grant select, insert, update on table public.clinical_facts to authenticated;
grant select, insert on table public.dental_tooth_entries to authenticated;
grant select, insert, update on table public.procedures to authenticated;
grant select, insert, update on table public.endodontic_cases, public.endodontic_canals to authenticated;
grant select, insert on table public.document_assets to authenticated;
grant select, insert on table public.reports to authenticated;
grant select on table public.approvals to authenticated;
grant select, insert on table public.audit_events to authenticated;

-- Booking writes run through save_clinic_booking_settings(); the app only reads these tables directly.
grant select on table public.clinic_booking_settings, public.clinic_booking_hours to authenticated;

commit;
