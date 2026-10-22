import { applyDecorators, Controller, Get, Header, UseGuards } from '@nestjs/common';
import { SAFE } from './config';
import { ORDERS, PROFILES, UserId } from './data';
import { CurrentUser, SessionGuard } from './guards';

/**
 * Safe mode only. Angular 22's HttpTransferCache skips responses marked
 * `private`, `no-store` or `no-cache`, and a well-behaved CDN does too.
 * The unsafe mode answers without Cache-Control, which is what most APIs do.
 */
const PrivateInSafeMode = () =>
  applyDecorators(...(SAFE ? [Header('Cache-Control', 'private, no-store')] : []));

/** Everything here belongs to one user. */
@Controller()
@UseGuards(SessionGuard)
export class AccountController {
  @Get('me')
  @PrivateInSafeMode()
  me(@CurrentUser() user: UserId) {
    return PROFILES[user];
  }

  @Get('orders')
  @PrivateInSafeMode()
  orders(@CurrentUser() user: UserId) {
    return { owner: PROFILES[user].name, orders: ORDERS[user] };
  }
}
