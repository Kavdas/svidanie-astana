import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Probed by the host's health check and by the uptime monitor. It has to
   * touch the database: a process that is up but cannot reach Postgres serves
   * nothing but errors, and a health check that only proves the process is
   * running would report that as healthy.
   */
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
