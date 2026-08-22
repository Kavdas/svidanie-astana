import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { TelegramService } from './telegram.service';

const CANCELLED_STATUSES = ['Отменено', 'cancelled'];
const REMINDER_WINDOW_HOURS = 3;
const ALMATY_OFFSET = '+05:00';

type UpcomingBookingRow = QueryResultRow & {
  id: string;
  client_name: string;
  client_phone: string;
  start_at: Date | string;
  package_title: string | null;
};

/**
 * Staff-facing notifications only. There is no channel to have the server
 * message clients directly (no WhatsApp Business API, and the Telegram bot
 * can only message users who have started a chat with it themselves) — so
 * these reminders go to the manager/organizer chat(s) already configured in
 * site_settings.manager_chat_ids, prompting a human to follow up with the
 * client by phone/WhatsApp.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly telegramService: TelegramService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'Asia/Almaty' })
  async sendMorningDigest() {
    try {
      const { from, to } = this.getTodayBoundsAlmaty();

      const result = await this.databaseService.query<UpcomingBookingRow>(
        `
          select b.id, b.client_name, b.client_phone, b.start_at, p.title as package_title
          from bookings b
          left join packages p on p.id = b.package_id
          where b.start_at >= $1
            and b.start_at < $2
            and b.status <> all($3)
          order by b.start_at asc
        `,
        [from, to, CANCELLED_STATUSES],
      );

      if (result.rows.length === 0) {
        await this.telegramService.sendMessage(
          '<b>Доброе утро!</b>\nНа сегодня броней нет.',
        );
        return;
      }

      const lines = result.rows.map(
        (row) =>
          `${this.formatTime(row.start_at)} — ${this.escapeHtml(row.package_title || 'Пакет не указан')}, ${this.escapeHtml(row.client_name)} (${this.escapeHtml(row.client_phone)})`,
      );

      await this.telegramService.sendMessage(
        [`<b>Доброе утро! Сегодня ${result.rows.length} брон(ь/и/ей):</b>`, '', ...lines].join(
          '\n',
        ),
      );
    } catch (error) {
      this.logger.warn(
        `Morning digest failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @Cron('*/15 * * * *')
  async sendUpcomingReminders() {
    try {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60_000);

      const result = await this.databaseService.query<UpcomingBookingRow>(
        `
          select b.id, b.client_name, b.client_phone, b.start_at, p.title as package_title
          from bookings b
          left join packages p on p.id = b.package_id
          where b.start_at >= $1
            and b.start_at < $2
            and b.status <> all($3)
            and b.reminder_sent_at is null
          order by b.start_at asc
        `,
        [now.toISOString(), windowEnd.toISOString(), CANCELLED_STATUSES],
      );

      for (const row of result.rows) {
        await this.telegramService.sendMessage(
          [
            '<b>Скоро бронь — не забудьте подготовиться / связаться с клиентом</b>',
            '',
            `Время: ${this.formatTime(row.start_at)}`,
            `Пакет: ${this.escapeHtml(row.package_title || 'Не указан')}`,
            `Клиент: ${this.escapeHtml(row.client_name)}`,
            `Телефон: ${this.escapeHtml(row.client_phone)}`,
          ].join('\n'),
        );

        await this.databaseService.query(
          'update bookings set reminder_sent_at = now() where id = $1',
          [row.id],
        );
      }
    } catch (error) {
      this.logger.warn(
        `Upcoming reminders job failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private getTodayBoundsAlmaty() {
    const todayAlmaty = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Almaty',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const from = new Date(`${todayAlmaty}T00:00:00${ALMATY_OFFSET}`);
    const to = new Date(from.getTime() + 24 * 60 * 60_000);

    return { from: from.toISOString(), to: to.toISOString() };
  }

  private formatTime(value: Date | string) {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Asia/Almaty',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private escapeHtml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
