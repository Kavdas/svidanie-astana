-- Break organizer expenses down by category (petals, food, desserts, taxi,
-- fountains, delivery, other) so spending can be totalled per item type.
alter table if exists expenses
  add column if not exists category text not null default 'Другое';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'expenses_category_check'
      and conrelid = 'public.expenses'::regclass
  ) then
    alter table expenses
      add constraint expenses_category_check
      check (category in (
        'Лепестки', 'Еда', 'Десерты', 'Такси', 'Фонтаны', 'Доставка', 'Другое'
      ));
  end if;
end $$;

create index if not exists expenses_category_idx on expenses (category);
