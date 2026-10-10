-- AqarFlow AI runtime. Proposal only: review and apply first in a separate development database.
begin;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

-- AqarFlow owns its workspace membership model; do not depend on the removed Quvoto schema.
create table if not exists public.aqarflow_workspace_memberships (
  owner_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now(),
  primary key (owner_id, member_id),
  constraint aqarflow_workspace_memberships_no_self_member check (owner_id <> member_id)
);
create index if not exists aqarflow_workspace_memberships_member_idx
  on public.aqarflow_workspace_memberships(member_id, owner_id);
alter table public.aqarflow_workspace_memberships enable row level security;
alter table public.aqarflow_workspace_memberships force row level security;
drop policy if exists aqarflow_workspace_memberships_read on public.aqarflow_workspace_memberships;
create policy aqarflow_workspace_memberships_read
  on public.aqarflow_workspace_memberships for select to authenticated
  using (owner_id = (select auth.uid()) or member_id = (select auth.uid()));
revoke all on public.aqarflow_workspace_memberships from public, anon;
revoke insert, update, delete on public.aqarflow_workspace_memberships from authenticated;
grant select on public.aqarflow_workspace_memberships to authenticated;
grant all on public.aqarflow_workspace_memberships to service_role;

create table if not exists public.aqarflow_properties (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 180),
  property_type text,
  purpose text check (purpose is null or purpose in ('sale','rent','invest','unknown')),
  price numeric(16,2) check (price is null or price >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3,8}$'),
  area numeric(12,2) check (area is null or area >= 0),
  bedrooms integer check (bedrooms is null or bedrooms between 0 and 100),
  bathrooms integer check (bathrooms is null or bathrooms between 0 and 100),
  location_label text,
  verified_features text[] not null default '{}',
  availability text not null default 'unknown' check (availability in ('available','unavailable','unknown')),
  facts_last_verified_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aqarflow_properties_owner_active_updated_idx on public.aqarflow_properties(owner_user_id,is_active,updated_at desc);
alter table public.aqarflow_properties enable row level security;

