import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { getReportRangeBounds, ReportRange } from './report-range.util';

const CANCELLED_STATUSES = ['Отменено', 'cancelled'];

type SumRow = QueryResultRow & { total: string | null };

@Injectable()
export class AdminProfitReportService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * "Revenue" here is the full booked value of non-cancelled bookings, same
   * definition as the sales report — not just the 50% deposits confirmed
   * through Kaspi, since the rest is typically collected in cash on-site
   * and the system has no visibility into that at all. collectedDeposits is
   * shown alongside it so the owner can see what's actually confirmed vs.
   * what's simply booked.
   */
  async getReport(range: ReportRange) {
    const { from, to, fromDate, toDate } = getReportRangeBounds(range);

    const [revenueResult, depositsResult, expensesResult] = await Promise.all([
      this.databaseService.query<SumRow>(
        `
          select sum(p.price_amount) as total
          from bookings b
          join packages p on p.id = b.package_id
          where b.created_at >= $1
            and b.created_at < $2
            and b.status <> all($3)
        `,
        [from, to, CANCELLED_STATUSES],
      ),
      this.databaseService.query<SumRow>(
        `
          select sum(deposit_amount) as total
          from bookings
          where created_at >= $1
            and created_at < $2
            and payment_status = 'paid'
        `,
        [from, to],
      ),
      this.databaseService.query<SumRow>(
        `
          select sum(amount) as total
          from expenses
          where spent_at >= $1
            and spent_at < $2
        `,
        [fromDate, toDate],
      ),
    ]);

    const revenue = Number(revenueResult.rows[0]?.total ?? 0);
    const collectedDeposits = Number(depositsResult.rows[0]?.total ?? 0);
    const expenses = Number(expensesResult.rows[0]?.total ?? 0);

    return {
      range,
      revenue: String(revenue),
      collectedDeposits: String(collectedDeposits),
      expenses: String(expenses),
      profit: String(revenue - expenses),
    };
  }
}
