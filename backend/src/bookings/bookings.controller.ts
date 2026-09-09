import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AvailableSlotsDto } from './dto/available-slots.dto';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('available-slots')
  getAvailableSlots(@Body() dto: AvailableSlotsDto) {
    return this.bookingsService.getAvailableSlots(dto);
  }

  // Real clients book at most a handful of times; this only needs to be
  // loose enough for someone to retry a typo, not for a script to flood
  // real slots.
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post()
  createBooking(@Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(dto);
  }

  @Get(':id')
  getBooking(@Param('id') id: string) {
    return this.bookingsService.getBooking(id);
  }

  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post(':id/payment-claim')
  claimPayment(@Param('id') id: string) {
    return this.bookingsService.claimPayment(id);
  }
}
