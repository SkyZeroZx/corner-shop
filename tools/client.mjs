// Requests that labs.mjs and verify.mjs send to the running stack.
import { request } from 'node:http';
import { URLS } from './servers.mjs';

export async function captures() {
  return (await fetch(`${URLS.attacker}/__log`)).json();
}

export async function clearCaptures() {
  await fetch(`${URLS.attacker}/__log`, { method: 'DELETE' });
}

/** Signs in through the shop, like the browser does: the sid cookie and the Bearer token. */
export async function session(user) {
  const response = await fetch(`${URLS.shop}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user }),
  });
  const cookie = response.headers.getSetCookie().find((c) => c.startsWith('sid='));
  const { accessToken } = await response.json();
  return { sid: cookie.split(';')[0].slice('sid='.length), accessToken };
}

export async function signIn(user) {
  return (await session(user)).sid;
}

/** GET from the shop with node:http, because fetch() does not let you pick the Host header. */
export function rawGet(path, headers) {
  return new Promise((resolve, reject) => {
    const req = request(
      { hostname: 'localhost', port: 4000, path, headers: { host: 'localhost:4000', ...headers } },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}
