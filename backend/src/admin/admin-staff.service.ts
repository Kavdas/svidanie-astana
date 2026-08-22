import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AdminRole } from './admin-auth.guard';

const ALLOWED_ROLES: AdminRole[] = ['admin', 'manager', 'organizer'];

type StaffRow = QueryResultRow & {
  id: string;
  email: string;
  role: AdminRole;
  created_at: Date | string;
};

@Injectable()
export class AdminStaffService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async listStaff() {
    const result = await this.databaseService.query<StaffRow>(
      'select id, email, role, created_at from admin_users order by created_at asc',
    );

    return {
      staff: result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        createdAt: new Date(row.created_at).toISOString(),
      })),
    };
  }

  async addStaff(params: { email?: string; password?: string; role?: string }) {
    const email = params.email?.trim().toLowerCase();
    const password = params.password;
    const role = params.role as AdminRole;

    if (!email || !password || password.length < 8) {
      throw new BadRequestException(
        'email and a password of at least 8 characters are required',
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      throw new BadRequestException(
        'role must be "admin", "manager" or "organizer"',
      );
    }

    const supabaseUserId = await this.createSupabaseUser(email, password);

    try {
      const inserted = await this.databaseService.query<StaffRow>(
        `
          insert into admin_users (user_id, email, role)
          values ($1, $2, $3)
          returning id, email, role, created_at
        `,
        [supabaseUserId, email, role],
      );

      const row = inserted.rows[0];

      return {
        id: row.id,
        email: row.email,
        role: row.role,
        createdAt: new Date(row.created_at).toISOString(),
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('This account already has admin access');
      }

      throw error;
    }
  }

  async resetPassword(id: string, password?: string) {
    if (!password || password.length < 8) {
      throw new BadRequestException(
        'password must be at least 8 characters',
      );
    }

    const existing = await this.databaseService.query<{ user_id: string }>(
      'select user_id from admin_users where id = $1',
      [id],
    );

    const userId = existing.rows[0]?.user_id;

    if (!userId) {
      throw new NotFoundException('Staff member not found');
    }

    const { supabaseUrl, serviceRoleKey } = this.getSupabaseAdminConfig();

    const response = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${userId}`,
      {
        method: 'PUT',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      },
    );

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        msg?: string;
        message?: string;
      };

      throw new InternalServerErrorException(
        data.msg || data.message || 'Failed to update password',
      );
    }

    return { updated: true };
  }

  async removeStaff(id: string) {
    const result = await this.databaseService.query(
      'delete from admin_users where id = $1 returning id',
      [id],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Staff member not found');
    }

    return { removed: true };
  }

  private getSupabaseAdminConfig() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !serviceRoleKey) {
      throw new InternalServerErrorException(
        'Supabase service role key is not configured',
      );
    }

    return { supabaseUrl, serviceRoleKey };
  }

  private async createSupabaseUser(email: string, password: string) {
    const { supabaseUrl, serviceRoleKey } = this.getSupabaseAdminConfig();

    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      msg?: string;
      message?: string;
    };

    if (!response.ok || !data.id) {
      const message = data.msg || data.message || 'Failed to create account';

      if (response.status === 422 || /already/i.test(message)) {
        throw new ConflictException(message);
      }

      throw new InternalServerErrorException(message);
    }

    return data.id;
  }

  private isUniqueViolation(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
