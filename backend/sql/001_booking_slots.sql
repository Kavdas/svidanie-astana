create extension if not exists btree_gist;

alter table if exists packages
  add column if not exists duration_minutes integer default 60;

alter table if exists packages
  add column if not exists prep_minutes integer default 30;

do $$
begin
  if to_regclass('public.packages') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'packages'
         and column_name = 'duration'
     ) then
    update packages
    set duration_minutes = case
      when duration ilike '%1,5%' then 90
      when duration ilike '%40%' then 40
      else 60
    end
    where duration_minutes is null
       or duration_minutes = 60;
  end if;
end $$;

alter table if exists bookings
  add column if not exists start_at timestamptz;

alter table if exists bookings
  add column if not exists end_at timestamptz;

alter table if exists bookings
  add column if not exists locked_until timestamptz;

alter table if exists bookings
  add column if not exists location_id text default 'main';

do $$
begin
  if to_regclass('public.bookings') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'bookings_no_overlapping_active_slots'
         and conrelid = 'public.bookings'::regclass
     ) then
    alter table bookings
      add constraint bookings_no_overlapping_active_slots
      exclude using gist (
        location_id with =,
        tstzrange(start_at, locked_until, '[)') with &&
      )
      where (
        start_at is not null
        and locked_until is not null
        and status in (
          'Новая',
          'Связались',
          'Ожидает оплату',
          'Оплачено',
          'manager_confirmed',
          'pending_payment',
          'paid'
        )
      );
  end if;
end $$;
