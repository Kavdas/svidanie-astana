import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import type { AdminRequest } from './admin-auth.guard';
import { AdminProfitReportService } from './admin-profit-report.service';
import { isReportRange } from './report-range.util';

@UseGuards(AdminAuthGuard)
@Controller('admin/profit-report')
export class AdminProfitReportController {
  constructor(private readonly adminProfitReportService: AdminProfitReportService) {}

  @Get()
  getReport(@Req() request: AdminRequest, @Query('range') range?: string) {
    if (request.adminRole !== 'admin') {
      throw new ForbiddenException('Only admins can view the profit report');
    }

    return this.adminProfitReportService.getReport(
      isReportRange(range) ? range : 'month',
    );
  }
}
