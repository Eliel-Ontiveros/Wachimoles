-- Migración para Manejo de Misiones Diarias Completadas y Racha Acumulada
-- Archivo: 20261114_add_daily_missions_and_streaks.sql

-- 1. Tabla de Misiones Diarias Completadas por Usuario y Fecha
create table if not exists public.daily_mission_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  mision_id text not null,
  completada boolean not null default false,
  valor_actual numeric not null default 0,
  valor_objetivo numeric not null default 1,
  actualizado_en timestamptz not null default now(),
  constraint daily_mission_completions_unique unique (user_id, fecha, mision_id)
);

create index if not exists daily_mission_completions_user_fecha_idx
  on public.daily_mission_completions (user_id, fecha);

-- 2. Tabla de Cumplimiento Resumido de Misiones por Día
create table if not exists public.daily_mission_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  total_misiones integer not null default 0,
  misiones_completadas integer not null default 0,
  todas_completadas boolean not null default false,
  punto_racha_otorgado boolean not null default false,
  actualizado_en timestamptz not null default now(),
  constraint daily_mission_days_unique unique (user_id, fecha)
);

create index if not exists daily_mission_days_user_fecha_idx
  on public.daily_mission_days (user_id, fecha);

-- 3. Tabla de Racha Acumulada del Astronauta
create table if not exists public.astronaut_streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  racha_actual integer not null default 0 check (racha_actual >= 0),
  racha_maxima integer not null default 0 check (racha_maxima >= 0),
  total_dias_completados integer not null default 0 check (total_dias_completados >= 0),
  ultima_fecha_completada date,
  actualizado_en timestamptz not null default now()
);

-- 4. Row Level Security
alter table public.daily_mission_completions enable row level security;
alter table public.daily_mission_days enable row level security;
alter table public.astronaut_streaks enable row level security;

-- Políticas para daily_mission_completions
drop policy if exists "Usuarios gestionan sus misiones diarias completadas" on public.daily_mission_completions;
create policy "Usuarios gestionan sus misiones diarias completadas"
  on public.daily_mission_completions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Políticas para daily_mission_days
drop policy if exists "Usuarios gestionan sus dias de misiones" on public.daily_mission_days;
create policy "Usuarios gestionan sus dias de misiones"
  on public.daily_mission_days for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Políticas para astronaut_streaks
drop policy if exists "Usuarios gestionan su racha" on public.astronaut_streaks;
create policy "Usuarios gestionan su racha"
  on public.astronaut_streaks for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Permisos
grant select, insert, update on table public.daily_mission_completions to authenticated;
grant all on table public.daily_mission_completions to service_role;

grant select, insert, update on table public.daily_mission_days to authenticated;
grant all on table public.daily_mission_days to service_role;

grant select, insert, update on table public.astronaut_streaks to authenticated;
grant all on table public.astronaut_streaks to service_role;
