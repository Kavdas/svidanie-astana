import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  constructor(private readonly configService: ConfigService) {}

  initHalykPayment(body: Record<string, unknown>) {
    const merchantId = this.configService.get<string>('HALYK_MERCHANT_ID');
    const terminalId = this.configService.get<string>('HALYK_TERMINAL_ID');
    const apiUrl = this.configService.get<string>('HALYK_API_URL');

    if (!merchantId || !terminalId || !apiUrl) {
      return {
        status: 'not_configured',
        message: 'Halyk payment is not configured yet',
      };
    }

    return {
      status: 'stub',
      message: 'Halyk payment initialization stub is ready',
      bookingId:
        typeof body.bookingId === 'string' ? body.bookingId : undefined,
    };
  }
}
