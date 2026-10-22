import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CapturesService } from './captures.service';

/** Headers worth stealing. Anything else is noise for this demo. */
const INTERESTING = ['authorization', 'cookie', 'x-session', 'x-internal-key', 'x-xsrf-token'];

/** Writes down every request that reaches the attacker, and what it carried. */
@Injectable()
export class CaptureMiddleware implements NestMiddleware {
  constructor(private readonly captures: CapturesService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const headers: Record<string, string> = {};
    for (const name of INTERESTING) {
      const value = req.header(name);
      if (value) {
        headers[name] = value;
      }
    }

    this.captures.add({
      at: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      origin: req.header('origin') ?? null,
      headers,
    });

    const stolen = Object.entries(headers)
      .map(([name, value]) => `${name}=${value}`)
      .join('  ');
    console.log(
      `\x1b[31m[attacker]\x1b[0m ${req.method} ${req.originalUrl}  ${stolen || '(nothing interesting)'}`,
    );
    next();
  }
}
