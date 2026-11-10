// Auto-save gate (_autoOk): only a clean, unambiguous scan may be saved without the teacher's review tap.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'exam-manager.js'), 'utf8');
function grab(name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'function not found: ' + name);
  let i = src.indexOf('{', start), d = 0, inStr = null, esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const ctx = { Array }; vm.createContext(ctx); vm.runInContext(grab('_autoWhy')+grab('_autoOk'), ctx);
const ok = vm.runInContext('_autoOk', ctx);
const good = () => ({ d: { map: { regFieldPoints: new Array(45).fill(0) }, roll: '12', rollDigitsDetected: [1, 2], rollFlags: [null, null], setFlag: null, whiteMedian: 200 }, u: { perQuestion: new Array(50).fill(0), flagged: 0, blank: 2 }, a: { results: [{ roll: '07' }] } });
let pass = 0; const T = (n, f) => { try { f(); pass++; console.log('  PASS ' + n); } catch (e) { console.log('  FAIL ' + n + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
T('clean scan -> auto-save allowed', () => { const g = good(); assert.strictEqual(ok(g.d, g.u, g.a), true); });
T('too few registration squares -> review', () => { const g = good(); g.d.map.regFieldPoints.length = 39; assert.strictEqual(ok(g.d, g.u, g.a), false); });
T('roll digit missing / unclear -> review', () => { const g = good(); g.d.rollDigitsDetected = [1, null]; g.d.roll = '1?'; assert.strictEqual(ok(g.d, g.u, g.a), false); });
T('faint/multi mark on roll or set -> review', () => { let g = good(); g.d.rollFlags = [null, 'faint']; assert.strictEqual(ok(g.d, g.u, g.a), false); g = good(); g.d.setFlag = 'multi'; assert.strictEqual(ok(g.d, g.u, g.a), false); });
T('any flagged answer -> review', () => { const g = good(); g.u.flagged = 1; assert.strictEqual(ok(g.d, g.u, g.a), false); });
T('too many blanks (>=35%) -> review', () => { const g = good(); g.u.blank = 18; assert.strictEqual(ok(g.d, g.u, g.a), false); });
T('dark photo -> review', () => { const g = good(); g.d.whiteMedian = 110; assert.strictEqual(ok(g.d, g.u, g.a), false); });
T('roll already saved for this exam -> review (no silent overwrite)', () => { const g = good(); g.a.results.push({ roll: '12' }); assert.strictEqual(ok(g.d, g.u, g.a), false); });
T('garbage input never throws -> false', () => { assert.strictEqual(ok(null, null, null), false); });
console.log(pass + ' passed');
