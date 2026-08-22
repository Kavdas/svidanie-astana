-- Third staff role: organizer (on-location, prepares the event)
alter table admin_users drop constraint if exists admin_users_role_check;
alter table admin_users
  add constraint admin_users_role_check check (role in ('admin', 'manager', 'organizer'));

-- Operational status, independent from the sales pipeline (status) and
-- payment tracking (payment_status): has the venue been prepared / was the
-- event actually held.
alter table if exists bookings
  add column if not exists event_status text not null default 'ожидается';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_event_status_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table bookings
      add constraint bookings_event_status_check
      check (event_status in ('ожидается', 'подготовлено', 'проведено'));
  end if;
end $$;

-- Which staff member (if any) created this booking via the manager cabinet,
-- for per-staff sales stats on the owner dashboard.
alter table if exists bookings
  add column if not exists created_by_staff_id uuid references admin_users(id) on delete set null;

-- Marks when a pre-event staff reminder was already sent, so the reminder
-- cron job never nags twice about the same booking.
alter table if exists bookings
  add column if not exists reminder_sent_at timestamptz;
