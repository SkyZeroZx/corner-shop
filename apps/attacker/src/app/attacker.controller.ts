import { All, Controller, Delete, Get, HttpCode, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CapturesService } from './captures.service';

/** What the campaign site serves now that the attacker owns it. */
const FAKE_DEALS = [{ title: 'iPhone 17 Pro, today only', price: 1 }];

@Controller()
export class AttackerController {
  constructor(private readonly captures: CapturesService) {}

  @Get('__log')
  entries() {
    return this.captures.entries;
  }

  @Delete('__log')
  @HttpCode(204)
  clear() {
    this.captures.clear();
  }

  /** Whatever the victim asks for, answer something plausible. */
  @All('*path')
  anything(@Req() req: Request) {
    return req.path.includes('deals') ? FAKE_DEALS : { ok: true };
  }
}
