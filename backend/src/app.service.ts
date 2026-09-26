import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth(): Promise<{ status: 'ok'; database: 'ok'; uptime: number }> {
    try {
      await this.databaseService.query('select 1');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Health check failed: ${message}`);

      // 503 rather than a 200 body saying "degraded", so any uptime monitor
      // flags it without having to parse the response.
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unreachable',
      });
    }

    return {
      status: 'ok',
      database: 'ok',
      uptime: Math.round(process.uptime()),
    };
  }
}
