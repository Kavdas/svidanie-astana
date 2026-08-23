import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { getReportRangeBounds, ReportRange } from './report-range.util';

type ExpenseRow = QueryResultRow & {
  id: string;
  staff_id: string;
  staff_email: string | null;
  booking_id: string | null;
  package_title: string | null;
  client_name: string | null;
  amount: string;
  comment: string | null;
  spent_at: string;
  created_at: Date | string;
};

@Injectable()
export class AdminExpensesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createExpense(
    staffId: string,
    params: {
      amount?: number | string;
      comment?: string;
      bookingId?: string;
      spentAt?: string;
    },
  ) {
    const amount = Number(params.amount);

    if (!params.amount || Number.isNaN(amount) || amount <= 0) {
      throw new BadRequestException('amount must be a positive number');
    }

    if (params.bookingId) {
      const booking = await this.databaseService.query(
        'select id from bookings where id = $1',
        [params.bookingId],
      );

      if (!booking.rows[0]) {
        throw new BadRequestException('booking not found');
      }
    }

    const result = await this.databaseService.query<ExpenseRow>(
      `
        insert into expenses (staff_id, booking_id, amount, comment, spent_at)
        values ($1, $2, $3, $4, coalesce($5::date, (now() at time zone 'Asia/Almaty')::date))
        returning id, staff_id, booking_id, amount, comment, spent_at, created_at
      `,
      [
        staffId,
        params.bookingId ?? null,
        amount,
        params.comment?.trim() || null,
        params.spentAt ?? null,
      ],
    );

    return this.toResponse(result.rows[0]);
  }

  async listMine(staffId: string, range?: ReportRange) {
    return this.list(range, staffId);
  }

  async listAll(range?: ReportRange) {
    return this.list(range);
  }

  async removeExpense(id: string, requesterStaffId: string, isAdmin: boolean) {
    const existing = await this.databaseService.query<{ staff_id: string }>(
      'select staff_id from expenses where id = $1',
      [id],
    );

    if (!existing.rows[0]) {
      throw new NotFoundException('Expense not found');
    }

    if (!isAdmin && existing.rows[0].staff_id !== requesterStaffId) {
      throw new ForbiddenException('You can only delete your own expenses');
    }

    await this.databaseService.query('delete from expenses where id = $1', [id]);

    return { removed: true };
  }

  async exportXlsx(range?: ReportRange) {
    const { expenses } = await this.listAll(range);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Расходы');

    sheet.columns = [
      { header: 'Дата', key: 'date', width: 14 },
      { header: 'Организатор', key: 'staff', width: 28 },
      { header: 'Бронь', key: 'booking', width: 34 },
      { header: 'Сумма', key: 'amount', width: 14 },
      { header: 'Комментарий', key: 'comment', width: 40 },
    ];
    sheet.getRow(1).font = { bold: true };

    let total = 0;

    for (const expense of expenses) {
      const amount = Number(expense.amount);
      total += amount;

      sheet.addRow({
        date: expense.spentAt,
        staff: expense.staffEmail || '—',
        booking: expense.packageTitle
          ? `${expense.packageTitle}${expense.clientName ? ' — ' + expense.clientName : ''}`
          : '—',
        amount,
        comment: expense.comment || '',
      });
    }

    sheet.addRow({});
    const totalRow = sheet.addRow({ staff: 'Итого', amount: total });
    totalRow.font = { bold: true };
    sheet.getColumn('amount').numFmt = '#,##0';

    return workbook.xlsx.writeBuffer();
  }

  private async list(range?: ReportRange, staffId?: string) {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (staffId) {
      values.push(staffId);
      conditions.push(`e.staff_id = $${values.length}`);
    }

    if (range) {
      const { fromDate, toDate } = getReportRangeBounds(range);
      values.push(fromDate);
      conditions.push(`e.spent_at >= $${values.length}`);
      values.push(toDate);
      conditions.push(`e.spent_at < $${values.length}`);
    }

    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';

    const result = await this.databaseService.query<ExpenseRow>(
      `
        select
          e.id, e.staff_id, e.booking_id, e.amount, e.comment, e.spent_at, e.created_at,
          s.email as staff_email, p.title as package_title, b.client_name
        from expenses e
        left join admin_users s on s.id = e.staff_id
        left join bookings b on b.id = e.booking_id
        left join packages p on p.id = b.package_id
        ${where}
        order by e.spent_at desc, e.created_at desc
        limit 500
      `,
      values,
    );

    return { expenses: result.rows.map((row) => this.toResponse(row)) };
  }

  private toResponse(row: ExpenseRow) {
    return {
      id: row.id,
      staffId: row.staff_id,
      staffEmail: row.staff_email,
      bookingId: row.booking_id,
      packageTitle: row.package_title,
      clientName: row.client_name,
      amount: String(row.amount),
      comment: row.comment,
      spentAt: String(row.spent_at).slice(0, 10),
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}
