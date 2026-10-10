-- AqarFlow CRM inbox extension on top of TOP's existing Supabase Auth/tenant ownership.
-- Apply only after migrations 202610100002 and 202610100003 have been reviewed in a dev database.
begin;

alter table public.aqarflow_whatsapp_integrations
  add column if not exists auto_reply_enabled boolean not null default false;
alter table public.aqarflow_whatsapp_integrations
  alter column access_token_ciphertext drop not null,
  alter column access_token_iv drop not null;

create table if not exists public.aqarflow_crm_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  phone_number text not null check (phone_number ~ '^[0-9]{8,15}$'),
  display_name text check (display_name is null or length(display_name) <= 160),
  source text not null default 'whatsapp' check (source in ('whatsapp','manual','other')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, phone_number)
);

create table if not exists public.aqarflow_crm_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  integration_id uuid not null references public.aqarflow_whatsapp_integrations(id) on delete cascade,
  contact_id uuid not null references public.aqarflow_crm_contacts(id) on delete cascade,
  status text not null default 'open' check (status in ('open','closed','archived')),
  handoff_required boolean not null default false,
  last_message_at timestamptz not null default now(),
  last_message_preview text check (last_message_preview is null or length(last_message_preview) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, integration_id, contact_id)
);

create table if not exists public.aqarflow_crm_messages (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.aqarflow_crm_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  message_type text not null default 'text' check (length(message_type) between 1 and 40),
  message_text text check (message_text is null or length(message_text) <= 4096),
  ai_draft text check (ai_draft is null or length(ai_draft) <= 4096),
  facts_used jsonb not null default '[]'::jsonb check (jsonb_typeof(facts_used) = 'array'),
  unknowns jsonb not null default '[]'::jsonb check (jsonb_typeof(unknowns) = 'array'),
  provider_message_id text,
  provider_status text check (provider_status is null or length(provider_status) <= 40),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(owner_user_id, provider_message_id)
);

create index if not exists aqarflow_crm_contacts_recent_idx
  on public.aqarflow_crm_contacts(owner_user_id, last_seen_at desc);
create index if not exists aqarflow_crm_conversations_recent_idx
  on public.aqarflow_crm_conversations(owner_user_id, status, last_message_at desc);
create index if not exists aqarflow_crm_messages_conversation_idx
  on public.aqarflow_crm_messages(owner_user_id, conversation_id, created_at asc);

alter table public.aqarflow_crm_contacts enable row level security;
alter table public.aqarflow_crm_contacts force row level security;
alter table public.aqarflow_crm_conversations enable row level security;
alter table public.aqarflow_crm_conversations force row level security;
alter table public.aqarflow_crm_messages enable row level security;
alter table public.aqarflow_crm_messages force row level security;

revoke all on public.aqarflow_crm_contacts from public, anon, authenticated;
revoke all on public.aqarflow_crm_conversations from public, anon, authenticated;
revoke all on public.aqarflow_crm_messages from public, anon, authenticated;
grant all on public.aqarflow_crm_contacts to service_role;
grant all on public.aqarflow_crm_conversations to service_role;
grant all on public.aqarflow_crm_messages to service_role;

commit;
