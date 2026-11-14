-- Migración para Catálogo de Misiones y Ubicación Relativa del Astronauta
-- Archivo: 20261114_add_missions_and_astronaut_state.sql

-- 1. Tabla de Catálogo de Misiones
create table if not exists public.missions (
  id text primary key,
  titulo text not null,
  descripcion text not null,
  categoria text not null check (categoria in ('exercise', 'steps', 'treadmill', 'checkin', 'injury_check')),
  valor_objetivo integer not null check (valor_objetivo > 0),
  unidad text not null check (unidad in ('steps', 'min', 'check', 'pasos')),
  entorno text not null check (entorno in ('earth', 'spaceship', 'station', 'moon', 'mars', 'all', 'tierra', 'nave', 'estacion', 'luna', 'marte')),
  dificultad text not null check (dificultad in ('low', 'medium', 'high', 'baja', 'media', 'alta')),
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

create index if not exists missions_entorno_dificultad_idx
  on public.missions (entorno, dificultad);

-- 2. Tabla de Estado y Ubicación Relativa de la Misión del Astronauta
create table if not exists public.astronaut_mission_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  origen text not null check (origen in ('earth', 'station', 'moon', 'mars', 'tierra', 'estacion', 'luna', 'marte')),
  destino text not null check (destino in ('earth', 'station', 'moon', 'mars', 'tierra', 'estacion', 'luna', 'marte')),
  fecha_salida date not null,
  fecha_llegada_estimada date not null,
  fecha_llegada_real date,
  dias_totales numeric(6, 2) not null check (dias_totales > 0),
  dia_actual numeric(6, 2) not null default 0 check (dia_actual >= 0),
  porcentaje_progreso_relativo numeric(5, 2) not null default 0 check (porcentaje_progreso_relativo between 0 and 100),
  entorno_actual text not null check (entorno_actual in ('earth', 'spaceship', 'station', 'moon', 'mars', 'tierra', 'nave', 'estacion', 'luna', 'marte')),
  estado text not null default 'in_transit' check (estado in ('scheduled', 'in_transit', 'arrived')),
  llegada_anticipada boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint astronaut_mission_states_user_unique unique (user_id)
);

create index if not exists astronaut_mission_states_user_idx
  on public.astronaut_mission_states (user_id);

-- 3. Row Level Security
alter table public.missions enable row level security;
alter table public.astronaut_mission_states enable row level security;

drop policy if exists "Usuarios autenticados leen misiones" on public.missions;
create policy "Usuarios autenticados leen misiones"
  on public.missions for select to authenticated
  using (true);

drop policy if exists "Usuarios gestionan su estado de mision" on public.astronaut_mission_states;
create policy "Usuarios gestionan su estado de mision"
  on public.astronaut_mission_states for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.missions to authenticated;
grant all on table public.missions to service_role;

grant select on table public.astronaut_mission_states to authenticated;
grant all on table public.astronaut_mission_states to service_role;

