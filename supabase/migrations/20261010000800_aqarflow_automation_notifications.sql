-- AqarFlow Level 3: idempotent in-app reminders for sales tasks and viewings.
-- This migration deliberately does not send WhatsApp messages automatically.
begin;

create table if not exists public.aqarflow_crm_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('task_due','viewing_soon')),
  entity_type text not null check (entity_type in ('task','viewing')),
  entity_id uuid not null,
  event_key text not null check (length(event_key) between 1 and 180),
  title text not null check (length(title) between 1 and 180),
  body text not null check (length(body) between 1 and 500),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint aqarflow_notifications_recipient_event_unique
    unique(owner_user_id, recipient_user_id, event_key)
);

create index if not exists aqarflow_notifications_unread_idx
  on public.aqarflow_crm_notifications(owner_user_id, recipient_user_id, created_at desc)
  where read_at is null;
create index if not exists aqarflow_notifications_history_idx
  on public.aqarflow_crm_notifications(owner_user_id, recipient_user_id, created_at desc);

alter table public.aqarflow_crm_notifications enable row level security;
alter table public.aqarflow_crm_notifications force row level security;
revoke all on public.aqarflow_crm_notifications from public, anon, authenticated;
grant select, insert, update, delete on public.aqarflow_crm_notifications to service_role;

-- Called only from the server-side dispatcher using service_role. Each task/viewing
-- generates one notification per recipient/event; repeating a cron tick is safe.
create or replace function public.aqarflow_dispatch_due_notifications(p_now timestamptz default now())
returns table(task_notifications integer, viewing_notifications integer)
language plpgsql
security invoker
set search_path = ''
as $dispatch$
declare
  task_count integer := 0;
  viewing_count integer := 0;
begin
  insert into public.aqarflow_crm_notifications(
    owner_user_id, recipient_user_id, notification_type, entity_type, entity_id,
    event_key, title, body
  )
  select t.owner_user_id,
         coalesce(t.assigned_to, t.owner_user_id),
         'task_due', 'task', t.id,
         'task_due:' || t.id::text || ':' || extract(epoch from t.due_at)::bigint::text,
         'موعد متابعة مستحق',
         left('المهمة: ' || t.title, 500)
  from public.aqarflow_crm_tasks t
  where t.status in ('pending','in_progress')
    and t.due_at <= p_now + interval '15 minutes'
    and t.due_at >= p_now - interval '24 hours'
    and not exists (
      select 1 from public.aqarflow_crm_notifications n
      where n.owner_user_id=t.owner_user_id
        and n.recipient_user_id=coalesce(t.assigned_to,t.owner_user_id)
        and n.event_key='task_due:' || t.id::text || ':' || extract(epoch from t.due_at)::bigint::text
    )
  order by t.due_at asc
  limit 500
  on conflict (owner_user_id,recipient_user_id,event_key) do nothing;
  get diagnostics task_count = row_count;

  insert into public.aqarflow_crm_notifications(
    owner_user_id, recipient_user_id, notification_type, entity_type, entity_id,
    event_key, title, body
  )
  select v.owner_user_id, v.owner_user_id, 'viewing_soon', 'viewing', v.id,
         'viewing_soon:' || v.id::text || ':' || extract(epoch from v.starts_at)::bigint::text,
         'معاينة عقار قريبة',
         left('الموعد: ' || v.title, 500)
  from public.aqarflow_crm_viewings v
  where v.status in ('scheduled','confirmed')
    and v.starts_at <= p_now + interval '30 minutes'
    and v.starts_at >= p_now - interval '1 hour'
    and not exists (
      select 1 from public.aqarflow_crm_notifications n
      where n.owner_user_id=v.owner_user_id
        and n.recipient_user_id=v.owner_user_id
        and n.event_key='viewing_soon:' || v.id::text || ':' || extract(epoch from v.starts_at)::bigint::text
    )
  order by v.starts_at asc
  limit 500
  on conflict (owner_user_id,recipient_user_id,event_key) do nothing;
  get diagnostics viewing_count = row_count;

  return query select task_count, viewing_count;
end;
$dispatch$;

revoke all on function public.aqarflow_dispatch_due_notifications(timestamptz) from public, anon, authenticated;
grant execute on function public.aqarflow_dispatch_due_notifications(timestamptz) to service_role;

commit;
