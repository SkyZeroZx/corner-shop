import { inject, Service, signal } from '@angular/core';
import { LAB_MODE } from '../lab/lab-mode';

export type OriginCheckMode = 'naive' | 'whatwg';

/** Lab 1 toggle. Lets you switch the auth interceptor check live. */
@Service()
export class OriginCheck {
  readonly mode = signal<OriginCheckMode>(inject(LAB_MODE) === 'safe' ? 'whatwg' : 'naive');
}
