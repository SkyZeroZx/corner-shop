// Starts the three servers from the production builds.
//   node tools/stack.mjs          the app as the team shipped it
//   node tools/stack.mjs --safe   same app, boundary decisions fixed
import { requireBuilds, startServers, stopServers, URLS } from './servers.mjs';

const safe = process.argv.includes('--safe');
requireBuilds();

console.log(`\nCorner Shop, ${safe ? '\x1b[32mSAFE' : '\x1b[31mUNSAFE'} mode\x1b[0m`);
console.log(`  shop      ${URLS.shop}`);
console.log(`  api       ${URLS.api}`);
console.log(`  attacker  ${URLS.attacker}/__log\n`);

const children = startServers({ safe });

const stop = () => {
  stopServers(children);
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

for (const child of children) {
  child.on('exit', (code) => {
    if (code) {
      console.error(`${child.serverName} exited with code ${code}. Stopping.`);
      stop();
    }
  });
}
