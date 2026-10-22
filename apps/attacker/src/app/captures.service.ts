import { Injectable } from '@nestjs/common';

const MAX_ENTRIES = 200;

export interface Capture {
  at: string;
  method: string;
  url: string;
  origin: string | null;
  headers: Record<string, string>;
}

/** What reached the attacker, oldest first. GET /__log serves it. */
@Injectable()
export class CapturesService {
  readonly entries: Capture[] = [];

  add(entry: Capture) {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
    }
  }

  clear() {
    this.entries.length = 0;
  }
}
