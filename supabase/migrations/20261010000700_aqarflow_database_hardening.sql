-- AqarFlow post-deployment database hardening.
-- Keep service-role-only tables deny-by-default, force RLS on user-facing inventory,
-- and add indexes for foreign-key maintenance as well as common workspace filters.
begin;

alter table public.aqarflow_workspace_memberships force row level security;
alter table public.aqarflow_properties force row level security;
alter table public.aqarflow_ai_usage force row level security;

create index if not exists aqarflow_crm_contact_notes_author_fk_idx
  on public.aqarflow_crm_contact_notes(author_user_id);
create index if not exists aqarflow_crm_conversations_contact_fk_idx
  on public.aqarflow_crm_conversations(contact_id);
create index if not exists aqarflow_crm_conversations_integration_fk_idx
  on public.aqarflow_crm_conversations(integration_id);
create index if not exists aqarflow_crm_messages_conversation_fk_idx
  on public.aqarflow_crm_messages(conversation_id);
create index if not exists aqarflow_crm_tasks_assigned_to_fk_idx
  on public.aqarflow_crm_tasks(assigned_to);
create index if not exists aqarflow_crm_tasks_created_by_fk_idx
  on public.aqarflow_crm_tasks(created_by);
create index if not exists aqarflow_crm_tasks_owner_conversation_contact_fk_idx
  on public.aqarflow_crm_tasks(owner_user_id,conversation_id,contact_id);
create index if not exists aqarflow_crm_viewings_created_by_fk_idx
  on public.aqarflow_crm_viewings(created_by);
create index if not exists aqarflow_whatsapp_events_integration_fk_idx
  on public.aqarflow_whatsapp_events(integration_id);
create index if not exists aqarflow_whatsapp_outbound_integration_fk_idx
  on public.aqarflow_whatsapp_outbound_requests(integration_id);

commit;
