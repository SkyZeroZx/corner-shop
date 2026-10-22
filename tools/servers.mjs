import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

export const URLS = {
  shop: 'http://localhost:4000',
  api: 'http://localhost:3000/api',
  attacker: 'http://localhost:9999',
};

function definitions(safe) {
  return [
    { name: 'attacker', entry: 'dist/apps/attacker/main.js', env: { PORT: '9999' } },
    { name: 'api', entry: 'dist/apps/api/main.js', env: { PORT: '3000' } },
    {
      name: 'shop',
      entry: 'dist/apps/shop/server/server.mjs',
      env: {
        PORT: '4000',
        API_ORIGIN: 'http://localhost:3000',
        // Unsafe: the "fix" someone shipped for the 400s behind the load balancer.
        ...(safe ? {} : { NG_ALLOWED_HOSTS: '*' }),
      },
    },
  ];
}

/** Exits with a hint when a production build is missing. */
export function requireBuilds() {
  const missing = definitions(false)
    .filter(({ entry }) => !existsSync(new URL(`../${entry}`, import.meta.url)))
    .map(({ name }) => name);
  if (missing.length) {
    console.error(`Missing builds: ${missing.join(', ')}. Run "npm run build" first.`);
    process.exit(1);
  }
}

/** Spawns the three servers directly, so each one can be stopped on any OS. */
export function startServers({ safe, stdio = 'inherit' }) {
  return definitions(safe).map(({ name, entry, env }) => {
    const child = spawn(process.execPath, [entry], {
      cwd: ROOT,
      stdio,
      env: { ...process.env, ...env, SAFE: safe ? '1' : '0' },
    });
    child.serverName = name;
    return child;
  });
}

export function stopServers(children) {
  for (const child of children) {
    child.kill();
  }
}

export async function waitUntilUp(timeoutMs = 20000) {
  const probes = [`${URLS.attacker}/__log`, `${URLS.api}/products`, `${URLS.shop}/api/products`];
  const deadline = Date.now() + timeoutMs;
  for (const url of probes) {
    for (;;) {
      try {
        if ((await fetch(url)).ok) {
          break;
        }
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for ${url}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

export async function anyServerUp() {
  for (const url of [URLS.shop, URLS.api, URLS.attacker]) {
    try {
      await fetch(url);
      return true;
    } catch {
      // closed, good
    }
  }
  return false;
}
