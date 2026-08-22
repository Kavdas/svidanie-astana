import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateBookingDto } from '../bookings/dto/create-booking.dto';
import { AdminAuthGuard } from './admin-auth.guard';
import type { AdminRequest } from './admin-auth.guard';
import { AdminBookingsService } from './admin-bookings.service';

@UseGuards(AdminAuthGuard)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private readonly adminBookingsService: AdminBookingsService) {}

  @Get()
  getBookings() {
    return this.adminBookingsService.getBookings();
  }

  @Get('schedule')
  getSchedule(@Query('range') range?: string) {
    return this.adminBookingsService.getSchedule(range === 'week' ? 'week' : 'today');
  }

  @Post()
  createBooking(@Req() request: AdminRequest, @Body() dto: CreateBookingDto) {
    this.assertCanSell(request);
    return this.adminBookingsService.createBookingForStaff(dto, request.adminStaffId!);
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

  @Patch(':id/event-status')
  updateEventStatus(
    @Param('id') id: string,
    @Body() body: { eventStatus?: string },
  ) {
    return this.adminBookingsService.updateEventStatus(id, body.eventStatus);
  }

  private assertCanSell(request: AdminRequest) {
    if (request.adminRole !== 'admin' && request.adminRole !== 'manager') {
      throw new ForbiddenException('Only admins and managers can create bookings here');
    }
  }
}
