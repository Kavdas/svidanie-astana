import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { DatabaseService } from '../database/database.service';

export type AdminRole = 'admin' | 'manager' | 'organizer';

export interface AdminRequest extends Request {
  adminRole?: AdminRole;
  adminUserId?: string;
  /** admin_users.id (not the Supabase auth user id) — use for FKs like bookings.created_by_staff_id */
  adminStaffId?: string;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const token = this.getBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Admin authorization token is missing');
    }

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new UnauthorizedException('Admin auth is not configured');
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Admin authorization failed');
    }

    const user = (await response.json()) as { id?: string };

    if (!user.id) {
      throw new UnauthorizedException('Admin authorization failed');
    }

    const staffResult = await this.databaseService.query<{
      id: string;
      role: AdminRole;
    }>('select id, role from admin_users where user_id = $1 limit 1', [user.id]);

    const staffRow = staffResult.rows[0];

    if (!staffRow) {
      throw new ForbiddenException('This account has no admin access');
    }

    request.adminRole = staffRow.role;
    request.adminUserId = user.id;
    request.adminStaffId = staffRow.id;

    return true;
  }

  private getBearerToken(request: Request) {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    return authorization.slice('Bearer '.length).trim();
  }
}
