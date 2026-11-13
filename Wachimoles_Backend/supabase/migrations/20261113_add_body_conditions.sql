create table if not exists public.body_conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  muscle_id text not null,
  body_region text not null,
  muscle_name text not null,
  condition_name text not null,
  description text,
  pain_intensity smallint not null,
  swelling boolean not null default false,
  functional_limitation boolean not null default false,
  status text not null default 'active',
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint body_conditions_user_muscle_unique unique (user_id, muscle_id),
  constraint body_conditions_muscle_id_check
    check (muscle_id ~ '^[a-z0-9_]{1,60}$'),
  constraint body_conditions_region_check
    check (body_region in (
      'Cabeza y cuello',
      'Tronco anterior',
      'Tronco posterior',
      'Extremidad superior',
      'Cadera y pelvis',
      'Extremidad inferior'
    )),
  constraint body_conditions_names_check
    check (
      length(trim(muscle_name)) between 1 and 100
      and length(trim(condition_name)) between 1 and 100
    ),
  constraint body_conditions_description_check
    check (description is null or length(description) <= 2000),
  constraint body_conditions_pain_intensity_check
    check (pain_intensity between 1 and 10),
  constraint body_conditions_status_check
    check (
      (status = 'active' and resolved_at is null)
      or (status = 'resolved' and resolved_at is not null)
    )
);

create index if not exists body_conditions_user_status_recorded_at_idx
  on public.body_conditions (user_id, recorded_at desc);

alter table public.body_conditions enable row level security;

drop policy if exists "Users can read their own body conditions"
  on public.body_conditions;

create policy "Users can read their own body conditions"
  on public.body_conditions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.body_conditions to authenticated;
grant all on table public.body_conditions to service_role;
