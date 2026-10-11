-- Public AqarFlow sales preview: bounded demo quota without storing visitor IPs or prompt text.
begin;

create table if not exists public.aqarflow_public_demo_rate_limits (
  visitor_key_hash text primary key check (visitor_key_hash ~ '^[a-f0-9]{64}$'),
  hour_window timestamptz not null,
  hour_count integer not null default 0 check (hour_count between 0 and 6),
  day_window date not null,
  day_count integer not null default 0 check (day_count between 0 and 25),
  updated_at timestamptz not null default now()
);

alter table public.aqarflow_public_demo_rate_limits enable row level security;
alter table public.aqarflow_public_demo_rate_limits force row level security;
revoke all on public.aqarflow_public_demo_rate_limits from public, anon, authenticated;
grant all on public.aqarflow_public_demo_rate_limits to service_role;

create or replace function public.aqarflow_consume_public_demo_quota(p_visitor_key_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_hour timestamptz;
  v_day date;
  v_hour_window timestamptz;
  v_day_window date;
  v_hour_count integer;
  v_day_count integer;
begin
  if p_visitor_key_hash is null or p_visitor_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_public_demo_visitor_hash' using errcode = '22023';
  end if;

  v_hour := pg_catalog.date_trunc('hour', v_now);
  v_day := v_now::date;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_visitor_key_hash, 0));

  delete from public.aqarflow_public_demo_rate_limits
  where updated_at < v_now - interval '48 hours';

  select hour_window, hour_count, day_window, day_count
  into v_hour_window, v_hour_count, v_day_window, v_day_count
  from public.aqarflow_public_demo_rate_limits
  where visitor_key_hash = p_visitor_key_hash
  for update;

  if not found then
    insert into public.aqarflow_public_demo_rate_limits
      (visitor_key_hash, hour_window, hour_count, day_window, day_count, updated_at)
    values (p_visitor_key_hash, v_hour, 0, v_day, 0, v_now);
    v_hour_window := v_hour;
    v_hour_count := 0;
    v_day_window := v_day;
    v_day_count := 0;
  end if;

  if v_hour_window <> v_hour then
    v_hour_count := 0;
    v_hour_window := v_hour;
  end if;
  if v_day_window <> v_day then
    v_day_count := 0;
    v_day_window := v_day;
  end if;

  if v_hour_count >= 6 or v_day_count >= 25 then
    update public.aqarflow_public_demo_rate_limits
      set hour_window = v_hour_window, hour_count = v_hour_count,
          day_window = v_day_window, day_count = v_day_count, updated_at = v_now
    where visitor_key_hash = p_visitor_key_hash;
    return false;
  end if;

  update public.aqarflow_public_demo_rate_limits
    set hour_window = v_hour_window, hour_count = v_hour_count + 1,
        day_window = v_day_window, day_count = v_day_count + 1, updated_at = v_now
  where visitor_key_hash = p_visitor_key_hash;

  return true;
end;
$function$;

revoke all on function public.aqarflow_consume_public_demo_quota(text) from public, anon, authenticated;
grant execute on function public.aqarflow_consume_public_demo_quota(text) to service_role;

commit;
