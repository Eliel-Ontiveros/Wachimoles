alter table public.samples
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists samples_user_measured_at_idx
  on public.samples (user_id, measured_at desc);

drop policy if exists "Users can read their own samples" on public.samples;

create policy "Users can read their own samples"
  on public.samples
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
