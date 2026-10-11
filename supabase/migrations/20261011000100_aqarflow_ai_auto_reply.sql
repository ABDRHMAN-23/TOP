-- Safe-by-default runtime support for AqarFlow AI WhatsApp auto replies.
-- Auto replies remain disabled per integration until the workspace owner explicitly enables them.
begin;

alter table public.aqarflow_crm_contacts
  add column if not exists ai_auto_reply_opted_out boolean not null default false;

alter table public.aqarflow_crm_conversations
  add column if not exists buyer_profile jsonb not null default '{}'::jsonb
  check (jsonb_typeof(buyer_profile) = 'object');

create index if not exists aqarflow_crm_contacts_auto_reply_opt_out_idx
  on public.aqarflow_crm_contacts(owner_user_id, ai_auto_reply_opted_out, last_seen_at desc);

-- Webhook traffic has no user session, so use separate service-role-only quota routines.
-- Limits remain shared by workspace with normal interactive AI requests.
create or replace function public.aqarflow_reserve_webhook_ai_request(p_owner_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_hour_count bigint;
  v_day_count bigint;
  v_request_id uuid;
begin
  if p_owner_user_id is null or not exists (select 1 from auth.users u where u.id = p_owner_user_id) then
    raise exception 'invalid_workspace_owner' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner_user_id::text, 0));

  select
    count(*) filter (where u.created_at >= pg_catalog.now() - interval '1 hour'),
    count(*)
  into v_hour_count, v_day_count
  from public.aqarflow_ai_usage u
  where u.owner_user_id = p_owner_user_id
    and u.created_at >= pg_catalog.now() - interval '24 hours';

  if coalesce(v_hour_count, 0) >= 20 or coalesce(v_day_count, 0) >= 100 then
    return null;
  end if;

  insert into public.aqarflow_ai_usage(owner_user_id, actor_user_id, outcome)
  values (p_owner_user_id, p_owner_user_id, 'reserved')
  returning id into v_request_id;

  return v_request_id;
end;
$function$;

create or replace function public.aqarflow_record_webhook_ai_usage(
  p_owner_user_id uuid,
  p_request_id uuid,
  p_model text,
  p_latency_ms integer,
  p_input_tokens integer,
  p_output_tokens integer,
  p_result_validated boolean,
  p_outcome text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_updated integer;
begin
  if p_owner_user_id is null or p_request_id is null
    or p_outcome not in ('success', 'invalid_output', 'provider_error')
    or p_latency_ms is null or p_latency_ms < 0 or p_latency_ms > 120000
    or (p_input_tokens is not null and (p_input_tokens < 0 or p_input_tokens > 10000000))
    or (p_output_tokens is not null and (p_output_tokens < 0 or p_output_tokens > 10000000)) then
    raise exception 'invalid_webhook_usage_record' using errcode = '22023';
  end if;

  update public.aqarflow_ai_usage
  set model = pg_catalog.left(pg_catalog.coalesce(pg_catalog.nullif(p_model, ''), 'unselected'), 100),
      latency_ms = p_latency_ms,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      result_validated = coalesce(p_result_validated, false),
      outcome = p_outcome,
      completed_at = pg_catalog.now()
  where id = p_request_id
    and owner_user_id = p_owner_user_id
    and actor_user_id = p_owner_user_id
    and outcome = 'reserved';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$;

revoke all on function public.aqarflow_reserve_webhook_ai_request(uuid) from public, anon, authenticated;
revoke all on function public.aqarflow_record_webhook_ai_usage(uuid,uuid,text,integer,integer,integer,boolean,text) from public, anon, authenticated;
grant execute on function public.aqarflow_reserve_webhook_ai_request(uuid) to service_role;
grant execute on function public.aqarflow_record_webhook_ai_usage(uuid,uuid,text,integer,integer,integer,boolean,text) to service_role;

commit;
