alter table if exists site_settings
  add column if not exists manager_chat_ids text;

comment on column site_settings.manager_chat_ids is
  'Comma-separated Telegram chat IDs that receive new-booking notifications. Overrides TELEGRAM_MANAGER_CHAT_ID(S) env vars when set.';
