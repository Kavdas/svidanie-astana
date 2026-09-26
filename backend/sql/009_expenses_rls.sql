-- Row Level Security for expenses.
--
-- 006_expenses.sql created the table but never enabled RLS, unlike every
-- other table in this schema. Because the Supabase anon key is public by
-- design (it ships in config.js), that left every expense row readable AND
-- writable by anyone who opened the site and looked at the source.
--
-- Nothing legitimate reaches this table through the anon key: the admin panel
-- talks only to the NestJS API, and the API connects as the table owner
-- (DATABASE_URL), which bypasses RLS. So these policies close the hole
-- without changing how the application works — exactly as on bookings.

alter table expenses enable row level security;

-- Owners see the whole ledger; other staff see only what they entered, which
-- mirrors what admin-expenses.service.ts already enforces in the API.
create policy "Staff can read own expenses, admins read all"
  on expenses
  for select
  using (
    is_super_admin()
    or staff_id in (
      select id from admin_users where user_id = auth.uid()
    )
  );

create policy "Staff can add own expenses"
  on expenses
  for insert
  with check (
    staff_id in (
      select id from admin_users where user_id = auth.uid()
    )
  );

create policy "Staff can edit own expenses, admins edit all"
  on expenses
  for update
  using (
    is_super_admin()
    or staff_id in (
      select id from admin_users where user_id = auth.uid()
    )
  )
  with check (
    is_super_admin()
    or staff_id in (
      select id from admin_users where user_id = auth.uid()
    )
  );

create policy "Staff can delete own expenses, admins delete all"
  on expenses
  for delete
  using (
    is_super_admin()
    or staff_id in (
      select id from admin_users where user_id = auth.uid()
    )
  );
