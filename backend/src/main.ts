import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const frontendUrl = process.env.FRONTEND_URL;

  // Railway sits in front of the app as a reverse proxy — without this,
  // every request looks like it comes from the proxy's own IP, which would
  // make the rate limiter treat all visitors as one client.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.enableCors({
    origin: frontendUrl ? [frontendUrl] : true,
    credentials: true,
  });

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
