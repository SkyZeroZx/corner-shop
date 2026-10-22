import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { SAFE } from './app/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(
    `\x1b[36m[api]\x1b[0m Corner Shop API on http://localhost:${port}/api (${SAFE ? 'safe' : 'unsafe'} mode)`,
  );
}

bootstrap();
