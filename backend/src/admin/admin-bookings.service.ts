import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';

const ALLOWED_STATUSES = [
  'Новая',
  'Связались',
  'Ожидает оплату',
  'Оплачено',
  'Отменено',
  'manager_confirmed',
  'pending_payment',
  'paid',
  'cancelled',
];

const ALLOWED_PAYMENT_STATUSES = ['on_review', 'paid', null];

type AdminBookingRow = QueryResultRow & {
  id: string;
  package_id: string | null;
  package_title: string | null;
  package_price: string | number | null;
  client_name: string;
  client_phone: string;
  start_at: Date | string | null;
  end_at: Date | string | null;
  locked_until: Date | string | null;
  status: string;
  comment: string | null;
  created_at: Date | string | null;
  deposit_amount: string | number | null;
  payment_status: string | null;
};

@Injectable()
export class AdminBookingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getBookings() {
    const result = await this.databaseService.query<AdminBookingRow>(
      `
        select
          b.id,
          b.package_id,
          b.client_name,
          b.client_phone,
          b.start_at,
          b.end_at,
          b.locked_until,
          b.status,
          b.comment,
          b.created_at,
          b.deposit_amount,
          b.payment_status,
          p.title as package_title,
          p.price as package_price
        from bookings b
        left join packages p on p.id = b.package_id
        order by coalesce(b.start_at, b.created_at) desc
        limit 200
      `,
    );

    return {
      bookings: result.rows.map((booking) => ({
        bookingId: booking.id,
        packageId: booking.package_id,
        packageTitle: booking.package_title,
        packagePrice:
          booking.package_price == null ? null : String(booking.package_price),
        clientName: booking.client_name,
        clientPhone: booking.client_phone,
        startAt: booking.start_at
          ? new Date(booking.start_at).toISOString()
          : null,
        endAt: booking.end_at ? new Date(booking.end_at).toISOString() : null,
        lockedUntil: booking.locked_until
          ? new Date(booking.locked_until).toISOString()
          : null,
        status: booking.status,
        comment: booking.comment,
        createdAt: booking.created_at
          ? new Date(booking.created_at).toISOString()
          : null,
        depositAmount:
          booking.deposit_amount == null ? null : String(booking.deposit_amount),
        paymentStatus: booking.payment_status,
      })),
    };
  }

  async updateBookingStatus(id: string, status?: string) {
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      throw new BadRequestException('Unsupported booking status');
    }

    const result = await this.databaseService.query<AdminBookingRow>(
      `
        update bookings
        set status = $2
        where id = $1
        returning
          id,
          package_id,
          client_name,
          client_phone,
          start_at,
          end_at,
          locked_until,
          status,
          comment,
          created_at,
          null::text as package_title,
          null::text as package_price
      `,
      [id, status],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Booking not found');
    }

    return {
      bookingId: result.rows[0].id,
      status: result.rows[0].status,
    };
  }

  async updatePaymentStatus(id: string, paymentStatus: string | null | undefined) {
    const normalizedStatus = paymentStatus ?? null;

    if (!ALLOWED_PAYMENT_STATUSES.includes(normalizedStatus)) {
      throw new BadRequestException('Unsupported payment status');
    }

    const nextBookingStatus = normalizedStatus === 'paid' ? 'Оплачено' : null;

    const result = await this.databaseService.query<AdminBookingRow>(
      `
        update bookings
        set payment_status = $2,
            status = coalesce($3, status)
        where id = $1
        returning id, payment_status, status
      `,
      [id, normalizedStatus, nextBookingStatus],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Booking not found');
    }

    return {
      bookingId: result.rows[0].id,
      paymentStatus: result.rows[0].payment_status,
      status: result.rows[0].status,
    };
  }
}
