import { isPlatformServer } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID, REQUEST, RESPONSE_INIT } from '@angular/core';
import { LAB_MODE } from '../lab/lab-mode';
import { SERVER_SECRETS } from '../lab/server-secrets';
import { PRIVATE_APIS, readCookie } from './first-party';

/**
 * Server side. During SSR the server calls the API on behalf of the user, with two things
 * the browser never has: the internal key, which tells the API the call comes from our SSR
 * server, and the user's session, forwarded as X-Session.
 */
export const serverApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformServer(inject(PLATFORM_ID))) {
    return next(req);
  }

  const { apiOrigin, internalKey } = inject(SERVER_SECRETS);
  const cookie = inject(REQUEST, { optional: true })?.headers.get('cookie');
  const sessionId = readCookie(cookie, 'sid');
  console.log(`\x1b[35m[ssr]\x1b[0m interceptor saw  ${req.method} ${req.url}`);

  if (inject(LAB_MODE) === 'unsafe') {
    // "If it starts with /, it is our API", so the key and the session go on every call.
    // Angular resolves the URL later, against the incoming Host header,
    // and fetch follows whatever redirect comes back.
    if (!req.url.startsWith('/')) {
      return next(req);
    }
    const headers: Record<string, string> = { 'X-Internal-Key': internalKey };
    if (sessionId) {
      headers['X-Session'] = sessionId;
    }
    return next(req.clone({ setHeaders: headers }));
  }

  // Safe: calls to our API never follow a redirect, and secrets go only where they are needed.
  const target = new URL(req.url, apiOrigin);
  if (target.origin !== new URL(apiOrigin).origin) {
    return next(req);
  }
  if (!sessionId || !PRIVATE_APIS.includes(target.pathname)) {
    // Public data. Angular resolves it against a Host that allowedHosts already checked.
    return next(req.clone({ redirect: 'error' }));
  }

  // This render used the session, so this HTML belongs to one person.
  markHtmlAsPrivate(inject(RESPONSE_INIT, { optional: true }));
  return next(
    req.clone({
      url: target.href, // the API origin comes from config, never from the request
      setHeaders: { 'X-Internal-Key': internalKey, 'X-Session': sessionId },
      redirect: 'error', // secrets never follow a redirect
      transferCache: false, // private data stays out of ng-state
    }),
  );
};

function markHtmlAsPrivate(init: ResponseInit | null): void {
  if (!init) {
    return;
  }
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store');
  init.headers = headers;
}
