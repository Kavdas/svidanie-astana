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
import { AdminExpensesService, ExpenseFilter } from './admin-expenses.service';
import { isReportRange, isValidDayString, isValidMonthString } from './report-range.util';

@UseGuards(AdminAuthGuard)
@Controller('admin/expenses')
export class AdminExpensesController {
  constructor(private readonly adminExpensesService: AdminExpensesService) {}

  @Post()
  createExpense(
    @Req() request: AdminRequest,
    @Body()
    body: {
      amount?: number | string;
      category?: string;
      comment?: string;
      bookingId?: string;
      spentAt?: string;
    },
  ) {
    this.assertCanReportExpenses(request);
    return this.adminExpensesService.createExpense(request.adminStaffId!, body);
  }

  @Post('batch')
  createExpenseBatch(
    @Req() request: AdminRequest,
    @Body()
    body: {
      bookingId?: string;
      spentAt?: string;
      comment?: string;
      items?: { category?: string; amount?: number | string }[];
    },
  ) {
    this.assertCanReportExpenses(request);
    return this.adminExpensesService.createExpenseBatch(request.adminStaffId!, body);
  }

  @Get('mine')
  listMine(
    @Req() request: AdminRequest,
    @Query('range') range?: string,
    @Query('day') day?: string,
    @Query('month') month?: string,
  ) {
    this.assertCanReportExpenses(request);
    return this.adminExpensesService.listMine(
      request.adminStaffId!,
      this.parseFilter(range, day, month),
    );
  }

  @Get()
  listAll(
    @Req() request: AdminRequest,
    @Query('range') range?: string,
    @Query('day') day?: string,
    @Query('month') month?: string,
  ) {
    this.assertIsAdmin(request);
    return this.adminExpensesService.listAll(this.parseFilter(range, day, month));
  }

  @Get('export.xlsx')
  async exportXlsx(
    @Req() request: AdminRequest,
    @Query('range') range: string | undefined,
    @Query('day') day: string | undefined,
    @Query('month') month: string | undefined,
    @Res() res: Response,
  ) {
    this.assertIsAdmin(request);
    const buffer = await this.adminExpensesService.exportXlsx(
      this.parseFilter(range, day, month),
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

  private parseFilter(
    range?: string,
    day?: string,
    month?: string,
  ): ExpenseFilter {
    if (isValidDayString(day)) {
      return { day };
    }

    if (isValidMonthString(month)) {
      return { month };
    }

    return { range: isReportRange(range) ? range : undefined };
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
