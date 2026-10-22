import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { isUserId, PROFILES } from './data';
import { SessionsService } from './sessions.service';

@Controller('session')
export class SessionController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  signIn(@Body() body: { user?: unknown } | undefined, @Res({ passthrough: true }) res: Response) {
    const user = body?.user;
    if (!isUserId(user)) {
      throw new BadRequestException('Unknown user');
    }

    const { sessionId, accessToken, xsrfToken } = this.sessions.create(user);
    res.cookie('sid', sessionId, { httpOnly: true, sameSite: 'lax' });
    // Readable by JavaScript on purpose: Angular copies it into X-XSRF-TOKEN.
    res.cookie('XSRF-TOKEN', xsrfToken, { sameSite: 'lax' });

    return { name: PROFILES[user].name, accessToken };
  }

  @Delete()
  @HttpCode(204)
  signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.sessions.end(req);
    res.clearCookie('sid');
    res.clearCookie('XSRF-TOKEN');
  }
}
