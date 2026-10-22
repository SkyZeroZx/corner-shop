import { log } from './log';

interface CacheEntry {
  body: string;
  status: number;
  headers: [string, string][];
  expires: number;
}

/**
 * Plays the CDN in front of SSR. Same key for every visitor: host + URL.
 * It honors Cache-Control the way most CDNs do, and ignores cookies.
 */
export class EdgeCache {
  private readonly entries = new Map<string, CacheEntry>();

  get(key: string): Response | undefined {
    const entry = this.entries.get(key);
    if (!entry || entry.expires < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    const headers = new Headers(entry.headers);
    headers.set('x-cache', 'HIT');
    log(`  edge cache HIT ${key}`);
    return new Response(entry.body, { status: entry.status, headers });
  }

  async store(key: string, response: Response): Promise<Response> {
    const ttl = publicMaxAge(response.headers.get('cache-control'));
    const headers = new Headers(response.headers);

    if (response.status !== 200 || ttl === 0) {
      headers.set('x-cache', 'BYPASS');
      log(`  edge cache BYPASS ${key} (${response.headers.get('cache-control')})`);
      return new Response(response.body, { status: response.status, headers });
    }

    const body = await response.text();
    this.entries.set(key, {
      body,
      status: response.status,
      headers: [...response.headers],
      expires: Date.now() + ttl * 1000,
    });
    headers.set('x-cache', 'MISS');
    log(`  edge cache STORE ${key} for ${ttl}s`);
    return new Response(body, { status: response.status, headers });
  }
}

function publicMaxAge(cacheControl: string | null): number {
  const directives = (cacheControl ?? '')
    .toLowerCase()
    .split(',')
    .map((directive) => directive.trim());

  if (directives.some((d) => d === 'private' || d === 'no-store' || d === 'no-cache')) {
    return 0;
  }
  const maxAge =
    directives.find((d) => d.startsWith('s-maxage=')) ??
    directives.find((d) => d.startsWith('max-age='));
  return maxAge ? Number(maxAge.split('=')[1]) || 0 : 0;
}