-- 4. Semillas de misiones con dificultades rotativas en inglés (low, medium, high)
insert into public.missions (id, titulo, descripcion, categoria, valor_objetivo, unidad, entorno, dificultad) values
  -- Base Medical Check-in & Injury Photos
  ('daily-checkin', 'Daily medical check-in', 'Confirm overall physical condition, vital signs, and daily questionnaire to sustain health streak.', 'checkin', 1, 'check', 'all', 'low'),
  ('injury-check', 'Pain area photographic inspection', 'Capture visual log of muscle inflammation, bruising, or skin condition.', 'injury_check', 1, 'check', 'all', 'medium'),

  -- Earth (1.0g Gravity)
  ('earth-steps-low', 'Light conditioning walk', 'Gentle day: regenerative walking pace and basic cardiovascular reactivation.', 'steps', 3500, 'steps', 'earth', 'low'),
  ('earth-steps-medium', 'Base standard step goal', 'Moderate day: maintain muscle tone and systemic circulation under 1.0g.', 'steps', 7000, 'steps', 'earth', 'medium'),
  ('earth-steps-high', 'High-resistance Earth march', 'Intense day: high-demand cardiovascular conditioning and aerobic threshold.', 'steps', 11000, 'steps', 'earth', 'high'),
  ('earth-core-low', 'Joint mobility & core stretching', 'Gentle routine for spinal decompression and axial flexibility.', 'exercise', 15, 'min', 'earth', 'low'),
  ('earth-cardio-medium', '1.0g aerobic conditioning', 'Moderate cardiovascular routine for muscular endurance and VO2 maintenance.', 'exercise', 30, 'min', 'earth', 'medium'),
  ('earth-strength-high', 'Maximum load strength training', 'Demanding functional strength session for muscular power and motor readaptation.', 'exercise', 45, 'min', 'earth', 'high'),

  -- Spaceship (0g Microgravity - Bungee Treadmill & ARED)
  ('spaceship-treadmill-low', 'T2 Treadmill in 0g: gentle stride', 'Gentle day: light session with harness bungee loading to prevent deep vein thrombosis.', 'treadmill', 2500, 'steps', 'spaceship', 'low'),
  ('spaceship-treadmill-medium', 'T2 Treadmill in 0g: standard loading', 'Moderate day: controlled impact against bungee harness to curb bone demineralization.', 'treadmill', 4500, 'steps', 'spaceship', 'medium'),
  ('spaceship-treadmill-high', 'T2 Treadmill in 0g: high-load simulation', 'Demanding day: rapid cadence to challenge cardiovascular system and cortical bone density.', 'treadmill', 7500, 'steps', 'spaceship', 'high'),
  ('spaceship-stretch-low', 'Cabin spinal decompression', 'Gentle lumbar and cervical stretching to manage 0g spinal elongation.', 'exercise', 10, 'min', 'spaceship', 'low'),
  ('spaceship-ared-medium', 'Moderate ARED resistive routine', 'Piston-driven vacuum resistance exercises targeting quadriceps and posterior chain.', 'exercise', 25, 'min', 'spaceship', 'medium'),
  ('spaceship-ared-high', 'Intensive ARED resistance protocol', 'High-load hypertrophy and axial loading protocol against severe microgravity atrophy.', 'exercise', 40, 'min', 'spaceship', 'high'),

  -- Space Station (ISS 0g)
  ('station-treadmill-low', 'ISS T2 Treadmill: recovery jog', 'Brief vibration-isolated session in service module for limb perfusion.', 'treadmill', 3000, 'steps', 'station', 'low'),
  ('station-treadmill-medium', 'ISS T2 Treadmill: orbital standard', 'Daily protocol to preserve caloric expenditure and postural stability in 0g.', 'treadmill', 5000, 'steps', 'station', 'medium'),
  ('station-treadmill-high', 'ISS T2 Treadmill: intensive protocol', 'High-speed interval training with elevated harness resistance.', 'treadmill', 8000, 'steps', 'station', 'high'),
  ('station-sans-low', 'Cephalic control & SANS visual pause', 'Optic nerve relaxation and intracranial fluid pressure relief in microgravity.', 'exercise', 15, 'min', 'station', 'low'),
  ('station-ared-medium', 'Orbital module ARED resistance', 'Targeted skeletal compression on lower extremities and scapular girdle.', 'exercise', 25, 'min', 'station', 'medium'),
  ('station-strength-high', 'Peak ARED loading & isometric work', 'Strict protocol simulating terrestrial 1g forces on core muscle groups.', 'exercise', 45, 'min', 'station', 'high'),

  -- Moon (0.16g Gravity)
  ('moon-steps-low', 'Short patrol on lunar regolith', 'Gentle day: scouting walk in reduced 0.16g traction terrain.', 'steps', 4000, 'steps', 'moon', 'low'),
  ('moon-steps-medium', 'Standard lunar exploration march', 'Moderate day: traverse between surface domes and cargo logistics modules.', 'steps', 6500, 'steps', 'moon', 'medium'),
  ('moon-steps-high', 'Extended lunar surface expedition', 'Intense day: crater navigation under pressurized spacesuit mass.', 'steps', 9500, 'steps', 'moon', 'high'),
  ('moon-balance-low', 'Postural control & ankle stability', 'Proprioception recovery in 0.16g following EVA boot traverse.', 'exercise', 15, 'min', 'moon', 'low'),
  ('moon-eva-medium', 'Post-EVA joint mobility & relief', 'Tendon and deltoid decompression after rigid spacesuit load bearing.', 'exercise', 25, 'min', 'moon', 'medium'),
  ('moon-load-high', 'Functional strength in low gravity', 'Power squats and lumbar stabilization against loose lunar regolith.', 'exercise', 40, 'min', 'moon', 'high'),

  -- Mars (0.38g Gravity)
  ('mars-steps-low', 'Martian habitat acclimatization', 'Gentle day: interior rounds and biological adjustment to 0.38g.', 'steps', 5000, 'steps', 'mars', 'low'),
  ('mars-steps-medium', 'Martian surface sample survey', 'Moderate day: geological field trek with steady cadence over dune fields.', 'steps', 8500, 'steps', 'mars', 'medium'),
  ('mars-steps-high', 'Extreme trek on rocky Martian terrain', 'High-demand trek across steep crater inclines and basaltic terrain.', 'steps', 12000, 'steps', 'mars', 'high'),
  ('mars-breathing-low', 'Diaphragmatic breathing & SpO2 check', 'Airway clearing and guided airlock pulmonary ventilation routine.', 'exercise', 15, 'min', 'mars', 'low'),
  ('mars-load-medium', '0.38g load-bearing conditioning', 'Erector spinae and quadriceps reinforcement for Martian gravity field.', 'exercise', 30, 'min', 'mars', 'medium'),
  ('mars-load-high', 'Extreme muscular overload & power', 'Advanced power protocol for heavy equipment portage on rough terrain.', 'exercise', 45, 'min', 'mars', 'high')
on conflict (id) do update set
  titulo = excluded.titulo,
  descripcion = excluded.descripcion,
  categoria = excluded.categoria,
  valor_objetivo = excluded.valor_objetivo,
  unidad = excluded.unidad,
  entorno = excluded.entorno,
  dificultad = excluded.dificultad,
  activa = excluded.activa;
