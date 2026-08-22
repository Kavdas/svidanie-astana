import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { BookingsService } from '../bookings/bookings.service';
import { CreateBookingDto } from '../bookings/dto/create-booking.dto';
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
const ALLOWED_EVENT_STATUSES = ['ожидается', 'подготовлено', 'проведено'];
const ALMATY_OFFSET = '+05:00';

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
  event_status: string;
  created_by_staff_id: string | null;
  created_by_email: string | null;
};

type ScheduleRow = QueryResultRow & {
  id: string;
  package_title: string | null;
  includes: string[] | null;
  client_name: string;
  client_phone: string;
  start_at: Date | string;
  end_at: Date | string;
  comment: string | null;
  event_status: string;
};

@Injectable()
export class AdminBookingsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly bookingsService: BookingsService,
  ) {}

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
          b.event_status,
          b.created_by_staff_id,
          s.email as created_by_email,
          p.title as package_title,
          p.price as package_price
        from bookings b
        left join packages p on p.id = b.package_id
        left join admin_users s on s.id = b.created_by_staff_id
        order by coalesce(b.start_at, b.created_at) desc
        limit 200
      `,
    );

    return {
      bookings: result.rows.map((booking) => this.toAdminBookingResponse(booking)),
    };
  }

  async getSchedule(range: 'today' | 'week') {
    const { from, to } = this.getRangeBounds(range);

    const result = await this.databaseService.query<ScheduleRow>(
      `
        select
          b.id,
          b.client_name,
          b.client_phone,
          b.start_at,
          b.end_at,
          b.comment,
          b.event_status,
          p.title as package_title,
          p.includes
        from bookings b
        left join packages p on p.id = b.package_id
        where b.start_at >= $1
          and b.start_at < $2
          and b.status not in ('Отменено', 'cancelled')
        order by b.start_at asc
      `,
      [from, to],
    );

    return {
      schedule: result.rows.map((row) => ({
        bookingId: row.id,
        clientName: row.client_name,
        clientPhone: row.client_phone,
        startAt: new Date(row.start_at).toISOString(),
        endAt: new Date(row.end_at).toISOString(),
        comment: row.comment,
        eventStatus: row.event_status,
        packageTitle: row.package_title,
        includes: Array.isArray(row.includes) ? row.includes : [],
      })),
    };
  }

  async createBookingForStaff(dto: CreateBookingDto, staffId: string) {
    return this.bookingsService.createBooking(dto, staffId);
  }

  async rescheduleBooking(id: string, startAt?: string) {
    if (!startAt) {
      throw new BadRequestException('startAt is required');
    }

    return this.bookingsService.rescheduleBooking(id, startAt);
  }

  async updateBookingStatus(id: string, status?: string) {
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      throw new BadRequestException('Unsupported booking status');
    }

    const result = await this.databaseService.query<{ id: string; status: string }>(
      `
        update bookings
        set status = $2
        where id = $1
        returning id, status
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

  async updateEventStatus(id: string, eventStatus?: string) {
    if (!eventStatus || !ALLOWED_EVENT_STATUSES.includes(eventStatus)) {
      throw new BadRequestException('Unsupported event status');
    }

    const result = await this.databaseService.query<{ id: string; event_status: string }>(
      `
        update bookings
        set event_status = $2
        where id = $1
        returning id, event_status
      `,
      [id, eventStatus],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Booking not found');
    }

    return {
      bookingId: result.rows[0].id,
      eventStatus: result.rows[0].event_status,
    };
  }

  private toAdminBookingResponse(booking: AdminBookingRow) {
    return {
      bookingId: booking.id,
      packageId: booking.package_id,
      packageTitle: booking.package_title,
      packagePrice:
        booking.package_price == null ? null : String(booking.package_price),
      clientName: booking.client_name,
      clientPhone: booking.client_phone,
      startAt: booking.start_at ? new Date(booking.start_at).toISOString() : null,
      endAt: booking.end_at ? new Date(booking.end_at).toISOString() : null,
      lockedUntil: booking.locked_until
        ? new Date(booking.locked_until).toISOString()
        : null,
      status: booking.status,
      comment: booking.comment,
      createdAt: booking.created_at ? new Date(booking.created_at).toISOString() : null,
      depositAmount:
        booking.deposit_amount == null ? null : String(booking.deposit_amount),
      paymentStatus: booking.payment_status,
      eventStatus: booking.event_status,
      createdByEmail: booking.created_by_email,
    };
  }

  private getRangeBounds(range: 'today' | 'week') {
    const now = new Date();
    const todayAlmaty = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Almaty',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const from = new Date(`${todayAlmaty}T00:00:00${ALMATY_OFFSET}`);
    const days = range === 'week' ? 7 : 1;
    const to = new Date(from.getTime() + days * 24 * 60 * 60_000);

    return { from: from.toISOString(), to: to.toISOString() };
  }
}
