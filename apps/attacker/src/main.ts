import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app/app.module';

/** Runs before `cors` answers the preflight, so the console shows what was asked. */
function logPreflight(req: Request, _res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') {
    const asked = (req.header('access-control-request-headers') ?? '')
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean)
      .join(', ');
    console.log(
      `\x1b[31m[attacker]\x1b[0m preflight ${req.originalUrl}  asks for: ${asked || '(none)'}  → yes`,
    );
  }
  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });

  // CORS protects the server that answers, and here the attacker is that server.
  // `origin: true` reflects any Origin. Without `allowedHeaders`, cors reflects
  // whatever the preflight asks for: `*` would not cover Authorization.
  app.use(logPreflight);
  app.enableCors({ origin: true });

  const port = Number(process.env.PORT ?? 9999);
  await app.listen(port);
  console.log(
    `\x1b[31m[attacker]\x1b[0m listening on http://localhost:${port} (captures at /__log)`,
  );
}

bootstrap();
