// Single source of truth: version.json -> sw.js cache name, app-config.js (version/build), package.json.
// Usage: node scripts/stamp-version.js [--check]
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), check = process.argv.includes('--check');
const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(v.web) || !Number.isInteger(v.build)) { console.error('version.json invalid'); process.exit(1); }
const edits = [
  ['sw.js', /const CACHE_NAME="[^"]*"/, `const CACHE_NAME="snaptestpro-v${v.build}"`],
  ['app-config.js', /(\n\s*version:\s*)"[^"]*"/, `$1"${v.web}"`],
  ['app-config.js', /(\n\s*build:\s*)"[^"]*"/, `$1"${v.build}"`],
];
let bad = [];
const cache = {};
for (const [f, re, rep] of edits) {
  const p = path.join(ROOT, f); const s = cache[f] ?? fs.readFileSync(p, 'utf8');
  if (!re.test(s)) { console.error('pattern not found in ' + f + ': ' + re); process.exit(1); }
  cache[f] = s.replace(re, rep);
}
const pj = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
pj.version = v.web; cache['package.json'] = JSON.stringify(pj, null, 2) + '\n';
for (const f of Object.keys(cache)) {
  const p = path.join(ROOT, f), cur = fs.readFileSync(p, 'utf8');
  if (cur !== cache[f]) { bad.push(f); if (!check) fs.writeFileSync(p, cache[f]); }
}
if (check) { if (bad.length) { console.error('Out of sync with version.json: ' + bad.join(', ') + '\nRun: npm run stamp'); process.exit(1); } console.log('versions in sync'); }
else console.log(bad.length ? 'stamped: ' + bad.join(', ') : 'already in sync');
