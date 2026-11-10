// v230 — Admit Card + Roster + scan verification. Plain Node, koi dependency nahi.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const R = p => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');
let n = 0; const T = (name, fn) => { try { fn(); n++; console.log('  PASS ' + name); } catch (e) { console.log('  FAIL ' + name + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
const { pure } = require('../../exam-roster.js');
const A = require('../../admit-card.js');
const st = (name, mobile, extra) => Object.assign({ name, mobile, classId: 'class_10' }, extra || {});
const M = i => '98000000' + String(i).padStart(2, '0');

/* ---------- roll + set assignment ---------- */
T('rolls naam ke alphabetical order me 1.. se, digits par pad hote hain', () => {
  const r = pure.mergeRoster([], [st('Zoya', M(1)), st('Amit', M(2)), st('Manoj', M(3))], { rollDigits: 2, sets: 1 });
  assert.deepStrictEqual(r.list.map(e => e.roll + ':' + e.name), ['01:Amit', '02:Manoj', '03:Zoya']);
  assert.strictEqual(r.nextRoll, 4); assert.strictEqual(r.added, 3); assert.strictEqual(r.error, null);
});
T('multi-set: set roll se deterministic (adjacent students alag set)', () => {
  const r = pure.mergeRoster([], [1, 2, 3, 4, 5].map(i => st('S' + i, M(i))), { rollDigits: 2, sets: 3 });
  assert.deepStrictEqual(r.list.map(e => e.set), ['A', 'B', 'C', 'A', 'B']);
  assert.strictEqual(pure.setForRoll('04', 3), 'A'); assert.strictEqual(pure.setForRoll('02', 1), null); assert.strictEqual(pure.setForRoll('02', 9), 'B');
});
T('scanIgnoreSet par set assign nahi hota', () => {
  const r = pure.mergeRoster([], [st('A', M(1))], { rollDigits: 2, sets: 4, ignoreSet: true });
  assert.strictEqual(r.list[0].set, null);
});
T('purane entries renumber nahi hote; naye ko max+1 se roll milta hai; duplicate mobile skip', () => {
  const a = pure.mergeRoster([], [st('Amit', M(1)), st('Zoya', M(2))], { rollDigits: 2 });
  const b = pure.mergeRoster(a.list, [st('Bela', M(3)), st('Amit', M(1)), st('X', '12')], { rollDigits: 2, nextRoll: a.nextRoll });
  assert.deepStrictEqual(b.list.map(e => e.roll + ':' + e.name), ['01:Amit', '02:Zoya', '03:Bela']);
  assert.strictEqual(b.added, 1); assert.strictEqual(b.skipped, 2);
});
T('hataye gaye roll dobara use nahi hote (nextRoll counter)', () => {
  const a = pure.mergeRoster([], [st('A', M(1)), st('B', M(2)), st('C', M(3))], { rollDigits: 2 });
  const afterRemove = a.list.filter(e => e.roll !== '03');
  const b = pure.mergeRoster(afterRemove, [st('D', M(4))], { rollDigits: 2, nextRoll: a.nextRoll });
  assert.strictEqual(b.list[b.list.length - 1].roll, '04');
});
T('profile roll number use hota hai jab numeric+unique+fit ho, warna auto', () => {
  const r = pure.mergeRoster([], [st('A', M(1), { rollNumber: '7' }), st('B', M(2), { rollNumber: '7' }), st('C', M(3), { rollNumber: 'XY-9' }), st('D', M(4), { rollNumber: '250' })], { rollDigits: 2, useProfile: true });
  const by = Object.fromEntries(r.list.map(e => [e.name, e.roll]));
  assert.strictEqual(by.A, '07'); assert.notStrictEqual(by.B, '07'); assert.ok(/^\d\d$/.test(by.B) && /^\d\d$/.test(by.C) && /^\d\d$/.test(by.D));
  assert.strictEqual(new Set(r.list.map(e => e.roll)).size, 4);
});
T('digits kam padein to DIGITS_FULL error (kuch add nahi hota)', () => {
  const many = Array.from({ length: 12 }, (_, i) => st('S' + i, M(i)));
  const r = pure.mergeRoster([], many, { rollDigits: 1 });
  assert.strictEqual(r.error.code, 'DIGITS_FULL'); assert.strictEqual(r.list.length, 0); assert.strictEqual(r.error.need, 2);
});
T('galat mobile (10 digit nahi) skip; 3000 se zyada par TOO_MANY', () => {
  assert.strictEqual(pure.mergeRoster([], [st('A', '123')], { rollDigits: 2 }).added, 0);
  const big = Array.from({ length: pure.MAX_ROSTER + 1 }, (_, i) => st('S' + i, String(9000000000 + i)));
  assert.strictEqual(pure.mergeRoster([], big, { rollDigits: 5 }).error.code, 'TOO_MANY');
});
T('repad: digits badalne par numbers wahi, width naya', () => {
  const a = pure.mergeRoster([], [st('A', M(1)), st('B', M(2))], { rollDigits: 2 });
  assert.deepStrictEqual(pure.repad(a.list, 3, 2).list.map(e => e.roll), ['001', '002']);
  assert.strictEqual(pure.repad([{ roll: '12', name: 'x', mobile: M(1) }], 1, 1).error.code, 'DIGITS_FULL');
});

/* ---------- scan verification ---------- */
const roster = pure.mergeRoster([], [st('Rahul Kumar', M(1)), st('Priya Singh', M(2)), st('Sonu Das', M(3))], { rollDigits: 2, sets: 2 });
roster.by = pure.indexList(roster.list);
const exam = { sets: 2, rollDigits: 2 };
const V = (scan, res, ocr, ex) => pure.verify(roster, ex || exam, scan, res || [], ocr);
T('registered roll + sahi set => ok, student entry milti hai', () => {
  assert.deepStrictEqual(roster.list.map(e => e.roll + ':' + e.name + ':' + e.set), ['01:Priya Singh:A', '02:Rahul Kumar:B', '03:Sonu Das:A']);
  const v = V({ roll: '02', setLetter: 'B' }); assert.strictEqual(v.level, 'ok'); assert.strictEqual(v.entry.name, 'Rahul Kumar'); assert.deepStrictEqual(v.issues, []);
});
T('roll registered nahi => error NOT_REGISTERED', () => { const v = V({ roll: '47', setLetter: 'A' }); assert.strictEqual(v.level, 'error'); assert.strictEqual(v.issues[0].code, 'NOT_REGISTERED'); });
T('roll me ? ya khaali => error ROLL_UNREADABLE', () => { assert.strictEqual(V({ roll: '1?' }).issues[0].code, 'ROLL_UNREADABLE'); assert.strictEqual(V({ roll: '' }).issues[0].code, 'ROLL_UNREADABLE'); });
T('set admit card se alag => warn SET_MISMATCH; set bubble nahi => SET_MISSING', () => {
  const en = roster.by['01']; // set A
  assert.strictEqual(en.set, 'A');
  const a = V({ roll: '01', setLetter: 'B' }); assert.strictEqual(a.level, 'warn'); assert.strictEqual(a.issues[0].code, 'SET_MISMATCH');
  assert.strictEqual(V({ roll: '01', setLetter: null }).issues[0].code, 'SET_MISSING');
  assert.strictEqual(V({ roll: '01', setLetter: 'A' }).level, 'ok');
});
T('single-set / scanIgnoreSet exam me set check nahi hota', () => {
  assert.strictEqual(V({ roll: '01', setLetter: 'C' }, [], '', { sets: 1, rollDigits: 2 }).level, 'ok');
  assert.strictEqual(V({ roll: '01', setLetter: 'C' }, [], '', { sets: 3, scanIgnoreSet: true, rollDigits: 2 }).level, 'ok');
});
T('duplicate roll => warn DUPLICATE (apni hi id ignore)', () => {
  const res = [{ id: 'x1', roll: '01' }];
  assert.strictEqual(V({ roll: '01', setLetter: 'A', id: 'x2' }, res).issues[0].code, 'DUPLICATE');
  assert.strictEqual(V({ roll: '01', setLetter: 'A', id: 'x1' }, res).level, 'ok');
});
T('OCR naam mismatch => warn; milta-julta / partial / devanagari naam par alarm nahi', () => {
  assert.strictEqual(V({ roll: '01', setLetter: 'A' }, [], 'Zzxq Wvvt').issues[0].code, 'NAME_MISMATCH');
  assert.strictEqual(V({ roll: '01', setLetter: 'A' }, [], 'Priya Sing').level, 'ok');
  assert.strictEqual(V({ roll: '01', setLetter: 'A' }, [], 'priya').level, 'ok');
  assert.strictEqual(V({ roll: '01', setLetter: 'A' }, [], 'ab').level, 'ok');
  assert.ok(pure.nameLooksSame('Rahul Kumar', 'राहुल कुमार'));
});
T('roster khaali / roll ignore ho to level none (purana behaviour)', () => {
  assert.strictEqual(pure.verify(null, exam, { roll: '01' }, []).level, 'none');
  assert.strictEqual(pure.verify({ list: [] }, exam, { roll: '01' }, []).level, 'none');
  assert.strictEqual(V({ roll: '01' }, [], '', { scanIgnoreRollNumber: true }).level, 'none');
  assert.strictEqual(V({ roll: '01' }, [], '', { includeRollNumber: false }).level, 'none');
});
T('summary: scanned/absent/anomalies sahi, best marks wali sheet', () => {
  const res = [{ id: 'a', roll: '01', marks: 10 }, { id: 'b', roll: '01', marks: 30 }, { id: 'c', roll: '02', marks: 5 }, { id: 'd', roll: '99', marks: 8 }, { id: 'e', roll: '03', marks: 2, anomaly: 'SET_MISMATCH' }];
  const s = pure.summary(roster, res);
  assert.strictEqual(s.registered, 3); assert.strictEqual(s.scanned, 3); assert.strictEqual(s.absent.length, 0);
  assert.strictEqual(s.best['01'].marks, 30);
  assert.deepStrictEqual(s.anomalies.map(a => a.roll + ':' + a.code).sort(), ['03:SET_MISMATCH', '99:NOT_REGISTERED']);
  assert.strictEqual(pure.summary(roster, []).absent.length, 3);
});
T('csvCell quotes escape karta hai', () => { assert.strictEqual(pure.csvCell('a"b,c'), '"a""b,c"'); assert.strictEqual(pure.csvCell(null), '""'); });

/* ---------- admit card helpers ---------- */
T('admit helpers: mobile mask, admit id, date', () => {
  assert.strictEqual(A.maskMobile('9876543210'), 'XXXXXX3210'); assert.strictEqual(A.maskMobile('12'), '');
  assert.strictEqual(A.admitId('abcdef123', '07'), 'ABCDE-07'); assert.strictEqual(A.prettyDate('2026-10-19'), '19 Oct 2026');
  assert.strictEqual(A.upcoming([{ date: '2000-01-01' }, { date: '2999-01-01' }, {}]).length, 2);
});

/* ---------- browser module behaviour (fake DOM/Firestore) ---------- */
function makeEnv(rosterDoc) {
  const patches = [], alerts = []; let confirmAns = true;
  const ctx = { console, Promise, setTimeout, Math, Date, JSON, Object, Array, String, Number, parseInt, isFinite, Set, URL, Blob, encodeURIComponent, alert: m => alerts.push(m), confirm: () => confirmAns };
  ctx.window = ctx; ctx.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); } };
  ctx.document = { createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }), getElementById: () => null, body: { appendChild() {} } };
  ctx.getDB = () => ({ collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: !!rosterDoc, data: () => rosterDoc }) }) }) }) }) });
  const exm = { sets: 2, rollDigits: 2, rosterCount: rosterDoc ? rosterDoc.list.length : 0, results: [], examName: 'T' };
  ctx.__examgrCtx = { id: () => 'EX1', exam: () => exm, all: () => ({ EX1: exm }), patch: async (i, o) => { patches.push(o); Object.assign(exm, o); return true; }, refresh() {}, ensureResults: async () => [] };
  ctx.SnapAdmit = A; vm.createContext(ctx);
  vm.runInContext(R('exam-roster.js'), ctx);
  return { ctx, exm, alerts, patches, setConfirm: v => { confirmAns = v; } };
}
const doc = { list: roster.list, nextRoll: 4 };
T('module: guardSave roster load hone se pehle save rokta hai', () => {
  const e = makeEnv(doc), g = e.ctx.SnapRoster.guardSave('EX1', e.exm, { roll: '47', setLetter: 'A' }, {}, '');
  assert.strictEqual(g.block, true); assert.ok(/load ho raha/.test(e.alerts[0]));
});
(async () => {
  const e = makeEnv(doc), S = e.ctx.SnapRoster; await S.load('EX1');
  const t = (name, fn) => { try { fn(); n++; console.log('  PASS ' + name); } catch (x) { console.log('  FAIL ' + name + '\n   ' + (x.stack || x)); process.exitCode = 1; } };
  t('module: guardSave flow', () => {
    e.setConfirm(false); assert.strictEqual(S.guardSave('EX1', e.exm, { roll: '47', setLetter: 'A' }, {}, '').block, true);
    e.setConfirm(true); assert.strictEqual(S.guardSave('EX1', e.exm, { roll: '47', setLetter: 'A' }, {}, '').block, false);
    assert.strictEqual(S.guardSave('EX1', e.exm, { roll: '1?', setLetter: 'A' }, {}, '').block, true);
    assert.strictEqual(S.guardSave('EX1', e.exm, { roll: '01', setLetter: 'A' }, {}, '').block, false);
  });
  t('module: autoWhy sirf saaf sheet par khaali string deta hai', () => {
    assert.strictEqual(S.autoWhy(e.exm, { roll: '01', setLetter: 'A' }, ''), '');
    assert.ok(/roster check/.test(S.autoWhy(e.exm, { roll: '47', setLetter: 'A' }, '')));
    assert.ok(/roster check/.test(S.autoWhy(e.exm, { roll: '01', setLetter: 'B' }, '')));
  });
  t('module: linkTarget sirf ok par mobile deta hai; fieldsFor anomaly code', () => {
    assert.strictEqual(S.linkTarget('EX1', { id: 'r1', roll: '01', setLetter: 'A' }), roster.by['01'].mobile);
    assert.strictEqual(S.linkTarget('EX1', { id: 'r1', roll: '01', setLetter: 'B' }), null);
    assert.strictEqual(S.linkTarget('EX1', { id: 'r1', roll: '77', setLetter: 'A' }), null);
    e.exm.rosterAutoLink = false; assert.strictEqual(S.linkTarget('EX1', { id: 'r1', roll: '01', setLetter: 'A' }), null); delete e.exm.rosterAutoLink;
    const f = S.fieldsFor('EX1', '77', 'A', ''); assert.strictEqual(f.anomaly, 'NOT_REGISTERED');
    const g = S.fieldsFor('EX1', '01', 'A', ''); assert.strictEqual(g.anomaly, null); assert.strictEqual(g.verifiedMobile, roster.by['01'].mobile);
  });
  t('module: tag naam escape karke deta hai; roster na ho to khaali', () => {
    assert.strictEqual(S.tag('EX1', '01'), ' · Priya Singh'); assert.strictEqual(S.tag('EX1', '55'), ''); assert.strictEqual(S.tag('NOPE', '01'), '');
  });
  const e2 = makeEnv({ list: [{ roll: '01', name: '<b>x</b>', mobile: M(9), set: 'A' }], nextRoll: 2 });
  await e2.ctx.SnapRoster.load('EX1');
  t('module: tag HTML escape karta hai (XSS)', () => assert.ok(!/<b>/.test(e2.ctx.SnapRoster.tag('EX1', '01')) && /&lt;b&gt;/.test(e2.ctx.SnapRoster.tag('EX1', '01'))));
  t('module: kill-switch (SNAP_CONFIG.roster=false) par hooks kuch nahi karte', () => {
    e.ctx.SNAP_CONFIG = { roster: false };
    assert.strictEqual(S.guardSave('EX1', e.exm, { roll: '47' }, {}, '').block, false); assert.strictEqual(S.autoWhy(e.exm, { roll: '47' }, ''), '');
    assert.strictEqual(S.linkTarget('EX1', { roll: '01', setLetter: 'A' }), null); assert.deepStrictEqual(Object.keys(S.fieldsFor('EX1', '47', 'A', '')), []);
    e.ctx.SNAP_CONFIG = { roster: true };
  });
  t('module: roster na ho to purana behaviour (koi block nahi)', () => {
    const e3 = makeEnv(null); e3.exm.rosterCount = 0;
    assert.strictEqual(e3.ctx.SnapRoster.guardSave('EX1', e3.exm, { roll: '47' }, {}, '').block, false);
    assert.strictEqual(e3.ctx.SnapRoster.autoWhy(e3.exm, { roll: '47' }, ''), '');
  });
  console.log('\n' + n + ' roster tests passed');
})();

