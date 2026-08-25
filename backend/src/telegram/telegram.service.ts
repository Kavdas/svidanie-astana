import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly databaseService: DatabaseService,
  ) {}

  async sendMessage(text: string) {
    return this.sendToChatIds(text, await this.getManagerChatIds());
  }

  /** Manager + organizer chat ids combined (deduped) — for notifications
   * both roles care about, like a new booking or the morning digest. */
  async sendToStaff(text: string) {
    const chatIds = [
      ...(await this.getManagerChatIds()),
      ...(await this.getOrganizerChatIds()),
    ];

    return this.sendToChatIds(text, Array.from(new Set(chatIds)));
  }

  private async sendToChatIds(text: string, chatIds: string[]) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (!botToken || chatIds.length === 0) {
      this.logger.warn('Telegram is not configured; notification skipped');
      return { skipped: true };
    }

    let sentCount = 0;

    for (const chatId of chatIds) {
      const result = await this.sendMessageToChat(botToken, chatId, text);

      if (!result.skipped) {
        sentCount += 1;
      }
    }

    return {
      skipped: sentCount === 0,
      sentCount,
    };
  }

  private async sendMessageToChat(botToken: string, chatId: string, text: string) {
    try {
      await firstValueFrom(
        this.httpService.post(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
          },
        ),
      );

      return { skipped: false };
    } catch (error) {
      this.logger.warn(
        `Telegram notification failed; booking was created. ${this.getSafeErrorMessage(error)}`,
      );
      return { skipped: true };
    }
  }

  async sendBookingCreated(params: {
    clientName: string;
    clientPhone: string;
    packageTitle?: string | null;
    packagePrice?: string | null;
    startAt: string;
    endAt: string;
    bookingId: string;
    comment?: string | null;
  }) {
    const message = [
      '<b>Новая бронь</b>',
      '',
      `Booking ID: ${this.escapeHtml(params.bookingId)}`,
      `Пакет: ${this.escapeHtml(params.packageTitle || 'Не выбран')}`,
      `Цена: ${this.escapeHtml(params.packagePrice || 'Не указана')}`,
      `Клиент: ${this.escapeHtml(params.clientName)}`,
      `Телефон: ${this.escapeHtml(params.clientPhone)}`,
      `Дата и время: ${this.escapeHtml(params.startAt)} - ${this.escapeHtml(params.endAt)}`,
      params.comment
        ? `Комментарий: ${this.escapeHtml(params.comment)}`
        : 'Комментарий: нет',
    ].join('\n');

    return this.sendToStaff(message);
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private getSafeErrorMessage(error: unknown) {
    if (error instanceof AxiosError) {
      const description =
        typeof error.response?.data === 'object' &&
        error.response.data !== null &&
        'description' in error.response.data &&
        typeof error.response.data.description === 'string'
          ? error.response.data.description
          : error.message;

      return `Status: ${error.response?.status ?? 'unknown'}. ${description}`;
    }

    return 'Unknown error';
  }

  private async getManagerChatIds() {
    const dbValue = await this.getManagerChatIdsFromDb();

    if (dbValue) {
      return this.parseChatIds(dbValue);
    }

    const multipleChatIds = this.configService.get<string>(
      'TELEGRAM_MANAGER_CHAT_IDS',
    );
    const singleChatId = this.configService.get<string>(
      'TELEGRAM_MANAGER_CHAT_ID',
    );

    return this.parseChatIds(multipleChatIds || singleChatId || '');
  }

  private async getManagerChatIdsFromDb(): Promise<string | null> {
    try {
      const result = await this.databaseService.query<{
        manager_chat_ids: string | null;
      }>(
        'select manager_chat_ids from site_settings where manager_chat_ids is not null limit 1',
      );

      return result.rows[0]?.manager_chat_ids ?? null;
    } catch (error) {
      this.logger.warn(
        `Could not read manager_chat_ids from site_settings; falling back to env. ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return null;
    }
  }

  private async getOrganizerChatIds() {
    const dbValue = await this.getOrganizerChatIdsFromDb();

    if (dbValue) {
      return this.parseChatIds(dbValue);
    }

    const envChatIds = this.configService.get<string>(
      'TELEGRAM_ORGANIZER_CHAT_IDS',
    );

    return this.parseChatIds(envChatIds || '');
  }

  private async getOrganizerChatIdsFromDb(): Promise<string | null> {
    try {
      const result = await this.databaseService.query<{
        organizer_chat_ids: string | null;
      }>(
        'select organizer_chat_ids from site_settings where organizer_chat_ids is not null limit 1',
      );

      return result.rows[0]?.organizer_chat_ids ?? null;
    } catch (error) {
      this.logger.warn(
        `Could not read organizer_chat_ids from site_settings; falling back to env. ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return null;
    }
  }

  private parseChatIds(rawValue: string) {
    return rawValue
      .split(',')
      .map((chatId) => chatId.trim())
      .filter(Boolean);
  }
}
