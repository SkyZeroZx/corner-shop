import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { INTERNAL_API_KEY } from './config';
import { UserId } from './data';

export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(value.join('='));
    }
  }
  return undefined;
}

function credentials(req: Request) {
  const fromSsr = req.header('x-internal-key') === INTERNAL_API_KEY;
  return {
    forwarded: fromSsr ? req.header('x-session') : undefined,
    cookie: readCookie(req.header('cookie'), 'sid'),
    bearer: req.header('authorization')?.replace(/^Bearer /, ''),
  };
}

@Injectable()
export class SessionsService {
  private readonly bySessionId = new Map<string, UserId>();
  private readonly byAccessToken = new Map<string, UserId>();

  create(user: UserId) {
    const sessionId = `sid_${user}_${randomBytes(6).toString('hex')}`;
    const accessToken = `at_${user}_${randomBytes(6).toString('hex')}`;
    const xsrfToken = randomBytes(16).toString('hex');
    this.bySessionId.set(sessionId, user);
    this.byAccessToken.set(accessToken, user);
    return { sessionId, accessToken, xsrfToken };
  }

  /**
   * The browser sends the `sid` cookie or a bearer token. The SSR server forwards the
   * session as `X-Session`, which only counts next to the internal key.
   */
  userFrom(req: Request): UserId | undefined {
    const { forwarded, cookie, bearer } = credentials(req);
    return (
      (forwarded && this.bySessionId.get(forwarded)) ||
      (cookie && this.bySessionId.get(cookie)) ||
      (bearer && this.byAccessToken.get(bearer)) ||
      undefined
    );
  }

  /** Sign-out ends the session on the server too, not only in this browser. */
  end(req: Request) {
    const { cookie, bearer } = credentials(req);
    if (cookie) {
      this.bySessionId.delete(cookie);
    }
    if (bearer) {
      this.byAccessToken.delete(bearer);
    }
  }
}
