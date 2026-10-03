alter table public.profiles
  add column if not exists trial_start timestamptz,
  add column if not exists trial_end timestamptz,
  add column if not exists trial_active boolean not null default false;
