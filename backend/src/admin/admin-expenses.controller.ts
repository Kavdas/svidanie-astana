import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminAuthGuard } from './admin-auth.guard';
import type { AdminRequest } from './admin-auth.guard';
import { AdminExpensesService } from './admin-expenses.service';
import { isReportRange } from './report-range.util';

@UseGuards(AdminAuthGuard)
@Controller('admin/expenses')
export class AdminExpensesController {
  constructor(private readonly adminExpensesService: AdminExpensesService) {}

  @Post()
  createExpense(
    @Req() request: AdminRequest,
    @Body()
    body: { amount?: number | string; comment?: string; bookingId?: string; spentAt?: string },
  ) {
    this.assertCanReportExpenses(request);
    return this.adminExpensesService.createExpense(request.adminStaffId!, body);
  }

  @Get('mine')
  listMine(@Req() request: AdminRequest, @Query('range') range?: string) {
    this.assertCanReportExpenses(request);
    return this.adminExpensesService.listMine(
      request.adminStaffId!,
      isReportRange(range) ? range : undefined,
    );
  }

  @Get()
  listAll(@Req() request: AdminRequest, @Query('range') range?: string) {
    this.assertIsAdmin(request);
    return this.adminExpensesService.listAll(isReportRange(range) ? range : undefined);
  }

  @Get('export.xlsx')
  async exportXlsx(
    @Req() request: AdminRequest,
    @Query('range') range: string | undefined,
    @Res() res: Response,
  ) {
    this.assertIsAdmin(request);
    const buffer = await this.adminExpensesService.exportXlsx(
      isReportRange(range) ? range : undefined,
    );

    res
      .set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="expenses-${Date.now()}.xlsx"`,
      })
      .send(buffer);
  }

  @Delete(':id')
  removeExpense(@Req() request: AdminRequest, @Param('id') id: string) {
    this.assertCanReportExpenses(request);
    return this.adminExpensesService.removeExpense(
      id,
      request.adminStaffId!,
      request.adminRole === 'admin',
    );
  }

  private assertCanReportExpenses(request: AdminRequest) {
    if (request.adminRole !== 'admin' && request.adminRole !== 'organizer') {
      throw new ForbiddenException('Only admins and organizers can report expenses');
    }
  }

  private assertIsAdmin(request: AdminRequest) {
    if (request.adminRole !== 'admin') {
      throw new ForbiddenException('Only admins can view the full expense report');
    }
  }
}