create or replace function private.is_aqarflow_workspace_member(p_owner_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select auth.uid() is not null and p_owner_user_id is not null and exists (
   select 1 from public.aqarflow_workspace_memberships tm
   where tm.owner_id=p_owner_user_id and tm.member_id=auth.uid() and tm.owner_id<>tm.member_id
 );
$$;
revoke all on function private.is_aqarflow_workspace_member(uuid) from public, anon;
grant execute on function private.is_aqarflow_workspace_member(uuid) to authenticated;

drop policy if exists aqarflow_properties_read_workspace on public.aqarflow_properties;
create policy aqarflow_properties_read_workspace on public.aqarflow_properties for select to authenticated
using(owner_user_id=(select auth.uid()) or private.is_aqarflow_workspace_member(owner_user_id));
drop policy if exists aqarflow_properties_insert_owner on public.aqarflow_properties;
create policy aqarflow_properties_insert_owner on public.aqarflow_properties for insert to authenticated
with check(owner_user_id=(select auth.uid()));
drop policy if exists aqarflow_properties_update_owner on public.aqarflow_properties;
create policy aqarflow_properties_update_owner on public.aqarflow_properties for update to authenticated
using(owner_user_id=(select auth.uid())) with check(owner_user_id=(select auth.uid()));
drop policy if exists aqarflow_properties_delete_owner on public.aqarflow_properties;
create policy aqarflow_properties_delete_owner on public.aqarflow_properties for delete to authenticated
using(owner_user_id=(select auth.uid()));
grant select,insert,update,delete on public.aqarflow_properties to authenticated;
revoke all on public.aqarflow_properties from public,anon;

create table if not exists public.aqarflow_ai_usage (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 actor_user_id uuid not null references auth.users(id) on delete cascade,
 model text not null default 'unselected',
 latency_ms integer check(latency_ms is null or latency_ms between 0 and 120000),
 input_tokens integer check(input_tokens is null or input_tokens between 0 and 10000000),
 output_tokens integer check(output_tokens is null or output_tokens between 0 and 10000000),
 result_validated boolean not null default false,
 outcome text not null default 'reserved' check(outcome in ('reserved','success','invalid_output','provider_error')),
 created_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists aqarflow_ai_usage_actor_created_idx on public.aqarflow_ai_usage(actor_user_id,created_at desc);
create index if not exists aqarflow_ai_usage_owner_created_idx on public.aqarflow_ai_usage(owner_user_id,created_at desc);
alter table public.aqarflow_ai_usage enable row level security;
revoke all on public.aqarflow_ai_usage from public,anon,authenticated;
grant all on public.aqarflow_ai_usage to service_role;

create or replace function private.reserve_aqarflow_ai_request(p_owner_user_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid:=auth.uid(); v_hour_count bigint; v_day_count bigint; v_request_id uuid;
begin
 if v_actor is null then raise exception 'authentication_required' using errcode='28000'; end if;
 if p_owner_user_id is null or (p_owner_user_id<>v_actor and not private.is_aqarflow_workspace_member(p_owner_user_id)) then
  raise exception 'workspace_access_denied' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text,0));
 select count(*) filter(where u.created_at>=now()-interval '1 hour'),count(*)
 into v_hour_count,v_day_count from public.aqarflow_ai_usage u
 where u.owner_user_id=p_owner_user_id and u.created_at>=now()-interval '24 hours';
 if coalesce(v_hour_count,0)>=20 or coalesce(v_day_count,0)>=100 then return null; end if;
 insert into public.aqarflow_ai_usage(owner_user_id,actor_user_id,outcome) values(p_owner_user_id,v_actor,'reserved') returning id into v_request_id;
 return v_request_id;
end;
$$;

create or replace function public.aqarflow_reserve_ai_request(p_owner_user_id uuid)
returns uuid language sql security invoker set search_path=pg_catalog,public,pg_temp
as $$ select private.reserve_aqarflow_ai_request(p_owner_user_id); $$;

create or replace function private.record_aqarflow_ai_usage(
 p_request_id uuid,p_model text,p_latency_ms integer,p_input_tokens integer,p_output_tokens integer,
 p_result_validated boolean,p_outcome text
) returns boolean language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_updated integer;
begin
 if v_actor is null then raise exception 'authentication_required' using errcode='28000'; end if;
 if p_request_id is null or p_outcome not in('success','invalid_output','provider_error')
   or p_latency_ms is null or p_latency_ms<0 or p_latency_ms>120000
   or (p_input_tokens is not null and (p_input_tokens<0 or p_input_tokens>10000000))
   or (p_output_tokens is not null and (p_output_tokens<0 or p_output_tokens>10000000)) then
   raise exception 'invalid_usage_record' using errcode='22023';
 end if;
 update public.aqarflow_ai_usage set model=left(coalesce(nullif(p_model,''),'unselected'),100),
  latency_ms=p_latency_ms,input_tokens=p_input_tokens,output_tokens=p_output_tokens,
  result_validated=coalesce(p_result_validated,false),outcome=p_outcome,completed_at=now()
 where id=p_request_id and actor_user_id=v_actor;
 get diagnostics v_updated=row_count; return v_updated=1;
end;
$$;
create or replace function public.aqarflow_record_ai_usage(
 p_request_id uuid,p_model text,p_latency_ms integer,p_input_tokens integer,p_output_tokens integer,
 p_result_validated boolean,p_outcome text
) returns boolean language sql security invoker set search_path=pg_catalog,public,pg_temp
as $$ select private.record_aqarflow_ai_usage(p_request_id,p_model,p_latency_ms,p_input_tokens,p_output_tokens,p_result_validated,p_outcome); $$;

revoke all on function private.reserve_aqarflow_ai_request(uuid) from public,anon;
revoke all on function private.record_aqarflow_ai_usage(uuid,text,integer,integer,integer,boolean,text) from public,anon;
revoke all on function public.aqarflow_reserve_ai_request(uuid) from public,anon;
revoke all on function public.aqarflow_record_ai_usage(uuid,text,integer,integer,integer,boolean,text) from public,anon;
grant execute on function private.reserve_aqarflow_ai_request(uuid) to authenticated;
grant execute on function private.record_aqarflow_ai_usage(uuid,text,integer,integer,integer,boolean,text) to authenticated;
grant execute on function public.aqarflow_reserve_ai_request(uuid) to authenticated;
grant execute on function public.aqarflow_record_ai_usage(uuid,text,integer,integer,integer,boolean,text) to authenticated;

commit;
