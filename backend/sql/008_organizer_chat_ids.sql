-- Separate Telegram audience for organizers, so booking notifications and
-- the morning digest can reach them without mixing into the manager list.
alter table if exists site_settings
  add column if not exists organizer_chat_ids text;
