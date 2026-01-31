alter table public.availability_daily_summary
  add column if not exists slot_units numeric;

alter table public.availability_daily_summary
  add column if not exists slot_units_update numeric;

update public.availability_daily_summary
set slot_units = slot_count
where slot_units is null;

alter table public.availability_daily_summary
  alter column slot_units set default 0,
  alter column slot_units set not null;

update public.availability_daily_summary
set slot_units_update = slot_count_update
where slot_units_update is null
  and slot_count_update is not null;
