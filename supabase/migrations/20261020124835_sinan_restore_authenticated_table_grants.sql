-- Restore baseline SQL grants needed by Sinan's authenticated REST API.
-- Detailed least-privilege restrictions are applied in the following migration.
begin;

grant usage on schema public to authenticated;

grant select, insert, update on table
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
to authenticated;

-- DELETE has an explicit role-aware RLS policy on appointments.
grant delete on table public.appointments to authenticated;

commit;
