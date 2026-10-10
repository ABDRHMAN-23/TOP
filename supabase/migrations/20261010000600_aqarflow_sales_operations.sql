-- AqarFlow Level 2: owner-scoped follow-up tasks and property viewings.
-- Additive only. Test on disposable PostgreSQL, then a separate Supabase development project.
begin;

-- Composite keys make tenant ownership part of every operational relationship.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conname='aqarflow_properties_owner_id_unique' and conrelid='public.aqarflow_properties'::regclass) then
    alter table public.aqarflow_properties add constraint aqarflow_properties_owner_id_unique unique (owner_user_id,id);
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conname='aqarflow_conversations_owner_id_contact_unique' and conrelid='public.aqarflow_crm_conversations'::regclass) then
    alter table public.aqarflow_crm_conversations add constraint aqarflow_conversations_owner_id_contact_unique unique (owner_user_id,id,contact_id);
  end if;
end $$;

create table if not exists public.aqarflow_crm_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null,
  conversation_id uuid,
  task_type text not null default 'follow_up'
    check (task_type in ('follow_up','call','send_information','viewing','document','other')),
  title text not null check (length(btrim(title)) between 1 and 180),
  description text check (description is null or length(description) <= 2000),
  due_at timestamptz not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  result_note text check (result_note is null or length(result_note) <= 1200),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aqarflow_crm_tasks_same_owner_contact_fk
    foreign key (owner_user_id,contact_id)
    references public.aqarflow_crm_contacts(owner_user_id,id) on delete cascade,
  constraint aqarflow_crm_tasks_same_owner_conversation_contact_fk
    foreign key (owner_user_id,conversation_id,contact_id)
    references public.aqarflow_crm_conversations(owner_user_id,id,contact_id) on delete set null (conversation_id),
  constraint aqarflow_crm_tasks_completion_state_check
    check ((status='completed' and completed_at is not null) or (status<>'completed' and completed_at is null))
);

create index if not exists aqarflow_crm_tasks_owner_due_idx
  on public.aqarflow_crm_tasks(owner_user_id,status,due_at asc);
create index if not exists aqarflow_crm_tasks_contact_idx
  on public.aqarflow_crm_tasks(owner_user_id,contact_id,due_at desc);
create index if not exists aqarflow_crm_tasks_assignee_idx
  on public.aqarflow_crm_tasks(owner_user_id,assigned_to,status,due_at asc)
  where assigned_to is not null;

create table if not exists public.aqarflow_crm_viewings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null,
  property_id uuid,
  title text not null check (length(btrim(title)) between 1 and 180),
  location text check (location is null or length(location) <= 240),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Asia/Aden' check (length(timezone) between 1 and 80),
  status text not null default 'scheduled'
    check (status in ('scheduled','confirmed','completed','cancelled','no_show')),
  notes text check (notes is null or length(notes) <= 2000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aqarflow_crm_viewings_time_order_check check (ends_at > starts_at),
  constraint aqarflow_crm_viewings_duration_check check (ends_at - starts_at <= interval '12 hours'),
  constraint aqarflow_crm_viewings_same_owner_contact_fk
    foreign key (owner_user_id,contact_id)
    references public.aqarflow_crm_contacts(owner_user_id,id) on delete cascade,
  constraint aqarflow_crm_viewings_same_owner_property_fk
    foreign key (owner_user_id,property_id)
    references public.aqarflow_properties(owner_user_id,id) on delete set null (property_id)
);

create index if not exists aqarflow_crm_viewings_owner_start_idx
  on public.aqarflow_crm_viewings(owner_user_id,status,starts_at asc);
create index if not exists aqarflow_crm_viewings_contact_idx
  on public.aqarflow_crm_viewings(owner_user_id,contact_id,starts_at desc);
create index if not exists aqarflow_crm_viewings_property_idx
  on public.aqarflow_crm_viewings(owner_user_id,property_id,starts_at)
  where property_id is not null;

alter table public.aqarflow_crm_tasks enable row level security;
alter table public.aqarflow_crm_tasks force row level security;
alter table public.aqarflow_crm_viewings enable row level security;
alter table public.aqarflow_crm_viewings force row level security;

revoke all on public.aqarflow_crm_tasks from public,anon,authenticated;
revoke all on public.aqarflow_crm_viewings from public,anon,authenticated;
grant select,insert,update,delete on public.aqarflow_crm_tasks to service_role;
grant select,insert,update,delete on public.aqarflow_crm_viewings to service_role;

-- Keep the existing lead follow-up column in sync with the earliest active task.
create or replace function private.sync_aqarflow_contact_follow_up()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op='DELETE' then
    update public.aqarflow_crm_contacts c
    set next_follow_up_at=(
      select min(t.due_at) from public.aqarflow_crm_tasks t
      where t.owner_user_id=old.owner_user_id and t.contact_id=old.contact_id
        and t.status in ('pending','in_progress')
    ), updated_at=now()
    where c.owner_user_id=old.owner_user_id and c.id=old.contact_id;
    return old;
  end if;

  if tg_op='UPDATE' and
    (old.owner_user_id is distinct from new.owner_user_id or old.contact_id is distinct from new.contact_id) then
    update public.aqarflow_crm_contacts c
    set next_follow_up_at=(
      select min(t.due_at) from public.aqarflow_crm_tasks t
      where t.owner_user_id=old.owner_user_id and t.contact_id=old.contact_id
        and t.status in ('pending','in_progress')
    ), updated_at=now()
    where c.owner_user_id=old.owner_user_id and c.id=old.contact_id;
  end if;

  update public.aqarflow_crm_contacts c
  set next_follow_up_at=(
    select min(t.due_at) from public.aqarflow_crm_tasks t
    where t.owner_user_id=new.owner_user_id and t.contact_id=new.contact_id
      and t.status in ('pending','in_progress')
  ), updated_at=now()
  where c.owner_user_id=new.owner_user_id and c.id=new.contact_id;
  return new;
end;
$$;
revoke all on function private.sync_aqarflow_contact_follow_up() from public,anon,authenticated;

drop trigger if exists aqarflow_crm_tasks_sync_follow_up on public.aqarflow_crm_tasks;
create trigger aqarflow_crm_tasks_sync_follow_up
after insert or update or delete on public.aqarflow_crm_tasks
for each row execute function private.sync_aqarflow_contact_follow_up();

-- Prevent concurrent users from booking overlapping viewings for the same listing.
create or replace function private.prevent_aqarflow_viewing_overlap()
returns trigger
language plpgsql
set search_path = ''
as $
begin
  if new.property_id is null or new.status not in ('scheduled','confirmed') then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.owner_user_id::text || ':' || new.property_id::text,0)
  );

  if exists (
    select 1 from public.aqarflow_crm_viewings v
    where v.owner_user_id=new.owner_user_id and v.property_id=new.property_id
      and v.status in ('scheduled','confirmed')
      and v.starts_at < new.ends_at and v.ends_at > new.starts_at
      and v.id <> new.id
  ) then
    raise exception 'aqarflow_viewing_overlap'
      using errcode='23P01', detail='The property already has an active viewing in the requested time range.';
  end if;
  return new;
end;
$;
revoke all on function private.prevent_aqarflow_viewing_overlap() from public,anon,authenticated;

drop trigger if exists aqarflow_viewings_prevent_overlap on public.aqarflow_crm_viewings;
create trigger aqarflow_viewings_prevent_overlap
before insert or update of owner_user_id,property_id,starts_at,ends_at,status on public.aqarflow_crm_viewings
for each row execute function private.prevent_aqarflow_viewing_overlap();

commit;
