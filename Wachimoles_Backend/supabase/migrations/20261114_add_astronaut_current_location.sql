-- Migración para Almacenar Ubicación Actual del Astronauta de Forma Independiente
-- Archivo: 20261114_add_astronaut_current_location.sql

-- 1. Tabla de Ubicación Actual del Astronauta
create table if not exists public.astronaut_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entorno text not null check (entorno in ('tierra', 'nave', 'estacion', 'luna', 'marte')),
  actualizado_en timestamptz not null default now(),
  constraint astronaut_locations_user_unique unique (user_id)
);

create index if not exists astronaut_locations_user_idx
  on public.astronaut_locations (user_id);

-- 2. Row Level Security
alter table public.astronaut_locations enable row level security;

drop policy if exists "Usuarios autenticados leen su ubicacion" on public.astronaut_locations;
create policy "Usuarios autenticados leen su ubicacion"
  on public.astronaut_locations for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Usuarios autenticados guardan su ubicacion" on public.astronaut_locations;
create policy "Usuarios autenticados guardan su ubicacion"
  on public.astronaut_locations for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on table public.astronaut_locations to authenticated;
grant all on table public.astronaut_locations to service_role;
