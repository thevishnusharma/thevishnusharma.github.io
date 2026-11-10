// v259 — zip upload ke baad version.json ka build apne-aap +1 (agar zip me tumne already bada build nahi diya).
// Usage: node scripts/auto-bump.js /tmp/prev-version.json [--force]
//   --force  -> minBuild = naya build (admin/owner par "Update zaroori hai" parda; students par kabhi nahi)
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'version.json');
const prev = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let cur; try { cur = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { cur = Object.assign({}, prev); }
const out = Object.assign({}, cur);
if (!(Number.isInteger(cur.build) && cur.build > prev.build)) {
  out.build = (Number.isInteger(prev.build) ? prev.build : 0) + 1;
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(prev.web || '') || [0, 1, 0, 0];
  out.web = `${m[1]}.${m[2]}.${(+m[3]) + 1}`;
  out.minBuild = prev.minBuild || 0;
}
if (process.argv.includes('--force')) out.minBuild = out.build;
fs.writeFileSync(file, JSON.stringify(out) + '\n');
console.log('version.json ->', JSON.stringify(out));
