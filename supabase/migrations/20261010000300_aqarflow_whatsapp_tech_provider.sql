-- AqarFlow WhatsApp Cloud API integration storage.
-- Apply only in a development database after reviewing the actual migration chain.
-- Access tokens are AES-GCM ciphertext. This migration never stores plaintext tokens.
begin;

create table if not exists public.aqarflow_whatsapp_integrations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  waba_id text not null check (waba_id ~ '^[0-9]{5,40}$'),
  phone_number_id text not null unique check (phone_number_id ~ '^[0-9]{5,40}$'),
  display_phone_number text check (display_phone_number is null or length(display_phone_number) <= 40),
  verified_name text check (verified_name is null or length(verified_name) <= 160),
  graph_api_version text not null check (graph_api_version ~ '^v[0-9]+\.[0-9]+$'),
  access_token_ciphertext text not null,
  access_token_iv text not null,
  token_key_version smallint not null check (token_key_version > 0),
  token_expires_at timestamptz,
  status text not null default 'active' check (status in ('active','needs_reauth','disconnected')),
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, phone_number_id)
);

create table if not exists public.aqarflow_whatsapp_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  integration_id uuid not null references public.aqarflow_whatsapp_integrations(id) on delete cascade,
  phone_number_id text not null check (phone_number_id ~ '^[0-9]{5,40}$'),
  provider_event_key text not null check (length(provider_event_key) between 1 and 700),
  event_kind text not null check (event_kind in ('inbound_message','delivery_status')),
  provider_message_id text not null check (length(provider_message_id) between 1 and 256),
  sender_phone_number text check (sender_phone_number is null or sender_phone_number ~ '^[0-9]{8,15}$'),
  message_type text check (message_type is null or length(message_type) <= 40),
  message_text text check (message_text is null or length(message_text) <= 4096),
  provider_status text check (provider_status is null or length(provider_status) <= 40),
  provider_timestamp timestamptz,
  processing_status text not null default 'received' check (processing_status in ('received','queued','processed','failed')),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(owner_user_id, provider_event_key)
);

create index if not exists aqarflow_whatsapp_events_inbound_window_idx
  on public.aqarflow_whatsapp_events(owner_user_id, phone_number_id, sender_phone_number, provider_timestamp desc)
  where event_kind = 'inbound_message';

create index if not exists aqarflow_whatsapp_events_processing_idx
  on public.aqarflow_whatsapp_events(processing_status, received_at)
  where event_kind = 'inbound_message';

create table if not exists public.aqarflow_whatsapp_outbound_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  integration_id uuid not null references public.aqarflow_whatsapp_integrations(id) on delete cascade,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{8,96}$'),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  phone_number_id text not null check (phone_number_id ~ '^[0-9]{5,40}$'),
  recipient_phone_number text not null check (recipient_phone_number ~ '^[0-9]{8,15}$'),
  status text not null default 'pending' check (status in ('pending','sent','failed','unknown')),
  provider_message_id text,
  provider_status text check (provider_status is null or length(provider_status) <= 40),
  failure_code text check (failure_code is null or length(failure_code) <= 80),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(owner_user_id, idempotency_key)
);

create index if not exists aqarflow_whatsapp_outbound_status_idx
  on public.aqarflow_whatsapp_outbound_requests(owner_user_id, status, created_at desc);

-- Delivery webhooks can arrive before the CRM message row is persisted.
alter table public.aqarflow_whatsapp_outbound_requests
  add column if not exists provider_status text check (provider_status is null or length(provider_status) <= 40);
create index if not exists aqarflow_whatsapp_outbound_provider_message_idx
  on public.aqarflow_whatsapp_outbound_requests(owner_user_id, provider_message_id)
  where provider_message_id is not null;

alter table public.aqarflow_whatsapp_integrations enable row level security;
alter table public.aqarflow_whatsapp_integrations force row level security;
alter table public.aqarflow_whatsapp_events enable row level security;
alter table public.aqarflow_whatsapp_events force row level security;
alter table public.aqarflow_whatsapp_outbound_requests enable row level security;
alter table public.aqarflow_whatsapp_outbound_requests force row level security;

-- API/Data API roles cannot read integration tokens or tenant message events.
revoke all on table public.aqarflow_whatsapp_integrations from public, anon, authenticated;
revoke all on table public.aqarflow_whatsapp_events from public, anon, authenticated;
revoke all on table public.aqarflow_whatsapp_outbound_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.aqarflow_whatsapp_integrations to service_role;
grant select, insert, update, delete on table public.aqarflow_whatsapp_events to service_role;
grant select, insert, update, delete on table public.aqarflow_whatsapp_outbound_requests to service_role;

commit;
