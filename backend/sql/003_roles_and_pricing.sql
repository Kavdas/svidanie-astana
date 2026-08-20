-- Staff roles (admin / manager)
alter table if exists admin_users
  add column if not exists role text not null default 'manager';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'admin_users_role_check'
      and conrelid = 'public.admin_users'::regclass
  ) then
    alter table admin_users
      add constraint admin_users_role_check check (role in ('admin', 'manager'));
  end if;
end $$;

-- Existing admin account keeps full access
update admin_users set role = 'admin' where email = 'admin@svidanie.kz';

create or replace function public.is_super_admin()
 returns boolean
 language sql
 security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and role = 'admin'
  );
$function$;

-- Managers keep read/write on bookings (is_admin), but price/catalog/settings
-- management is restricted to admins only (is_super_admin).
drop policy if exists "Admins can manage packages" on packages;
create policy "Admins can manage packages" on packages
  for all
  using (is_super_admin())
  with check (is_super_admin());

drop policy if exists "Admins can manage gallery" on gallery;
create policy "Admins can manage gallery" on gallery
  for all
  using (is_super_admin())
  with check (is_super_admin());

drop policy if exists "Admins can manage site settings" on site_settings;
create policy "Admins can manage site settings" on site_settings
  for all
  using (is_super_admin())
  with check (is_super_admin());

-- Numeric price so deposit amounts can be calculated automatically
alter table if exists packages
  add column if not exists price_amount numeric;

update packages
set price_amount = nullif(regexp_replace(price, '[^0-9]', '', 'g'), '')::numeric
where price_amount is null
  and price is not null;

-- Deposit tracking on bookings (payment_status column already existed, unused)
alter table if exists bookings
  add column if not exists deposit_amount numeric;

-- Kaspi transfer requisites shown to clients during checkout
alter table if exists site_settings
  add column if not exists kaspi_requisites text;
