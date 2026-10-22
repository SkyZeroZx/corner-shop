import { isPlatformServer } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { DOCUMENT, inject, PLATFORM_ID } from '@angular/core';
import { OriginCheck } from '../core/origin-check';
import { SessionStore } from '../core/session-store';
import { LAB_MODE } from '../lab/lab-mode';
import { isSameOrigin, looksRelative, pathOf, PRIVATE_APIS } from './first-party';

/** Browser side. Attaches the user's token to "our" requests. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (isPlatformServer(inject(PLATFORM_ID))) {
    return next(req);
  }

  const token = inject(SessionStore).accessToken();
  const origin = inject(DOCUMENT).location.origin;

  // Lab 1: same question, two parsers.
  const ours =
    inject(OriginCheck).mode() === 'whatwg'
      ? isSameOrigin(req.url, origin)
      : looksRelative(req.url);

  if (token && ours) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  if (inject(LAB_MODE) === 'safe') {
    // Lab 3: calls to our API do not follow redirects, in the browser either.
    if (ours) {
      req = req.clone({ redirect: 'error' });
    }
    // Lab 5: private responses must not land in the Service Worker cache.
    if (PRIVATE_APIS.includes(pathOf(req.url, origin))) {
      req = req.clone({ setHeaders: { 'ngsw-bypass': 'true' } });
    }
  }

  return next(req);
};
