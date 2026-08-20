import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import type { AdminRequest } from './admin-auth.guard';
import { AdminStaffService } from './admin-staff.service';

@UseGuards(AdminAuthGuard)
@Controller('admin/staff')
export class AdminStaffController {
  constructor(private readonly adminStaffService: AdminStaffService) {}

  @Get()
  listStaff(@Req() request: AdminRequest) {
    this.assertIsAdmin(request);
    return this.adminStaffService.listStaff();
  }

  @Post()
  addStaff(
    @Req() request: AdminRequest,
    @Body() body: { email?: string; password?: string; role?: string },
  ) {
    this.assertIsAdmin(request);
    return this.adminStaffService.addStaff(body);
  }

  @Delete(':id')
  removeStaff(@Req() request: AdminRequest, @Param('id') id: string) {
    this.assertIsAdmin(request);
    return this.adminStaffService.removeStaff(id);
  }

  private assertIsAdmin(request: AdminRequest) {
    if (request.adminRole !== 'admin') {
      throw new ForbiddenException('Only admins can manage staff accounts');
    }
  }
}
