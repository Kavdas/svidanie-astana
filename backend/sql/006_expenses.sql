-- Organizer-reported expenses (decor, flowers, supplies, etc). Optionally
-- tied to the booking/event they were spent on — not every purchase is for
-- one specific event, so the link is nullable.
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references admin_users(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  comment text,
  spent_at date not null default (now() at time zone 'Asia/Almaty')::date,
  created_at timestamptz not null default now()
);

create index if not exists expenses_staff_id_idx on expenses (staff_id);
create index if not exists expenses_spent_at_idx on expenses (spent_at);
create index if not exists expenses_booking_id_idx on expenses (booking_id);
