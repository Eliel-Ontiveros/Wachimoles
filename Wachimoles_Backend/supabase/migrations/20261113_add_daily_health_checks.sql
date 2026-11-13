create table if not exists public.daily_health_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date_iso date not null,
  blood_sugar_mg_dl numeric(6, 2),
  systolic_bp smallint,
  diastolic_bp smallint,
  temperature_c numeric(4, 2),
  sleep_hours numeric(4, 2),
  mood smallint not null,
  symptoms text[] not null default array['Ninguno']::text[],
  notes text,
  overall_status text not null,
  recommendation text not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_health_checks_user_date_unique unique (user_id, date_iso),
  constraint daily_health_checks_blood_sugar_check
    check (
      blood_sugar_mg_dl is null
      or blood_sugar_mg_dl between 0 and 1000
    ),
  constraint daily_health_checks_systolic_bp_check
    check (systolic_bp is null or systolic_bp between 40 and 300),
  constraint daily_health_checks_diastolic_bp_check
    check (diastolic_bp is null or diastolic_bp between 20 and 200),
  constraint daily_health_checks_temperature_check
    check (temperature_c is null or temperature_c between 25 and 45),
  constraint daily_health_checks_sleep_check
    check (sleep_hours is null or sleep_hours between 0 and 24),
  constraint daily_health_checks_mood_check
    check (mood between 1 and 5),
  constraint daily_health_checks_symptoms_check
    check (
      cardinality(symptoms) between 1 and 5
      and array_position(symptoms, null::text) is null
    ),
  constraint daily_health_checks_notes_check
    check (notes is null or length(notes) <= 2000),
  constraint daily_health_checks_status_check
    check (overall_status in ('normal', 'warning', 'critical')),
  constraint daily_health_checks_recommendation_check
    check (length(trim(recommendation)) between 1 and 1000)
);

create index if not exists daily_health_checks_user_date_idx
  on public.daily_health_checks (user_id, date_iso desc);

alter table public.daily_health_checks enable row level security;

drop policy if exists "Users can read their own daily health checks"
  on public.daily_health_checks;

create policy "Users can read their own daily health checks"
  on public.daily_health_checks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.daily_health_checks to authenticated;
grant all on table public.daily_health_checks to service_role;
