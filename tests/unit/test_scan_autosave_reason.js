// Auto-save gate: _autoWhy() must return "" for a clean sheet and a human reason otherwise,
// so a skipped auto-save is never silent. Runs the real _autoWhy() from exam-manager.js.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'exam-manager.js'), 'utf8');
function grab(name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'not found: ' + name);
  let i = src.indexOf('{', start), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) return src.slice(start, i + 1); } }
  throw new Error('unbalanced ' + name);
}
const ctx = {}; vm.createContext(ctx);
vm.runInContext(grab('_autoWhy'), ctx);
const clean = () => ({ map: { regFieldPoints: new Array(60).fill(0) }, roll: '12', rollDigitsDetected: [1, 2], rollFlags: [false, false], setFlag: false, whiteMedian: 200 });
const unit = () => ({ perQuestion: new Array(10).fill({}), flagged: 0, blank: 1 });
const why = (d, u, a = { results: [] }) => vm.runInContext('_autoWhy', ctx) && ctx._autoWhy(d, u, a);
let pass = 0; const T = (n, f) => { try { f(); pass++; console.log('  PASS ' + n); } catch (e) { console.log('  FAIL ' + n + '\n   ' + e.message); process.exitCode = 1; } };
T('clean sheet -> no block reason', () => assert.strictEqual(why(clean(), unit()), ''));
T('double mark -> explains why', () => assert.match(why(clean(), { ...unit(), flagged: 2 }), /double/));
T('duplicate roll -> explains why', () => assert.match(why(clean(), unit(), { results: [{ roll: '12' }] }), /pehle se saved/));
T('unreadable roll -> explains why', () => assert.match(why({ ...clean(), roll: '1?' }, unit()), /roll/));
console.log(pass + ' passed');
