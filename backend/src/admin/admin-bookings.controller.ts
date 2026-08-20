import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminBookingsService } from './admin-bookings.service';

@UseGuards(AdminAuthGuard)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private readonly adminBookingsService: AdminBookingsService) {}

  @Get()
  getBookings() {
    return this.adminBookingsService.getBookings();
  }

  @Patch(':id/status')
  updateBookingStatus(
    @Param('id') id: string,
    @Body() body: { status?: string },
  ) {
    return this.adminBookingsService.updateBookingStatus(id, body.status);
  }

  @Patch(':id/payment-status')
  updatePaymentStatus(
    @Param('id') id: string,
    @Body() body: { paymentStatus?: string | null },
  ) {
    return this.adminBookingsService.updatePaymentStatus(id, body.paymentStatus);
  }
}
