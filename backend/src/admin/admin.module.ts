import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminBookingsController } from './admin-bookings.controller';
import { AdminBookingsService } from './admin-bookings.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminStaffController } from './admin-staff.controller';
import { AdminStaffService } from './admin-staff.service';

@Module({
  imports: [BookingsModule],
  controllers: [AdminBookingsController, AdminStaffController, AdminDashboardController],
  providers: [
    AdminAuthGuard,
    AdminBookingsService,
    AdminStaffService,
    AdminDashboardService,
  ],
})
export class AdminModule {}
