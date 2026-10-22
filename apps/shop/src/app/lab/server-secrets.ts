import { InjectionToken } from '@angular/core';

/** Only provided on the server. The browser bundle never sees these values. */
export interface ServerSecrets {
  /** Where the API really lives. Comes from config, never from the incoming request. */
  apiOrigin: string;
  /** Tells the API that a call comes from our SSR server. */
  internalKey: string;
}

export const SERVER_SECRETS = new InjectionToken<ServerSecrets>('SERVER_SECRETS');
