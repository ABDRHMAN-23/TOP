-- AqarFlow Level 4: workspace-scoped sales intelligence and report export.
-- The functions run as invoker and are executable only by service_role.
begin;

create index if not exists aqarflow_crm_contacts_analytics_created_idx
  on public.aqarflow_crm_contacts(owner_user_id, created_at desc, lead_stage);
create index if not exists aqarflow_crm_messages_analytics_created_idx
  on public.aqarflow_crm_messages(owner_user_id, created_at desc, direction);
create index if not exists aqarflow_crm_viewings_analytics_start_idx
  on public.aqarflow_crm_viewings(owner_user_id, starts_at, status);
create index if not exists aqarflow_crm_tasks_analytics_due_idx
  on public.aqarflow_crm_tasks(owner_user_id, due_at, status);

create or replace function public.aqarflow_sales_analytics(
  p_owner_user_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $analytics$
declare
  result jsonb;
begin
  if p_owner_user_id is null or p_from is null or p_to is null or p_to <= p_from
     or p_to - p_from > interval '366 days' then
    raise exception 'invalid_analytics_period' using errcode = '22023';
  end if;

  with lead_window as (
    select c.id, c.lead_stage, c.source, c.intent, c.lead_score, c.created_at
    from public.aqarflow_crm_contacts c
    where c.owner_user_id = p_owner_user_id
      and c.created_at >= p_from and c.created_at < p_to
  ),
  lead_rollup as (
    select count(*)::bigint as total,
      count(*) filter (where lead_stage in ('qualified','viewing_scheduled','negotiation','won'))::bigint as qualified,
      count(*) filter (where lead_stage = 'won')::bigint as won,
      count(*) filter (where lead_stage = 'lost')::bigint as lost,
      coalesce(round(avg(lead_score)::numeric, 1), 0) as avg_score
    from lead_window
  ),
  day_series as (
    select generate_series(
      date_trunc('day', p_from),
      date_trunc('day', p_to - interval '1 microsecond'),
      interval '1 day'
    ) as day_start
  ),
  trend as (
    select ds.day_start,
      count(l.id)::bigint as leads,
      count(l.id) filter (where l.lead_stage = 'won')::bigint as won
    from day_series ds
    left join lead_window l
      on l.created_at >= ds.day_start and l.created_at < ds.day_start + interval '1 day'
    group by ds.day_start
    order by ds.day_start
  ),
  stage_counts as (
    select lead_stage as label, count(*)::bigint as amount
    from lead_window group by lead_stage
  ),
  source_counts as (
    select source as label, count(*)::bigint as amount
    from lead_window group by source
  ),
  intent_counts as (
    select intent as label, count(*)::bigint as amount
    from lead_window group by intent
  ),
  task_rollup as (
    select
      count(*) filter (where status in ('pending','in_progress'))::bigint as open_tasks,
      count(*) filter (where status in ('pending','in_progress') and due_at < now())::bigint as overdue_tasks,
      count(*) filter (where due_at >= p_from and due_at < p_to and status <> 'cancelled')::bigint as due_in_period,
      count(*) filter (where status = 'completed' and completed_at >= p_from and completed_at < p_to)::bigint as completed_in_period
    from public.aqarflow_crm_tasks t
    where t.owner_user_id = p_owner_user_id
  ),
  viewing_rollup as (
    select
      count(*) filter (where status in ('scheduled','confirmed') and starts_at >= p_from and starts_at < p_to)::bigint as scheduled,
      count(*) filter (where status = 'completed' and starts_at >= p_from and starts_at < p_to)::bigint as completed,
      count(*) filter (where status = 'no_show' and starts_at >= p_from and starts_at < p_to)::bigint as no_show,
      count(*) filter (where status = 'cancelled' and starts_at >= p_from and starts_at < p_to)::bigint as cancelled
    from public.aqarflow_crm_viewings v
    where v.owner_user_id = p_owner_user_id
  ),
  whatsapp_rollup as (
    select
      count(*) filter (where direction = 'inbound' and created_at >= p_from and created_at < p_to)::bigint as inbound,
      count(*) filter (where direction = 'outbound' and created_at >= p_from and created_at < p_to)::bigint as outbound,
      count(*) filter (where direction = 'outbound' and provider_status in ('delivered','read') and created_at >= p_from and created_at < p_to)::bigint as delivered,
      count(*) filter (where direction = 'outbound' and provider_status = 'failed' and created_at >= p_from and created_at < p_to)::bigint as failed
    from public.aqarflow_crm_messages m
    where m.owner_user_id = p_owner_user_id
  ),
  conversation_rollup as (
    select
      count(*) filter (where status = 'open')::bigint as open_conversations,
      count(*) filter (where handoff_required)::bigint as handoff_required
    from public.aqarflow_crm_conversations c
    where c.owner_user_id = p_owner_user_id
  ),
  property_rollup as (
    select
      count(*)::bigint as total,
      count(*) filter (where is_active and availability = 'available')::bigint as available,
      count(*) filter (where is_active and availability = 'unavailable')::bigint as unavailable,
      count(*) filter (where is_active and availability = 'unknown')::bigint as availability_unknown,
      count(*) filter (where not is_active)::bigint as inactive
    from public.aqarflow_properties p
    where p.owner_user_id = p_owner_user_id
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'summary', jsonb_build_object(
      'leadsCreated', lr.total,
      'qualifiedLeads', lr.qualified,
      'wonLeads', lr.won,
      'lostLeads', lr.lost,
      'winRatePercent', case when lr.total = 0 then 0 else round((lr.won::numeric * 100 / lr.total), 1) end,
      'averageLeadScore', lr.avg_score
    ),
    'stages', coalesce((select jsonb_object_agg(label, amount) from stage_counts), '{}'::jsonb),
    'sources', coalesce((select jsonb_object_agg(label, amount) from source_counts), '{}'::jsonb),
    'intents', coalesce((select jsonb_object_agg(label, amount) from intent_counts), '{}'::jsonb),
    'trend', coalesce((select jsonb_agg(jsonb_build_object(
      'date', to_char(day_start at time zone 'UTC', 'YYYY-MM-DD'),
      'leads', leads, 'won', won
    ) order by day_start) from trend), '[]'::jsonb),
    'operations', jsonb_build_object(
      'openTasks', tr.open_tasks, 'overdueTasks', tr.overdue_tasks,
      'dueTasksInPeriod', tr.due_in_period, 'completedTasksInPeriod', tr.completed_in_period,
      'viewingsScheduledInPeriod', vr.scheduled, 'viewingsCompletedInPeriod', vr.completed,
      'viewingsNoShowInPeriod', vr.no_show, 'viewingsCancelledInPeriod', vr.cancelled
    ),
    'whatsapp', jsonb_build_object(
      'inboundMessages', wr.inbound, 'outboundMessages', wr.outbound,
      'deliveredOutbound', wr.delivered, 'failedOutbound', wr.failed,
      'openConversations', cr.open_conversations, 'handoffRequired', cr.handoff_required
    ),
    'inventory', jsonb_build_object(
      'total', pr.total, 'available', pr.available, 'unavailable', pr.unavailable,
      'availabilityUnknown', pr.availability_unknown, 'inactive', pr.inactive
    )
  ) into result
  from lead_rollup lr
  cross join task_rollup tr
  cross join viewing_rollup vr
  cross join whatsapp_rollup wr
  cross join conversation_rollup cr
  cross join property_rollup pr;

  return result;
end;
$analytics$;

create or replace function public.aqarflow_export_sales_analytics(
  p_owner_user_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $export$
declare
  result jsonb;
begin
  if p_owner_user_id is null or p_from is null or p_to is null or p_to <= p_from
     or p_to - p_from > interval '366 days' then
    raise exception 'invalid_analytics_period' using errcode = '22023';
  end if;

  with limited_rows as (
    select c.created_at, c.display_name, c.phone_number, c.source, c.lead_stage,
      c.intent, c.lead_score, c.budget_min, c.budget_max, c.budget_currency,
      c.preferred_area, c.preferred_property_type, c.next_follow_up_at, c.last_seen_at
    from public.aqarflow_crm_contacts c
    where c.owner_user_id = p_owner_user_id
      and c.created_at >= p_from and c.created_at < p_to
    order by c.created_at desc, c.id desc
    limit 5001
  )
  select jsonb_build_object(
    'truncated', (select count(*) > 5000 from limited_rows),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (select * from limited_rows order by created_at desc limit 5000) x
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$export$;

revoke all on function public.aqarflow_sales_analytics(uuid,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.aqarflow_export_sales_analytics(uuid,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.aqarflow_sales_analytics(uuid,timestamptz,timestamptz) to service_role;
grant execute on function public.aqarflow_export_sales_analytics(uuid,timestamptz,timestamptz) to service_role;

commit;
