create table if not exists public.samples (
  id bigint generated always as identity primary key,
  sample_id text not null unique
    check (char_length(sample_id) between 1 and 120),
  metric text not null
    check (metric in ('heart_rate', 'stress', 'spo2', 'steps')),
  value double precision not null,
  unit text not null,
  measured_at timestamptz not null,
  sensor_time bigint,
  received_at timestamptz not null default now(),
  constraint samples_metric_value_unit_check check (
    (metric = 'heart_rate' and value > 0 and value <= 250 and unit = 'bpm')
    or (metric = 'stress' and value >= 0 and unit = 'score')
    or (metric = 'spo2' and value > 0 and value <= 100 and unit = '%')
    or (metric = 'steps' and value >= 0 and value = trunc(value) and unit = 'steps')
  )
);

create index if not exists samples_measured_at_idx
  on public.samples (measured_at desc);

create index if not exists samples_metric_measured_at_idx
  on public.samples (metric, measured_at desc);

alter table public.samples enable row level security;
