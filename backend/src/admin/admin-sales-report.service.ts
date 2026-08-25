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

type SaleRow = QueryResultRow & {
  id: string;
  client_name: string;
  client_phone: string;
  start_at: Date | string;
  created_at: Date | string;
  status: string;
  package_title: string | null;
  price_amount: string | null;
};

@Injectable()
export class AdminSalesReportService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * System-wide, not scoped to whoever is asking — the sales manager's
   * commission is a percentage of every booking that comes in, including
   * ones clients made themselves on the public site, not just the ones the
   * manager personally keyed in through the staff cabinet.
   */
  async getReport(range: ReportRange) {
    const { from, to } = getReportRangeBounds(range);

    const [byPackage, sales] = await Promise.all([
      this.databaseService.query<PackageSalesRow>(
        `
          select p.title, count(*) as cnt, sum(p.price_amount) as total
          from bookings b
          join packages p on p.id = b.package_id
          where b.created_at >= $1
            and b.created_at < $2
            and b.status <> all($3)
          group by p.title
          order by cnt desc
        `,
        [from, to, CANCELLED_STATUSES],
      ),
      this.databaseService.query<SaleRow>(
        `
          select
            b.id, b.client_name, b.client_phone, b.start_at, b.created_at, b.status,
            p.title as package_title, p.price_amount
          from bookings b
          left join packages p on p.id = b.package_id
          where b.created_at >= $1
            and b.created_at < $2
            and b.status <> all($3)
          order by b.created_at desc
          limit 500
        `,
        [from, to, CANCELLED_STATUSES],
      ),
    ]);

    const packages = byPackage.rows.map((row) => ({
      packageTitle: row.title,
      count: Number(row.cnt),
      totalAmount: String(row.total ?? 0),
    }));

    const totalCount = packages.reduce((sum, row) => sum + row.count, 0);
    const totalAmount = packages.reduce(
      (sum, row) => sum + Number(row.totalAmount),
      0,
    );

    return {
      range,
      packages,
      totalCount,
      totalAmount: String(totalAmount),
      sales: sales.rows.map((row) => ({
        bookingId: row.id,
        clientName: row.client_name,
        clientPhone: row.client_phone,
        startAt: new Date(row.start_at).toISOString(),
        soldAt: new Date(row.created_at).toISOString(),
        status: row.status,
        packageTitle: row.package_title,
        amount: row.price_amount == null ? null : String(row.price_amount),
      })),
    };
  }

  async exportXlsx(range: ReportRange) {
    const report = await this.getReport(range);

    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('По пакетам');
    summarySheet.columns = [
      { header: 'Пакет', key: 'title', width: 30 },
      { header: 'Количество', key: 'count', width: 14 },
      { header: 'Сумма', key: 'amount', width: 16 },
    ];
    summarySheet.getRow(1).font = { bold: true };

    for (const row of report.packages) {
      summarySheet.addRow({
        title: row.packageTitle,
        count: row.count,
        amount: Number(row.totalAmount),
      });
    }

    summarySheet.addRow({});
    const totalRow = summarySheet.addRow({
      title: 'Итого',
      count: report.totalCount,
      amount: Number(report.totalAmount),
    });
    totalRow.font = { bold: true };
    summarySheet.getColumn('amount').numFmt = '#,##0';

    const salesSheet = workbook.addWorksheet('Все продажи');
    salesSheet.columns = [
      { header: 'Дата продажи', key: 'soldAt', width: 18 },
      { header: 'Дата свидания', key: 'startAt', width: 18 },
      { header: 'Пакет', key: 'title', width: 28 },
      { header: 'Клиент', key: 'clientName', width: 22 },
      { header: 'Телефон', key: 'clientPhone', width: 18 },
      { header: 'Сумма', key: 'amount', width: 14 },
      { header: 'Статус', key: 'status', width: 16 },
    ];
    salesSheet.getRow(1).font = { bold: true };

    for (const sale of report.sales) {
      salesSheet.addRow({
        soldAt: this.formatDateTimeAlmaty(sale.soldAt),
        startAt: this.formatDateTimeAlmaty(sale.startAt),
        title: sale.packageTitle || 'Не указан',
        clientName: sale.clientName,
        clientPhone: sale.clientPhone,
        amount: sale.amount == null ? '' : Number(sale.amount),
        status: sale.status,
      });
    }

    salesSheet.getColumn('amount').numFmt = '#,##0';

    return workbook.xlsx.writeBuffer();
  }

  private formatDateTimeAlmaty(iso: string) {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Asia/Almaty',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  }
}
