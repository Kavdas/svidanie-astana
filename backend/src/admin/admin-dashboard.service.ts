import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';

const CANCELLED_STATUSES = ['Отменено', 'cancelled'];

type CountRow = QueryResultRow & { count: string };
type RevenueRow = QueryResultRow & { total: string | null };
type TopPackageRow = QueryResultRow & { title: string; bookings_count: string };
type StaffRow = QueryResultRow & {
  email: string | null;
  role: string | null;
  bookings_count: string;
};
type StatusRow = QueryResultRow & { status: string; count: string };

@Injectable()
export class AdminDashboardService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getDashboard() {
    const [
      totalResult,
      last7Result,
      last30Result,
      revenueResult,
      topPackagesResult,
      staffResult,
      statusResult,
    ] = await Promise.all([
      this.databaseService.query<CountRow>(
        `select count(*) from bookings where status <> all($1)`,
        [CANCELLED_STATUSES],
      ),
      this.databaseService.query<CountRow>(
        `select count(*) from bookings where created_at >= now() - interval '7 days'`,
      ),
      this.databaseService.query<CountRow>(
        `select count(*) from bookings where created_at >= now() - interval '30 days'`,
      ),
      this.databaseService.query<RevenueRow>(
        `select sum(deposit_amount) as total from bookings where payment_status = 'paid'`,
      ),
      this.databaseService.query<TopPackageRow>(
        `
          select p.title, count(*) as bookings_count
          from bookings b
          join packages p on p.id = b.package_id
          where b.status <> all($1)
          group by p.title
          order by bookings_count desc
          limit 5
        `,
        [CANCELLED_STATUSES],
      ),
      this.databaseService.query<StaffRow>(
        `
          select s.email, s.role, count(*) as bookings_count
          from bookings b
          join admin_users s on s.id = b.created_by_staff_id
          group by s.email, s.role
          order by bookings_count desc
        `,
      ),
      this.databaseService.query<StatusRow>(
        `select status, count(*) from bookings group by status order by count(*) desc`,
      ),
    ]);

    return {
      totalBookings: Number(totalResult.rows[0]?.count ?? 0),
      last7Days: Number(last7Result.rows[0]?.count ?? 0),
      last30Days: Number(last30Result.rows[0]?.count ?? 0),
      collectedDeposits: revenueResult.rows[0]?.total
        ? String(revenueResult.rows[0].total)
        : '0',
      topPackages: topPackagesResult.rows.map((row) => ({
        title: row.title,
        bookingsCount: Number(row.bookings_count),
      })),
      staffBreakdown: staffResult.rows.map((row) => ({
        email: row.email,
        role: row.role,
        bookingsCount: Number(row.bookings_count),
      })),
      statusBreakdown: statusResult.rows.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
    };
  }
}
