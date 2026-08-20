import { Module } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminBookingsController } from './admin-bookings.controller';
import { AdminBookingsService } from './admin-bookings.service';
import { AdminStaffController } from './admin-staff.controller';
import { AdminStaffService } from './admin-staff.service';

@Module({
  controllers: [AdminBookingsController, AdminStaffController],
  providers: [AdminAuthGuard, AdminBookingsService, AdminStaffService],
})
export class AdminModule {}
