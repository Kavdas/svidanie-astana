import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { TelegramService } from '../telegram/telegram.service';
import { AvailableSlotsDto } from './dto/available-slots.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

const ACTIVE_STATUSES = [
  'Новая',
  'Связались',
  'Ожидает оплату',
  'Оплачено',
  'manager_confirmed',
  'pending_payment',
  'paid',
];
const DEFAULT_PREP_MINUTES = 30;
const SLOT_STEP_MINUTES = 30;
const ALMATY_OFFSET = '+05:00';
const LOCATION_ID = 'main';
const NEW_BOOKING_STATUS = 'Новая';

const DEPOSIT_RATE = 0.5;

type PackageRow = QueryResultRow & {
  id: string;
  title: string;
  price: string | number | null;
  price_amount: string | number | null;
  duration_minutes: number | null;
  prep_minutes: number | null;
};

type BookingRow = QueryResultRow & {
  id: string;
  package_id: string;
  package_title: string | null;
  package_price: string | number | null;
  client_name: string;
  client_phone: string;
  start_at: Date | string;
  end_at: Date | string;
  locked_until: Date | string;
  status: string;
  comment: string | null;
  location_id: string | null;
  deposit_amount: string | number | null;
  payment_status: string | null;
};

type Slot = {
  startAt: string;
  endAt: string;
  lockedUntil: string;
  displayLabel: string;
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly telegramService: TelegramService,
  ) {}

  async getAvailableSlots(dto: AvailableSlotsDto): Promise<{ slots: Slot[] }> {
    const packageRow = await this.getPackage(dto.packageId);
    const durationMinutes = this.getDurationMinutes(packageRow);
    const prepMinutes = this.getPrepMinutes(packageRow);
    const dayStart = this.localDateTimeToDate(dto.date, '10:00');
    const dayEnd = this.localDateTimeToDate(this.addDays(dto.date, 1), '02:00');

    const busyRows = await this.databaseService.query<{
      start_at: Date | string;
      locked_until: Date | string;
    }>(
      `
        select start_at, locked_until
        from bookings
        where location_id = $1
          and status = any($2)
          and start_at is not null
          and locked_until is not null
          and start_at < $4
          and locked_until > $3
      `,
      [LOCATION_ID, ACTIVE_STATUSES, dayStart.toISOString(), dayEnd.toISOString()],
    );

    const busyIntervals = busyRows.rows.map((row) => ({
      start: new Date(row.start_at).getTime(),
      end: new Date(row.locked_until).getTime(),
    }));
    const slots: Slot[] = [];

    for (
      let start = dayStart.getTime();
      start + durationMinutes * 60_000 <= dayEnd.getTime();
      start += SLOT_STEP_MINUTES * 60_000
    ) {
      const end = start + durationMinutes * 60_000;
      const lockedUntil = end + prepMinutes * 60_000;

      if (
        busyIntervals.some(
          (interval) => start < interval.end && lockedUntil > interval.start,
        )
      ) {
        continue;
      }

      const startDate = new Date(start);
      const endDate = new Date(end);
      const lockedUntilDate = new Date(lockedUntil);

      slots.push({
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
        lockedUntil: lockedUntilDate.toISOString(),
        displayLabel: this.formatDisplayLabel(startDate),
      });
    }

    return { slots };
  }

  async createBooking(dto: CreateBookingDto, createdByStaffId: string | null = null) {
    const packageRow = await this.getPackage(dto.packageId);
    const startAt = new Date(dto.startAt);

    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('startAt must be a valid ISO datetime');
    }

    const durationMinutes = this.getDurationMinutes(packageRow);
    const prepMinutes = this.getPrepMinutes(packageRow);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
    const lockedUntil = new Date(endAt.getTime() + prepMinutes * 60_000);
    const depositAmount = this.getDepositAmount(packageRow);

    await this.assertSlotIsFree(startAt, lockedUntil);

    try {
      const inserted = await this.databaseService.query<BookingRow>(
        `
          insert into bookings (
            package_id,
            client_name,
            client_phone,
            start_at,
            end_at,
            locked_until,
            location_id,
            status,
            comment,
            deposit_amount,
            created_by_staff_id
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          returning
            id,
            package_id,
            client_name,
            client_phone,
            start_at,
            end_at,
            locked_until,
            location_id,
            status,
            comment,
            deposit_amount,
            payment_status,
            $12::text as package_title,
            $13::text as package_price
        `,
        [
          dto.packageId,
          dto.clientName,
          dto.clientPhone,
          startAt.toISOString(),
          endAt.toISOString(),
          lockedUntil.toISOString(),
          LOCATION_ID,
          NEW_BOOKING_STATUS,
          dto.comment ?? null,
          depositAmount,
          createdByStaffId,
          packageRow.title,
          packageRow.price == null ? null : String(packageRow.price),
        ],
      );
      const booking = inserted.rows[0];

      await this.telegramService.sendBookingCreated({
        bookingId: booking.id,
        clientName: booking.client_name,
        clientPhone: booking.client_phone,
        packageTitle: packageRow.title,
        packagePrice: packageRow.price == null ? null : String(packageRow.price),
        startAt: this.formatDisplayLabel(startAt),
        endAt: this.formatTime(endAt),
        comment: booking.comment,
      });

      return this.toBookingResponse(booking);
    } catch (error) {
      if (this.isConflictError(error)) {
        throw new ConflictException('Selected slot is already booked');
      }

      throw error;
    }
  }

  async getBooking(id: string) {
    const result = await this.databaseService.query<BookingRow>(
      `
        select
          b.id,
          b.package_id,
          b.client_name,
          b.client_phone,
          b.start_at,
          b.end_at,
          b.locked_until,
          b.location_id,
          b.status,
          b.comment,
          b.deposit_amount,
          b.payment_status,
          p.title as package_title,
          p.price as package_price
        from bookings b
        left join packages p on p.id = b.package_id
        where b.id = $1
        limit 1
      `,
      [id],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Booking not found');
    }

    return this.toBookingResponse(result.rows[0]);
  }

  async claimPayment(id: string) {
    const result = await this.databaseService.query<BookingRow>(
      `
        update bookings
        set payment_status = 'on_review'
        where id = $1
        returning
          id,
          client_name,
          client_phone,
          deposit_amount,
          payment_status
      `,
      [id],
    );

    const booking = result.rows[0];

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const depositAmount =
      booking.deposit_amount == null ? 'не рассчитана' : `${booking.deposit_amount} тг`;

    await this.telegramService.sendMessage(
      [
        '<b>Клиент отметил предоплату как оплаченную</b>',
        '',
        `Booking ID: ${booking.id}`,
        `Клиент: ${booking.client_name}`,
        `Телефон: ${booking.client_phone}`,
        `Сумма предоплаты: ${depositAmount}`,
        '',
        'Проверьте поступление в Kaspi и подтвердите оплату в админ-панели.',
      ].join('\n'),
    );

    return {
      bookingId: booking.id,
      paymentStatus: booking.payment_status,
    };
  }

  private async getPackage(packageId: string): Promise<PackageRow> {
    const result = await this.databaseService.query<PackageRow>(
      `
        select id, title, price, price_amount, duration_minutes, prep_minutes
        from packages
        where id = $1
        limit 1
      `,
      [packageId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Package not found');
    }

    return result.rows[0];
  }

  private getDepositAmount(packageRow: PackageRow) {
    if (packageRow.price_amount == null) {
      return null;
    }

    const priceAmount = Number(packageRow.price_amount);

    if (!Number.isFinite(priceAmount)) {
      return null;
    }

    return Math.round(priceAmount * DEPOSIT_RATE);
  }

  private async assertSlotIsFree(startAt: Date, lockedUntil: Date) {
    const result = await this.databaseService.query(
      `
        select id
        from bookings
        where location_id = $1
          and status = any($2)
          and start_at is not null
          and locked_until is not null
          and start_at < $4
          and locked_until > $3
        limit 1
      `,
      [LOCATION_ID, ACTIVE_STATUSES, startAt.toISOString(), lockedUntil.toISOString()],
    );

    if (result.rows.length > 0) {
      throw new ConflictException('Selected slot is already booked');
    }
  }

  private toBookingResponse(booking: BookingRow) {
    return {
      bookingId: booking.id,
      status: booking.status,
      packageTitle: booking.package_title,
      packagePrice:
        booking.package_price == null ? null : String(booking.package_price),
      startAt: new Date(booking.start_at).toISOString(),
      endAt: new Date(booking.end_at).toISOString(),
      lockedUntil: new Date(booking.locked_until).toISOString(),
      depositAmount:
        booking.deposit_amount == null ? null : String(booking.deposit_amount),
      paymentStatus: booking.payment_status,
    };
  }

  private getDurationMinutes(packageRow: PackageRow) {
    return packageRow.duration_minutes ?? 60;
  }

  private getPrepMinutes(packageRow: PackageRow) {
    return packageRow.prep_minutes ?? DEFAULT_PREP_MINUTES;
  }

  private localDateTimeToDate(date: string, time: string) {
    return new Date(`${date}T${time}:00${ALMATY_OFFSET}`);
  }

  private addDays(date: string, days: number) {
    const value = new Date(`${date}T00:00:00${ALMATY_OFFSET}`);
    value.setUTCDate(value.getUTCDate() + days);
    return this.formatDateInAlmaty(value);
  }

  private formatDisplayLabel(date: Date) {
    return `${this.formatDateInAlmaty(date).split('-').reverse().slice(0, 2).join('.')} ${this.formatTime(date)}`;
  }

  private formatDateInAlmaty(date: Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Almaty',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private formatTime(date: Date) {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Asia/Almaty',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  private isConflictError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23P01'
    );
  }
}
