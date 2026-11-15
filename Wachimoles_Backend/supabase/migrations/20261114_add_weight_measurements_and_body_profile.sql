-- Pesajes de la báscula Bluetooth (módulo Wachimoles_Bascula) y perfil corporal
-- del usuario activo. El perfil (estatura, edad, sexo) es la entrada de las
-- fórmulas de IMC y de las estimaciones de composición corporal; la báscula solo
-- aporta el peso. Solo la estatura es obligatoria; edad y sexo habilitan el peso
-- ideal y las estimaciones de composición corporal.

-- Mismo esquema que Wachimoles_Bascula/supabase/schema.sql (idempotente).
create table if not exists public.weight_measurements (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  measurement_id text not null unique
    check (char_length(measurement_id) between 1 and 120),
  weight_kg numeric(6, 2) not null
    check (weight_kg > 0 and weight_kg <= 500),
  device text check (device is null or char_length(device) <= 80),
  measured_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists weight_measurements_user_measured_at_idx
  on public.weight_measurements (user_id, measured_at desc);

alter table public.weight_measurements enable row level security;

drop policy if exists "Users can read their own weight measurements"
  on public.weight_measurements;

create policy "Users can read their own weight measurements"
  on public.weight_measurements
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.weight_measurements to authenticated;
grant all on table public.weight_measurements to service_role;

create table if not exists public.user_body_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  height_cm numeric(4, 1) not null
    check (height_cm between 50 and 250),
  age_years smallint
    check (age_years is null or age_years between 5 and 120),
  sex text
    check (sex is null or sex in ('male', 'female')),
  updated_at timestamptz not null default now()
);

alter table public.user_body_profiles enable row level security;

drop policy if exists "Users can read their own body profile"
  on public.user_body_profiles;

create policy "Users can read their own body profile"
  on public.user_body_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.user_body_profiles to authenticated;
grant all on table public.user_body_profiles to service_role;
