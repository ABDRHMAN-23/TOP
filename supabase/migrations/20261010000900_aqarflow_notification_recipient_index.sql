-- Follow-up performance fix for the notification recipient foreign key.
-- Kept separate because migration 008 has already been applied to the connected Supabase project.
begin;
create index if not exists aqarflow_notifications_recipient_fk_idx
  on public.aqarflow_crm_notifications(recipient_user_id);
commit;
