import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { getReportRangeBounds, ReportRange } from './report-range.util';

const CANCELLED_STATUSES = ['Отменено', 'cancelled'];

type PackageSalesRow = QueryResultRow & {
  title: string;
  cnt: string;
  total: string | null;
};

@Injectable()
export class AdminSalesReportService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getReport(staffId: string, range: ReportRange) {
    const { from, to } = getReportRangeBounds(range);

    const result = await this.databaseService.query<PackageSalesRow>(
      `
        select p.title, count(*) as cnt, sum(p.price_amount) as total
        from bookings b
        join packages p on p.id = b.package_id
        where b.created_by_staff_id = $1
          and b.created_at >= $2
          and b.created_at < $3
          and b.status <> all($4)
        group by p.title
        order by cnt desc
      `,
      [staffId, from, to, CANCELLED_STATUSES],
    );

    const packages = result.rows.map((row) => ({
      packageTitle: row.title,
      count: Number(row.cnt),
      totalAmount: String(row.total ?? 0),
    }));

    const totalCount = packages.reduce((sum, row) => sum + row.count, 0);
    const totalAmount = packages.reduce(
      (sum, row) => sum + Number(row.totalAmount),
      0,
    );

    return { range, packages, totalCount, totalAmount: String(totalAmount) };
  }

  async exportXlsx(staffId: string, range: ReportRange) {
    const report = await this.getReport(staffId, range);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Продажи');

    sheet.columns = [
      { header: 'Пакет', key: 'title', width: 30 },
      { header: 'Количество', key: 'count', width: 14 },
      { header: 'Сумма', key: 'amount', width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const row of report.packages) {
      sheet.addRow({
        title: row.packageTitle,
        count: row.count,
        amount: Number(row.totalAmount),
      });
    }

    sheet.addRow({});
    const totalRow = sheet.addRow({
      title: 'Итого',
      count: report.totalCount,
      amount: Number(report.totalAmount),
    });
    totalRow.font = { bold: true };
    sheet.getColumn('amount').numFmt = '#,##0';

    return workbook.xlsx.writeBuffer();
  }
}
