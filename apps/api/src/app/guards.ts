import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserId } from './data';
import { readCookie, SessionsService } from './sessions.service';

type SignedInRequest = Request & { user: UserId };

/** Signed-in users only. The user is then available through @CurrentUser(). */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionsService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<SignedInRequest>();
    const user = this.sessions.userFrom(req);
    if (!user) {
      throw new UnauthorizedException('Sign in first');
    }
    req.user = user;
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<SignedInRequest>().user,
);

/** Double submit: the X-XSRF-TOKEN header must repeat the XSRF-TOKEN cookie. */
@Injectable()
export class XsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const cookie = readCookie(req.header('cookie'), 'XSRF-TOKEN');
    if (!cookie || cookie !== req.header('x-xsrf-token')) {
      throw new ForbiddenException('XSRF token mismatch');
    }
    return true;
  }
}
