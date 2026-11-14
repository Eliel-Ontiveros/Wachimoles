-- Migración para Catálogo de Misiones y Ubicación Relativa del Astronauta
-- Archivo: 20261114_add_missions_and_astronaut_state.sql

-- 1. Tabla de Catálogo de Misiones
create table if not exists public.missions (
  id text primary key,
  titulo text not null,
  descripcion text not null,
  categoria text not null check (categoria in ('exercise', 'steps', 'treadmill', 'checkin', 'injury_check')),
  valor_objetivo integer not null check (valor_objetivo > 0),
  unidad text not null check (unidad in ('pasos', 'min', 'check')),
  entorno text not null check (entorno in ('tierra', 'nave', 'estacion', 'luna', 'marte', 'all')),
  dificultad text not null check (dificultad in ('baja', 'media', 'alta')),
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

create index if not exists missions_entorno_dificultad_idx
  on public.missions (entorno, dificultad);

-- 2. Tabla de Estado y Ubicación Relativa de la Misión del Astronauta
create table if not exists public.astronaut_mission_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  origen text not null check (origen in ('tierra', 'estacion', 'luna', 'marte')),
  destino text not null check (destino in ('tierra', 'estacion', 'luna', 'marte')),
  fecha_salida date not null,
  fecha_llegada_estimada date not null,
  fecha_llegada_real date,
  dias_totales numeric(6, 2) not null check (dias_totales > 0),
  dia_actual numeric(6, 2) not null default 0 check (dia_actual >= 0),
  porcentaje_progreso_relativo numeric(5, 2) not null default 0 check (porcentaje_progreso_relativo between 0 and 100),
  entorno_actual text not null check (entorno_actual in ('tierra', 'nave', 'estacion', 'luna', 'marte')),
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

-- 4. Semillas de misiones con dificultades rotativas (baja, media, alta)
insert into public.missions (id, titulo, descripcion, categoria, valor_objetivo, unidad, entorno, dificultad) values
  -- Check-in médico base
  ('checkin-diario', 'Check-in médico diario', 'Confirmar estado general, signos y cuestionario para mantener la racha de salud.', 'checkin', 1, 'check', 'all', 'baja'),
  ('control-lesiones', 'Inspección fotográfica de zonas de dolor', 'Tomar registro visual de inflamación muscular o piel.', 'injury_check', 1, 'check', 'all', 'media'),

  -- Pasos en Tierra (gravedad 1g)
  ('tierra-pasos-baja', 'Caminata ligera de acondicionamiento', 'Día suave: marcha regenerativa y reactivación cardiovascular básica.', 'steps', 3500, 'pasos', 'tierra', 'baja'),
  ('tierra-pasos-media', 'Meta estándar de pasos en base', 'Día moderado: mantenimiento de tono muscular y circulación bajo gravedad terrestre.', 'steps', 7000, 'pasos', 'tierra', 'media'),
  ('tierra-pasos-alta', 'Marcha de alta resistencia terrestre', 'Día intenso: preparación física de alta demanda y capacidad pulmonar.', 'steps', 11000, 'pasos', 'tierra', 'alta'),

  -- Ejercicios en Tierra
  ('tierra-core-baja', 'Movilidad articular y estiramiento core', 'Rutina suave para descargar columna y flexibilidad.', 'exercise', 15, 'min', 'tierra', 'baja'),
  ('tierra-cardio-media', 'Acondicionamiento aeróbico 1g', 'Entrenamiento cardiovascular moderado para resistencia muscular.', 'exercise', 30, 'min', 'tierra', 'media'),
  ('tierra-fuerza-alta', 'Entrenamiento de fuerza y carga máxima', 'Sesión exigente de fuerza funcional para readaptación motora.', 'exercise', 45, 'min', 'tierra', 'alta'),

  -- Nave (Microgravedad 0g - Caminadora con arnés)
  ('nave-treadmill-baja', 'Caminadora T2 en 0g: marcha suave', 'Día suave: sesión ligera con sujeción elástica para prevenir trombosis.', 'treadmill', 2500, 'pasos', 'nave', 'baja'),
  ('nave-treadmill-media', 'Caminadora T2 en 0g: carga estándar', 'Día moderado: impacto controlado contra arnés para frenar desmineralización.', 'treadmill', 4500, 'pasos', 'nave', 'media'),
  ('nave-treadmill-alta', 'Caminadora T2 en 0g: simulación de carga extrema', 'Día exigente: cadencia rápida para exigir sistema cardiovascular y huesos largos.', 'treadmill', 7500, 'pasos', 'nave', 'alta'),

  -- Ejercicios en Nave
  ('nave-stretch-baja', 'Descompresión espinal en cabina', 'Estiramiento suave lumbar y cervical para elongación 0g.', 'exercise', 10, 'min', 'nave', 'baja'),
  ('nave-ared-media', 'Rutina resistiva ARED moderada', 'Ejercicios de fuerza contra resistencia de vacío para cuádriceps y espalda.', 'exercise', 25, 'min', 'nave', 'media'),
  ('nave-ared-alta', 'Fuerza intensiva ARED contra atrofia severa', 'Protocolo de hipertrofia y compresión axial profunda en ingravidez.', 'exercise', 40, 'min', 'nave', 'alta'),

  -- Estación Espacial (EEI)
  ('estacion-treadmill-baja', 'Caminadora T2 en EEI: trote ligero', 'Sesión breve de amortiguación en módulo de servicio.', 'treadmill', 3000, 'pasos', 'estacion', 'baja'),
  ('estacion-treadmill-media', 'Caminadora T2 en EEI: entrenamiento orbital', 'Protocolo diario para mantener gasto calórico y estabilidad en 0g.', 'treadmill', 5000, 'pasos', 'estacion', 'media'),
  ('estacion-treadmill-alta', 'Caminadora T2 en EEI: protocolo intensivo', 'Día de alta carga motriz con resistencia incrementada.', 'treadmill', 8000, 'pasos', 'estacion', 'alta'),
  ('estacion-sans-baja', 'Control cefálico y pausa visual SANS', 'Relajación ocular y alivio de presión intracraneal en microgravedad.', 'exercise', 15, 'min', 'estacion', 'baja'),
  ('estacion-ared-media', 'Resistencia ARED en módulo orbital', 'Compresión ósea en tren inferior y zona escapular.', 'exercise', 25, 'min', 'estacion', 'media'),
  ('estacion-fuerza-alta', 'Carga máxima ARED y trabajo isométrico', 'Entrenamiento estricto para simular gravedad terrestre en masa muscular.', 'exercise', 45, 'min', 'estacion', 'alta'),

  -- Luna (0.16g)
  ('luna-pasos-baja', 'Patrulla corta en regolito lunar', 'Día suave: caminata de reconocimiento en entorno de baja tracción.', 'steps', 4000, 'pasos', 'luna', 'baja'),
  ('luna-pasos-media', 'Marcha de exploración lunar estándar', 'Día moderado: desplazamiento entre domos y plataformas de carga.', 'steps', 6500, 'pasos', 'luna', 'media'),
  ('luna-pasos-alta', 'Travesía prolongada de superficie lunar', 'Día intenso: navegación a pie de cráter con traje presurizado.', 'steps', 9500, 'pasos', 'luna', 'alta'),
  ('luna-balance-baja', 'Control postural y estabilidad de tobillo', 'Recuperación de propiocepción en 0.16g tras caminata con botas EVA.', 'exercise', 15, 'min', 'luna', 'baja'),
  ('luna-eva-media', 'Movilidad y descarga articular post-EVA', 'Alivio de tendones patelares y deltoides por peso del traje espacial.', 'exercise', 25, 'min', 'luna', 'media'),
  ('luna-carga-alta', 'Fuerza funcional con gravedad reducida', 'Sentadillas de potencia y estabilidad lumbar contra regolito.', 'exercise', 40, 'min', 'luna', 'alta'),

  -- Marte (0.38g)
  ('marte-pasos-baja', 'Aclimatación en hábitat marciano', 'Día suave: ronda interior y ajuste a la gravedad de 0.38g.', 'steps', 5000, 'pasos', 'marte', 'baja'),
  ('marte-pasos-media', 'Ruta de recolección en superficie marciana', 'Día moderado: expedición geológica y paso constante sobre dunas.', 'steps', 8500, 'pasos', 'marte', 'media'),
  ('marte-pasos-alta', 'Marcha extrema en terreno rocoso marciano', 'Día de alta exigencia física en suelo hostil y pendiente pronunciada.', 'steps', 12000, 'pasos', 'marte', 'alta'),
  ('marte-resp-baja', 'Respiración diafragmática y revisión SpO2', 'Desaturación de polvo y ventilación guiada en esclusa.', 'exercise', 15, 'min', 'marte', 'baja'),
  ('marte-load-media', 'Entrenamiento de carga en 0.38g', 'Fortalecimiento de erectores espinales y cuádriceps para gravedad marciana.', 'exercise', 30, 'min', 'marte', 'media'),
  ('marte-load-alta', 'Sobrecarga muscular y resistencia extrema', 'Protocolo avanzado de potencia y soporte de carga pesada.', 'exercise', 45, 'min', 'marte', 'alta')
on conflict (id) do update set
  titulo = excluded.titulo,
  descripcion = excluded.descripcion,
  categoria = excluded.categoria,
  valor_objetivo = excluded.valor_objetivo,
  unidad = excluded.unidad,
  entorno = excluded.entorno,
  dificultad = excluded.dificultad,
  activa = excluded.activa;
