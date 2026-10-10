-- Add real-estate lead pipeline metadata and private team notes to AqarFlow CRM.
-- Additive migration only; run against the disposable PostgreSQL CI database first.
begin;

alter table public.aqarflow_crm_contacts
  add column if not exists lead_stage text not null default 'new'
    check (lead_stage in ('new','contacted','qualified','viewing_scheduled','negotiation','won','lost')),
  add column if not exists intent text not null default 'unknown'
    check (intent in ('buy','rent','invest','unknown')),
  add column if not exists budget_min numeric(16,2) check (budget_min is null or budget_min >= 0),
  add column if not exists budget_max numeric(16,2) check (budget_max is null or budget_max >= 0),
  add column if not exists budget_currency text check (budget_currency is null or budget_currency ~ '^[A-Z]{3,8}$'),
  add column if not exists preferred_area text check (preferred_area is null or length(preferred_area) <= 180),
  add column if not exists preferred_property_type text check (preferred_property_type is null or length(preferred_property_type) <= 80),
  add column if not exists lead_score smallint not null default 0 check (lead_score between 0 and 100),
  add column if not exists next_follow_up_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'aqarflow_crm_contacts_budget_order'
      and conrelid = 'public.aqarflow_crm_contacts'::regclass
  ) then
    alter table public.aqarflow_crm_contacts
      add constraint aqarflow_crm_contacts_budget_order
      check (budget_min is null or budget_max is null or budget_min <= budget_max);
  end if;
end $$;

create index if not exists aqarflow_crm_contacts_pipeline_idx
  on public.aqarflow_crm_contacts(owner_user_id, lead_stage, updated_at desc);
create index if not exists aqarflow_crm_contacts_followup_idx
  on public.aqarflow_crm_contacts(owner_user_id, next_follow_up_at)
  where next_follow_up_at is not null;

create table if not exists public.aqarflow_crm_contact_notes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.aqarflow_crm_contacts(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  note text not null check (length(btrim(note)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists aqarflow_crm_contact_notes_recent_idx
  on public.aqarflow_crm_contact_notes(owner_user_id, contact_id, created_at desc);

alter table public.aqarflow_crm_contact_notes enable row level security;
alter table public.aqarflow_crm_contact_notes force row level security;
revoke all on public.aqarflow_crm_contact_notes from public, anon, authenticated;
grant select, insert, update, delete on public.aqarflow_crm_contact_notes to service_role;

commit;
