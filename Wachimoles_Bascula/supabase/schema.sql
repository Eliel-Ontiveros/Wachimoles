-- Pesajes de la báscula Bluetooth OKOK. Tabla independiente de public.samples.
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

-- Sin políticas públicas: solo accede el servidor con la service_role.
alter table public.weight_measurements enable row level security;
