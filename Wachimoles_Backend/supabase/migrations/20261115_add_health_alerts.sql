begin;

create table public.health_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule text not null check (rule in ('pain_threshold', 'active_problems')),
  source_key text not null,
  severity text not null check (severity in ('critical', 'warning')),
  muscle_id text,
  muscle_name text,
  value integer not null,
  threshold integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  mobile_acknowledged_at timestamptz,
  monitor_acknowledged_at timestamptz
);
create unique index health_alerts_open_episode on public.health_alerts(user_id, rule, source_key)
  where resolved_at is null;
create index health_alerts_user_history on public.health_alerts(user_id, created_at desc, id);
alter table public.health_alerts enable row level security;
revoke all on public.health_alerts from anon, authenticated;
grant all on public.health_alerts to service_role;

-- BEFORE serializes all writes for one astronaut, including concurrent requests.
create function public.lock_health_alert_subject() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.user_id, old.user_id)::text, 7315));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function public.reconcile_health_alerts(subject uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare active_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(subject::text, 7315));
  update public.health_alerts a set resolved_at = now(), updated_at = now()
  where a.user_id = subject and a.resolved_at is null and a.rule = 'pain_threshold'
    and not exists (select 1 from public.body_conditions c where c.user_id = subject
      and c.muscle_id = a.source_key and c.status = 'active' and c.pain_intensity >= 8);

  insert into public.health_alerts(user_id, rule, source_key, severity, muscle_id, muscle_name, value, threshold)
    select subject, 'pain_threshold', c.muscle_id, 'critical', c.muscle_id, c.muscle_name, c.pain_intensity, 8
    from public.body_conditions c where c.user_id = subject and c.status = 'active' and c.pain_intensity >= 8
  on conflict (user_id, rule, source_key) where resolved_at is null
    do update set value = excluded.value, muscle_name = excluded.muscle_name, updated_at = now()
    where health_alerts.value is distinct from excluded.value or health_alerts.muscle_name is distinct from excluded.muscle_name;

  select count(*) into active_count from public.body_conditions where user_id = subject and status = 'active';
  if active_count > 3 then
    insert into public.health_alerts(user_id, rule, source_key, severity, value, threshold)
      values (subject, 'active_problems', 'all', 'warning', active_count, 4)
    on conflict (user_id, rule, source_key) where resolved_at is null
      do update set value = excluded.value, updated_at = now() where health_alerts.value is distinct from excluded.value;
  else
    update public.health_alerts set resolved_at = now(), updated_at = now()
      where user_id = subject and rule = 'active_problems' and resolved_at is null;
  end if;
end;
$$;

create function public.sync_body_condition_alerts() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.reconcile_health_alerts(coalesce(new.user_id, old.user_id));
  return null;
end;
$$;
revoke all on function public.lock_health_alert_subject() from public;
revoke all on function public.reconcile_health_alerts(uuid) from public;
revoke all on function public.sync_body_condition_alerts() from public;
create trigger body_conditions_alert_lock before insert or update or delete on public.body_conditions
  for each row execute function public.lock_health_alert_subject();
create trigger body_conditions_alert_sync after insert or update or delete on public.body_conditions
  for each row execute function public.sync_body_condition_alerts();

-- Existing active problems become episodes at rollout time.
select public.reconcile_health_alerts(user_id) from (select distinct user_id from public.body_conditions) subjects;
commit;
