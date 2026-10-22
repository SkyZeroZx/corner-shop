/** APIs whose responses belong to one user. */
export const PRIVATE_APIS = ['/api/me', '/api/orders'];

/**
 * What a lot of apps ship: "if it is not absolute, it is ours".
 * Same idea as the regex Angular's XSRF interceptor used before 21.0.3 and 20.3.34.
 */
export function looksRelative(url: string): boolean {
  return !/^(?:https?:)?\/\//i.test(url);
}

/** Decide with the same parser that will send the request. */
export function isSameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url, origin).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

export function pathOf(url: string, base = 'http://placeholder'): string {
  return new URL(url, base).pathname;
}

export function readCookie(header: string | null | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(value.join('='));
    }
  }
  return undefined;
}
