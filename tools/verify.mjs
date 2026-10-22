// Runs the five labs twice, unsafe and safe, and prints what leaked.
// Needs the production builds (npm run build) and Chrome or Edge.
// Set CHROME_PATH if the browser lives outside its default location.
import { createWriteStream, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { captures, clearCaptures, rawGet, signIn } from './client.mjs';
import {
  anyServerUp,
  requireBuilds,
  startServers,
  stopServers,
  URLS,
  waitUntilUp,
} from './servers.mjs';

requireBuilds();
if (await anyServerUp()) {
  console.error('Something is already listening on 4000, 3000 or 9999. Stop the stack first.');
  process.exit(1);
}

mkdirSync(new URL('../tmp', import.meta.url), { recursive: true });
const browser = await launchBrowser();
const results = {};

for (const safe of [false, true]) {
  const mode = safe ? 'safe' : 'unsafe';
  const logFile = createWriteStream(new URL(`../tmp/verify-${mode}.log`, import.meta.url));
  await new Promise((resolve) => logFile.on('open', resolve));
  const children = startServers({ safe, stdio: ['ignore', logFile, logFile] });

  try {
    await waitUntilUp();
    results[mode] = {
      lab1: await lab1(),
      lab2: await lab2(),
      lab3: await lab3(),
      lab4: await lab4(),
      lab5: await lab5(),
    };
  } finally {
    stopServers(children);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

await browser.close();
printTable(results);

const expected =
  Object.values(results.unsafe).every((r) => r.leaked) &&
  Object.values(results.safe).every((r) => !r.leaked);
console.log(
  expected ? '\nAll labs behave as expected.\n' : '\nSomething did not behave as expected.\n',
);
process.exit(expected ? 0 : 1);

// --- Labs -----------------------------------------------------------------

/** Lab 1: the auth interceptor attaches a token to a URL that "looks relative". */
async function lab1() {
  await clearCaptures();
  const context = await newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(`${URLS.shop}/login`);
  await page.getByTestId('sign-in-ana').click();
  await page.getByTestId('signed-in').waitFor();
  await page.goto(`${URLS.shop}/promos`);
  // The session comes back from sessionStorage after hydration.
  await page.getByTestId('nav-login').filter({ hasText: 'Ana' }).waitFor();
  await page.getByTestId('save-alfajores').click();
  await page.getByTestId('status').waitFor();
  await context.close();

  const hit = (await captures()).find((c) => c.url.startsWith('/collect') && c.method === 'POST');
  const token = hit?.headers.authorization;
  const xsrf = hit?.headers['x-xsrf-token']
    ? 'X-XSRF-TOKEN leaked too'
    : 'no X-XSRF-TOKEN, Angular decides with new URL()';
  return {
    leaked: Boolean(token),
    detail: token
      ? `Authorization: ${token.slice(0, 18)}… (${xsrf})`
      : `request sent, no Authorization attached (${xsrf})`,
  };
}

/** Lab 2: the Host header decides where relative SSR requests go. */
async function lab2() {
  await clearCaptures();
  const { status } = await rawGet('/deals', { host: '127.0.0.1:9999' });
  const hit = (await captures()).find((c) => c.url === '/api/deals/today');
  return {
    leaked: Boolean(hit?.headers['x-internal-key']),
    detail: hit
      ? `X-Internal-Key reached the attacker (HTTP ${status})`
      : `HTTP ${status} from allowedHosts, nothing left the server`,
  };
}

/** Lab 3: fetch follows the redirect and keeps the custom headers. */
async function lab3() {
  const sid = await signIn('ana');
  await clearCaptures();
  const { body } = await rawGet('/deals?lab=3', { cookie: `sid=${sid}` });
  const hit = (await captures()).find((c) => c.url === '/deals/today.json');
  const stolen = [
    hit?.headers['x-internal-key'] && 'X-Internal-Key',
    hit?.headers['x-session'] && "Ana's X-Session",
  ].filter(Boolean);
  return {
    leaked: stolen.length > 0,
    detail: hit
      ? `${stolen.join(' and ') || 'nothing secret'} followed the 302 to the campaign site`
      : body.includes('Deals unavailable')
        ? 'redirect refused (redirect: "error")'
        : 'no capture',
  };
}

/** Lab 4: Ana's render lands in a shared cache and in ng-state. */
async function lab4() {
  const sid = await signIn('ana');
  const first = await rawGet('/?lab=4', { cookie: `sid=${sid}` });
  const second = await rawGet('/?lab=4', {});
  const leaked = second.body.includes('Ana Quispe');
  return {
    leaked,
    detail: leaked
      ? `anonymous visitor got Ana's HTML (x-cache: ${second.headers['x-cache']})`
      : `Ana's render was ${first.headers['cache-control']}, visitor got a fresh page`,
  };
}

/** Lab 5: the Service Worker data cache does not know who is signed in. */
async function lab5() {
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(`${URLS.shop}/login`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await page.getByTestId('sign-in-ana').click();
  await page.getByTestId('signed-in').waitFor();
  await page.getByTestId('nav-orders').click();
  await page.getByTestId('owner').waitFor();

  await page.getByTestId('nav-login').click();
  await page.getByTestId('sign-out').click();
  await page.getByTestId('signed-in').waitFor({ state: 'detached' });
  await page.getByTestId('sign-in-beto').click();
  await page.getByTestId('signed-in').filter({ hasText: 'Beto' }).waitFor();
  await page.getByTestId('nav-orders').click();
  const owner = (await page.getByTestId('owner').textContent())?.trim() ?? '';
  await context.close();

  const leaked = owner.includes('Ana');
  return {
    leaked,
    detail: leaked ? `Beto signed in, the page says "${owner}"` : `Beto sees "${owner}"`,
  };
}

// --- Helpers --------------------------------------------------------------

/**
 * Some antivirus products (Kaspersky, for one) inject a script into every page,
 * add their own header to fetch() and answer CORS preflights themselves.
 * That breaks Lab 1, so the verifier blocks the injected script.
 */
async function newContext(options = {}) {
  const context = await browser.newContext(options);
  await context.route(/kaspersky-labs\.com/i, (route) => route.abort());
  return context;
}

async function launchBrowser() {
  const attempts = process.env.CHROME_PATH
    ? [{ executablePath: process.env.CHROME_PATH }]
    : [{ channel: 'chrome' }, { channel: 'msedge' }];
  for (const options of attempts) {
    try {
      return await chromium.launch({ headless: true, ...options });
    } catch {
      // try the next one
    }
  }
  console.error('Could not start Chrome or Edge. Set CHROME_PATH to a Chromium-based browser.');
  process.exit(1);
}

function printTable(all) {
  const labs = [
    ['lab1', '1  Token on a URL that "looks relative"'],
    ['lab2', '2  Host header steers SSR requests'],
    ['lab3', '3  Custom header follows a redirect'],
    ['lab4', '4  Private data in shared HTML'],
    ['lab5', '5  Service Worker cache across users'],
  ];
  const mark = (r) => (r.leaked ? '\x1b[31mLEAKED \x1b[0m' : '\x1b[32mblocked\x1b[0m');
  console.log('\n Lab                                       unsafe    safe');
  console.log(' ' + '-'.repeat(62));
  for (const [key, label] of labs) {
    console.log(` ${label.padEnd(42)}${mark(all.unsafe[key])}   ${mark(all.safe[key])}`);
  }
  console.log('');
  for (const [key, label] of labs) {
    console.log(` ${label}`);
    console.log(`    unsafe: ${all.unsafe[key].detail}`);
    console.log(`    safe:   ${all.safe[key].detail}`);
  }
}
