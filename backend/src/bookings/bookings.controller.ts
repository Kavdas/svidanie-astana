import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

  @Post()
  createBooking(@Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(dto);
  }

  @Get(':id')
  getBooking(@Param('id') id: string) {
    return this.bookingsService.getBooking(id);
  }

  @Post(':id/payment-claim')
  claimPayment(@Param('id') id: string) {
    return this.bookingsService.claimPayment(id);
  }
}
