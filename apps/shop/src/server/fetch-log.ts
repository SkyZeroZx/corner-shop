import { log } from './log';

const SENSITIVE = ['authorization', 'cookie', 'x-session', 'x-internal-key'];

/**
 * Prints what really leaves the SSR server, after every interceptor ran.
 * Angular's FetchBackend calls globalThis.fetch, so wrapping it is enough.
 */
export function logOutgoingFetch(): void {
  const nativeFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    const carrying = SENSITIVE.filter((name) => headers.has(name));
    log(
      `fetch sent       ${init?.method ?? 'GET'} ${url}` +
        (carrying.length ? `  carrying ${carrying.join(', ')}` : ''),
    );

    try {
      const response = await nativeFetch(input, init);
      if (response.redirected) {
        log(`  ↪ followed a redirect to ${response.url}`);
      }
      return response;
    } catch (error) {
      const { message, cause } = error as Error & { cause?: Error };
      log(`  ✖ ${cause?.message ?? message}`);
      throw error;
    }
  };
}
