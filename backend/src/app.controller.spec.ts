import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';

describe('AppController', () => {
  let appController: AppController;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue({ rows: [] });

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: DatabaseService, useValue: { query } }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('reports ok when the database answers', async () => {
      await expect(appController.getHealth()).resolves.toMatchObject({
        status: 'ok',
        database: 'ok',
      });
      expect(query).toHaveBeenCalledWith('select 1');
    });

    it('fails with 503 when the database is unreachable', async () => {
      query.mockRejectedValue(new Error('connection refused'));

      await expect(appController.getHealth()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
