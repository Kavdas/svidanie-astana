import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [TelegramModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
