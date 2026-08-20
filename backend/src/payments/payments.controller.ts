import { Body, Controller, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('halyk/init')
  initHalykPayment(@Body() body: Record<string, unknown>) {
    return this.paymentsService.initHalykPayment(body);
  }
}
