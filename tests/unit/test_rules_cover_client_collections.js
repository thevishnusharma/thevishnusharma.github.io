/* v283 — Regression guard ("naya feature purana na tode / bina rules ka naya collection na chhute").
   Client code me jitne bhi Firestore collection naam literal ho (`.collection("x")`), har ek ka firestore.rules me
   `match /x/` hona ZAROORI hai. Warna naya feature live par "permission-denied" dega (default-deny), aur ye galti
   ab deploy se PEHLE CI me pakdi jaati hai. Ye test firestore.rules ke 4 buniyadi niyam bhi pakadta hai:
   default-deny, koi `allow ... if true`, studentSecrets ka public read na ho, aur lockdown switches maujood hon. */
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..', '..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const rulesNoComments = rules.replace(/\/\/.*$/gm, '');

const SKIP_DIRS = new Set(['node_modules', 'updates', 'tests', 'frontend_repo', 'push-worker', '.git', 'www', 'android', 'scripts', 'notes', 'question-bank']);
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (/\.(js|mjs|html)$/.test(e.name) && !/^test_/.test(e.name) && !/question-bank/.test(e.name)) out.push(path.join(dir, e.name));
  }
  return out;
}
const used = new Map();
for (const f of walk(root, [])) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /\.collection\(\s*["'`]([A-Za-z][A-Za-z0-9_]*)["'`]\s*\)/g; let m;
  while ((m = re.exec(src))) { if (!used.has(m[1])) used.set(m[1], new Set()); used.get(m[1]).add(path.relative(root, f)); }
}
/* Jaan-boojh kar rules me nahi (sirf server/Worker ya Owner-script use karta hai) — naya naam yahan tabhi daalein jab sach me client use na kare */
const ALLOW_NO_RULE = new Set([]);
const matched = new Set(); let mm; const mre = /match\s+\/([A-Za-z][A-Za-z0-9_]*)\s*(?:\/\{|\{|\/)/g;
while ((mm = mre.exec(rulesNoComments))) matched.add(mm[1]);

let failed = 0; const t = (n, fn) => { try { fn(); console.log('  ok  ' + n); } catch (e) { failed++; console.log('  FAIL ' + n + '\n       ' + e.message.split('\n')[0]); } };

t('client me use hone wala har collection firestore.rules me declared hai', () => {
  const missing = [...used.keys()].filter(n => !matched.has(n) && !ALLOW_NO_RULE.has(n));
  assert.strictEqual(missing.length, 0, 'rules me match NAHI mila (default-deny => feature fail hoga): ' + missing.map(n => n + ' [' + [...used.get(n)].slice(0, 2).join(', ') + ']').join('; '));
});
t('default-deny catch-all rule maujood hai', () => assert.ok(/match\s+\/\{document=\*\*\}\s*\{\s*allow read, write:\s*if false;/.test(rulesNoComments)));
t('koi bhi rule "if true" se khula nahi hai', () => assert.ok(!/allow[^;]*:\s*if\s+true\s*;/.test(rulesNoComments)));
t('studentSecrets ka read sirf admin (+lockdown guard) ko hai, public nahi', () => {
  const blk = rulesNoComments.split('match /studentSecrets/{mobile}')[1].split('match /')[0];
  const rd = blk.match(/allow read:[^;]*;/)[0];
  assert.ok(/isAdmin\(\)/.test(rd) && !/isSignedIn\(\)\s*;/.test(rd));
});
t('privacy lockdown switches (records/secrets/studentData) rules me maujood hain', () => {
  for (const k of ['recordsLockdown', 'secretsLockdown', 'studentDataLockdown']) assert.ok(rulesNoComments.includes(k), k + ' gayab');
});
t('studentMistakes / studentScanReports / studentAdmitCards ka read lockdown helper se guarded hai', () => {
  for (const c of ['studentMistakes/{mobile}', 'studentScanReports/{docId}', 'studentAdmitCards/{docId}']) {
    const blk = rulesNoComments.split('match /' + c)[1].split('match /')[0];
    assert.ok(/canAccessStudentMobile\(/.test(blk), c + ' me canAccessStudentMobile nahi hai');
  }
});
console.log(`\ncollections checked: ${used.size}, rules matches: ${matched.size}`);
process.exit(failed ? 1 : 0);