/* ---------- wiring ---------- */
T('exam-manager.js me saare hooks maujood aur syntax theek', () => {
  const s = R('exam-manager.js');
  ['window.__examgrCtx', 'SnapRoster.onScan(e,a,t,De)', 'SnapRoster.onOcr(d)', 'SnapRoster.clear()', 'SnapRoster.autoWhy(a,d,De)', 'SnapRoster.guardSave(e,a,G,F,De)', 'SnapRoster.fieldsFor(e,G.roll,F.setLetter,De)', 'SnapRoster.linkTarget(e,i)', '_roAutoLink', 'SnapRoster.tag(A,n.roll)', 'e===\"roster\"', 'SnapRoster.preload(a)', 'SnapRoster.load(a)']
    .forEach(h => assert.ok(s.includes(h), h));
  new vm.Script(s); // parse
});
T('index.html: button + admit-card.js; loader me exam-roster.js; sw precache; rules; flags; css', () => {
  assert.ok(R('index.html').includes('data-action="roster"')); assert.ok(R('index.html').includes('admit-card.js'));
  assert.ok(/examManager:\s*\["exam-manager\.js\?v=\d+",\s*"exam-roster\.js/.test(R('inline/index-inline-06.js')));
  const sw = R('sw.js'); assert.ok(sw.includes('"/exam-roster.js"') && sw.includes('"/admit-card.js"'));
  const fr = R('firestore.rules'); assert.ok(/match \/roster\/\{rid\}/.test(fr) && /match \/studentAdmitCards\/\{docId\}/.test(fr));
  const cfg = R('app-config.js'); assert.ok(/roster:\s*true/.test(cfg) && /admitCard:\s*true/.test(cfg));
  assert.ok(R('exam-manager.css').includes('.ros-banner'));
  ['exam-roster.js', 'admit-card.js'].forEach(f => assert.ok(fs.existsSync(path.join(__dirname, '..', '..', f)), f));
});
T('roster/admit module me innerHTML me dynamic data nahi jaata', () => {
  const r = R('exam-roster.js'); assert.ok(!/innerHTML\s*=/.test(r), 'exam-roster.js me innerHTML nahi hona chahiye');
  const a = R('admit-card.js'); const m = a.match(/innerHTML\s*=\s*([^;]+);/g) || []; m.forEach(x => assert.ok(!/\$\{|\+\s*[a-z]/i.test(x.replace(/'[^']*'/g, '')), x));
});
