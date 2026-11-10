// Runs every tests/unit/test_*.js with plain Node; exits non-zero if any fails.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const dir = path.join(__dirname, '..', 'tests', 'unit');
const files = fs.readdirSync(dir).filter(f => /^test_.*\.js$/.test(f)).sort();
let failed = [];
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', timeout: 120000 });
  const ok = r.status === 0;
  console.log((ok ? 'PASS ' : 'FAIL ') + f);
  if (!ok) { failed.push(f); console.log((r.stdout || '') + (r.stderr || '')); }
}
console.log(`\n${files.length - failed.length}/${files.length} passed`);
process.exit(failed.length ? 1 : 0);
