alter table public.samples
  drop constraint if exists samples_metric_check;

alter table public.samples
  add constraint samples_metric_check
  check (metric in ('heart_rate', 'stress', 'spo2', 'steps', 'sleep'));

alter table public.samples
  drop constraint if exists samples_metric_value_unit_check;

alter table public.samples
  add constraint samples_metric_value_unit_check check (
    (metric = 'heart_rate' and value > 0 and value <= 250 and unit = 'bpm')
    or (metric = 'stress' and value >= 0 and unit = 'score')
    or (metric = 'spo2' and value > 0 and value <= 100 and unit = '%')
    or (metric = 'steps' and value >= 0 and value = trunc(value) and unit = 'steps')
    or (metric = 'sleep' and value > 0 and value <= 24 and unit = 'hours')
  );
