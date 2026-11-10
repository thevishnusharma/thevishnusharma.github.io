// v276: Reports -> "Total Result Sheet" JPG (offline students ka marksheet WhatsApp group me bhejne ke liye).
// resultSheetModel = pure data layer (sort, tie-aware rank, names, paging); plus wiring checks (buttons, roster.nameOf).
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'exam-manager.js'), 'utf8');
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
const ctx = { Math, Number, Array, String };
vm.createContext(ctx); vm.runInContext(['atLim', 'effMax', 'rsGrade', 'rsPass', 'rsRankOf', 'rsRemark', 'rsHexOk', 'rsShade', 'rsTint', 'rsWrap', 'resultSheetModel'].map(grab).join('\n'), ctx);
const model = vm.runInContext('resultSheetModel', ctx);
let pass = 0; const T = (n, f) => { try { f(); pass++; console.log('  PASS ' + n); } catch (e) { console.log('  FAIL ' + n + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
const eq = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b)); // vm arrays are cross-realm -> compare as JSON
const exam = { questions: 100 };
const R = (roll, marks, extra) => Object.assign({ roll, marks, correct: 0, wrong: 0, blank: 0, totalQuestions: 100 }, extra || {});

T('sorted by marks desc; ties share the same rank (1,2,2,4)', () => {
  const m = model(exam, [R('1', 40), R('2', 70), R('3', 55), R('4', 55), R('5', 10)], null, 40);
  eq(m.rows.map(r => r.roll), ['2', '3', '4', '1', '5']);
  eq(m.rows.map(r => r.rank), [1, 2, 2, 4, 5]);
});
T('does not mutate the input array', () => {
  const rows = [R('1', 1), R('2', 9)]; model(exam, rows, null, 40);
  eq(rows.map(r => r.roll), ['1', '2']);
});
T('names come from nameOf(roll); hasNames only when at least one found; throwing nameOf is safe', () => {
  const m = model(exam, [R('01', 5), R('02', 4)], r => (r === '01' ? 'Ravi' : ''), 40);
  assert.strictEqual(m.rows[0].name, 'Ravi'); assert.strictEqual(m.rows[1].name, ''); assert.strictEqual(m.hasNames, true);
  assert.strictEqual(model(exam, [R('01', 5)], null, 40).hasNames, false);
  assert.strictEqual(model(exam, [R('01', 5)], () => { throw new Error('x'); }, 40).hasNames, false);
});
T('percentage uses effective max (attemptLimit) and total questions', () => {
  const m = model({ questions: 100, attemptLimit: 50 }, [R('1', 25)], null, 40);
  assert.strictEqual(m.rows[0].max, 50); assert.strictEqual(m.rows[0].pct, 50);
  const m2 = model({ questions: 100 }, [R('1', 30, { totalQuestions: 60 })], null, 40);
  assert.strictEqual(m2.rows[0].max, 60); assert.strictEqual(m2.rows[0].pct, 50);
});
T('paging: 45 rows -> 40 + 5, nothing lost or duplicated', () => {
  const rows = Array.from({ length: 45 }, (_, i) => R(String(i + 1), i));
  const m = model(exam, rows, null, 40);
  eq(m.pages.map(p => p.rows.length), [40, 5]);
  assert.strictEqual(new Set(m.pages.flatMap(p => p.rows).map(r => r.roll)).size, 45);
});
T('empty / missing / junk input does not throw', () => {
  assert.strictEqual(model(exam, [], null, 40).pages.length, 0);
  assert.strictEqual(model(exam, null, null, 40).rows.length, 0);
  const m = model(exam, [{ roll: null, marks: 'abc' }], null, 0);
  assert.strictEqual(m.rows[0].roll, '—'); assert.strictEqual(m.rows[0].marks, 0); assert.strictEqual(m.pages.length, 1);
  assert.strictEqual(model(exam, [{ roll: '1', marks: 3, setLetter: 'B' }], null, 40).hasSet, true);
});
T('absent students: sorted by roll (numeric), blanks dropped, kept on the last page when it fits', () => {
  const ab = [{ roll: '10', name: 'Sneha' }, { roll: '9', name: 'Arif' }, { roll: '', name: '' }, { roll: '05', name: 'Rahul' }, { roll: '', name: 'Only Name' }];
  const m = model(exam, [R('1', 5), R('2', 4)], null, 40, ab);
  eq(m.absent.map(a => a.roll), ['', '05', '9', '10']); // empty roll sorts first (name-only entries)
  assert.strictEqual(m.absent.length, 4);
  eq(m.pages.map(p => [p.rows.length, p.absent.length]), [[2, 4]]);
});
T('absent students: many -> extra pages of up to 120, nobody lost', () => {
  const ab = Array.from({ length: 150 }, (_, i) => ({ roll: String(100 + i), name: 'S' + i }));
  const m = model(exam, [R('1', 5)], null, 40, ab);
  eq(m.pages.map(p => [p.rows.length, p.absent.length]), [[1, 0], [0, 120], [0, 30]]);
  assert.strictEqual(m.pages.reduce((t, p) => t + p.absent.length, 0), 150);
});
T('absent students: junk input is safe; no absent -> no absent list', () => {
  assert.strictEqual(model(exam, [R('1', 5)], null, 40, null).absent.length, 0);
  assert.strictEqual(model(exam, [R('1', 5)], null, 40, [null, undefined, {}, 7]).absent.length, 0);
  eq(model(exam, [R('1', 5)], null, 40).pages.map(p => p.absent.length), [0]);
});
T('absent fallback: exam.absentees text is parsed (comma / newline / semicolon)', () => {
  const fn = vm.runInContext('(' + grab('resultSheetAbsent') + ')', Object.assign(ctx, { window: {}, A: 'x' }));
  eq(fn({ absentees: 'Ravi (01), Amit;\nSunil ,, ' }, []).map(a => a.name), ['Ravi (01)', 'Amit', 'Sunil']);
  eq(fn({}, []), []);
});
T('grade thresholds match the app (A+ 90, A 80, B+ 70, B 60, C 50, D) and pass mark is 33%', () => {
  const g = vm.runInContext('rsGrade', ctx), p = vm.runInContext('rsPass', ctx);
  [[100, 'A+'], [90, 'A+'], [89.9, 'A'], [80, 'A'], [79.9, 'B+'], [70, 'B+'], [69.9, 'B'], [60, 'B'], [59.9, 'C'], [50, 'C'], [49.9, 'D'], [0, 'D'], [-5, 'D'], ['x', 'D']].forEach(([v, w]) => assert.strictEqual(g(v), w, v + ' -> ' + w));
  assert.strictEqual(p(33), true); assert.strictEqual(p(32.9), false); assert.strictEqual(p(undefined), false);
  assert.strictEqual(model(exam, [R('1', 85)], null, 40).rows[0].grade, 'A');
});
T('rsRankOf: rank = 1 + students with strictly higher marks (ties share)', () => {
  const f = vm.runInContext('rsRankOf', ctx), rows = [R('1', 70), R('2', 55), R('3', 55), R('4', 10)];
  assert.strictEqual(f(rows, rows[0]), 1); assert.strictEqual(f(rows, rows[1]), 2); assert.strictEqual(f(rows, rows[2]), 2); assert.strictEqual(f(rows, rows[3]), 4);
  assert.strictEqual(f(null, R('9', 5)), 1);
});
T('rsRemark returns a non-empty line for every band; colour helpers return valid hex', () => {
  const f = vm.runInContext('rsRemark', ctx); [95, 85, 75, 65, 40, 10, 0, NaN].forEach(v => assert.ok(f(v).length > 10));
  const sh = vm.runInContext('rsShade', ctx), ti = vm.runInContext('rsTint', ctx), ok = vm.runInContext('rsHexOk', ctx);
  ['#0f766e', '#4f46e5', '#ffffff', '#000000'].forEach(c => { assert.ok(ok(sh(c, .55)) && ok(ti(c, .9))); });
  assert.strictEqual(sh('#ffffff', 0.5), '#808080'); assert.strictEqual(ti('#000000', 1), '#ffffff'); assert.strictEqual(ok('red'), false); assert.strictEqual(ok('#12345'), false);
});
T('rsWrap wraps on word boundaries and never loses words', () => {
  const g = { measureText: t => ({ width: String(t).length * 10 }) }, f = vm.runInContext('rsWrap', ctx);
  const lines = Array.from(f(g, 'aa bb cc dd ee ff', 50)); assert.ok(lines.length >= 3 && lines.every(l => l.length <= 5), JSON.stringify(lines));
  assert.strictEqual(lines.join(' '), 'aa bb cc dd ee ff'); assert.strictEqual(Array.from(f(g, 'singleword', 5)).join(''), 'singleword');
});
T('wiring: both buttons exist in index.html and are bound in exam-manager.js', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ['examgr-rs-img-btn', 'examgr-rs-share-btn'].forEach(id => { assert.ok(html.includes('id="' + id + '"'), id + ' missing in index.html'); assert.ok(src.includes('c("' + id + '")'), id + ' not bound'); });
  assert.ok(src.includes('window.examgrResultSheetImage'));
  assert.ok(html.includes('id="examgr-rd-card-btn"') && src.includes('c("examgr-rd-card-btn")') && src.includes('window.examgrReportCardImage'), 'report card button not wired');
});
T('roster exposes nameOf(id, roll) and absentees(id, rows)', () => {
  const rs = fs.readFileSync(path.join(root, 'exam-roster.js'), 'utf8');
  assert.ok(/nameOf:\s*function\s*\(id,\s*roll\)/.test(rs));
  assert.ok(/absentees:\s*function\s*\(id,\s*rows\)/.test(rs));
  assert.ok(/summary\(R, rows \|\| \[\]\)\.absent/.test(rs), 'absentees must reuse roster summary()');
});
console.log(pass + ' passed');
