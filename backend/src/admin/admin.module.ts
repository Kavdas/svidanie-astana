import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminBookingsController } from './admin-bookings.controller';
import { AdminBookingsService } from './admin-bookings.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminExpensesController } from './admin-expenses.controller';
import { AdminExpensesService } from './admin-expenses.service';
import { AdminSalesReportController } from './admin-sales-report.controller';
import { AdminSalesReportService } from './admin-sales-report.service';
import { AdminStaffController } from './admin-staff.controller';
import { AdminStaffService } from './admin-staff.service';

@Module({
  imports: [BookingsModule],
  controllers: [
    AdminBookingsController,
    AdminStaffController,
    AdminDashboardController,
    AdminExpensesController,
    AdminSalesReportController,
  ],
  providers: [
    AdminAuthGuard,
    AdminBookingsService,
    AdminStaffService,
    AdminDashboardService,
    AdminExpensesService,
    AdminSalesReportService,
  ],
})
export class AdminModule {}
