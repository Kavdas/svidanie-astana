import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import type { AdminRequest } from './admin-auth.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@UseGuards(AdminAuthGuard)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get()
  getDashboard(@Req() request: AdminRequest) {
    if (request.adminRole !== 'admin') {
      throw new ForbiddenException('Only admins can view the dashboard');
    }

    return this.adminDashboardService.getDashboard();
  }
}
