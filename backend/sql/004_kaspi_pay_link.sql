-- Direct Kaspi Pay link (pay.kaspi.kz/pay/...) shown to clients during checkout,
-- alongside the free-text requisites already stored in kaspi_requisites.
alter table if exists site_settings
  add column if not exists kaspi_pay_link text;
