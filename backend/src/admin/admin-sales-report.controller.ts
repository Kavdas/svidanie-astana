import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminAuthGuard } from './admin-auth.guard';
import type { AdminRequest } from './admin-auth.guard';
import { AdminSalesReportService } from './admin-sales-report.service';
import { isReportRange } from './report-range.util';

@UseGuards(AdminAuthGuard)
@Controller('admin/sales-report')
export class AdminSalesReportController {
  constructor(private readonly adminSalesReportService: AdminSalesReportService) {}

  @Get()
  getReport(@Req() request: AdminRequest, @Query('range') range?: string) {
    this.assertCanSell(request);
    return this.adminSalesReportService.getReport(
      request.adminStaffId!,
      isReportRange(range) ? range : 'today',
    );
  }

  @Get('export.xlsx')
  async exportXlsx(
    @Req() request: AdminRequest,
    @Query('range') range: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertCanSell(request);
    const buffer = await this.adminSalesReportService.exportXlsx(
      request.adminStaffId!,
      isReportRange(range) ? range : 'today',
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="sales-${Date.now()}.xlsx"`,
    });

    return buffer;
  }

  private assertCanSell(request: AdminRequest) {
    if (request.adminRole !== 'admin' && request.adminRole !== 'manager') {
      throw new ForbiddenException('Only admins and managers can view sales reports');
    }
  }
}
