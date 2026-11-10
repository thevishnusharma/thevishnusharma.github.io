// Fails if a local file listed in sw.js urlsToCache is missing from the build output (www/) or the repo root.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : (fs.existsSync(path.join(ROOT, 'www')) ? path.join(ROOT, 'www') : ROOT);
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const m = sw.match(/urlsToCache\s*=\s*\[([^\]]*)\]/);
if (!m) { console.error('urlsToCache not found in sw.js'); process.exit(1); }
const allUrls = (m[1].match(/"[^"]+"/g) || []).map(x => x.slice(1, -1));
const list = allUrls.filter(u => u.startsWith('/'));
// Query string (?v=1) aur hash (#x) file path ka hissa nahi hote — unhe hata kar hi file check karo.
const stripQuery = u => u.split(/[?#]/)[0];
const missing = list.filter(u => stripQuery(u) !== '/' && !fs.existsSync(path.join(base, stripQuery(u).slice(1))));
if (missing.length) { console.error('Precache files missing in ' + base + ':\n  ' + missing.join('\n  ')); process.exit(1); }
const extractedAssets = [
  '/modules/app.mjs', '/modules/bank-chunks.mjs', '/modules/legacy-bridge.mjs', '/modules/legacy-modules.mjs',
  ...Array.from({ length: 10 }, (_, i) => `/inline/index-inline-${String(i + 1).padStart(2, '0')}.js`),
  ...Array.from({ length: 4 }, (_, i) => `/inline/index-inline-${String(i + 1).padStart(2, '0')}.css`)
];
const requiredOffline = ['/privacy.html', '/terms.html', '/delete-account.html', ...extractedAssets, '/question-bank/manifest.json'];
const notCached = requiredOffline.filter(u => !list.map(stripQuery).includes(u));
if (notCached.length) { console.error('Required legal/account pages are not available offline:\n  ' + notCached.join('\n  ')); process.exit(1); }
const requiredRemote = ['https://www.gstatic.com/firebasejs/9.22.0/firebase-app-check-compat.js'];
const remoteMissing = requiredRemote.filter(u => !allUrls.includes(u));
if (remoteMissing.length) { console.error('Required Firebase SDK assets missing from precache:\n  ' + remoteMissing.join('\n  ')); process.exit(1); }
console.log(`precache OK: ${list.length} entries exist in ${base}`);
