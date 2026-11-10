// v231 — Registration (pehle register, baad me roll shuffle + publish) + exam se jodna. Plain Node.
const fs = require('fs'), path = require('path'), assert = require('assert');
const R = p => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');
let n = 0; const T = (name, fn) => { try { fn(); n++; console.log('  PASS ' + name); } catch (e) { console.log('  FAIL ' + name + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
const { pure: P } = require('../../exam-registration.js');
const { pure: RO } = require('../../exam-roster.js');
const mk = (i, g) => ({ name: 'Stu' + String(i).padStart(3, '0'), mobile: '98' + String(10000000 + i), group: g || (i % 3 === 0 ? 'Inst A' : i % 3 === 1 ? 'Inst B' : 'Inst C'), classId: 'class_10', cls: 'Class 10' });
const people = N => Array.from({ length: N }, (_, i) => mk(i + 1));

T('register karte waqt roll NAHI milta; duplicate/galat mobile skip', () => {
  const r = P.addDraft([], [...people(5), mk(1), { name: 'x', mobile: '12345' }]);
  assert.strictEqual(r.added, 5); assert.strictEqual(r.skipped, 2); assert.ok(r.list.every(e => !e.roll));
});
T('3000 se zyada par TOO_MANY', () => {
  const r = P.addDraft(P.addDraft([], people(3000)).list, [mk(99999)]); assert.strictEqual(r.error.code, 'TOO_MANY');
});
T('pehli baar publish: rolls ek poori permutation 1..N, har student ko alag', () => {
  const d = P.addDraft([], people(120)).list, a = P.assignRolls(d, { rollDigits: 3 });
  assert.strictEqual(a.assigned, 120);
  const rolls = a.list.map(e => parseInt(e.roll, 10)).sort((x, y) => x - y);
  assert.deepStrictEqual(rolls, Array.from({ length: 120 }, (_, i) => i + 1));
  assert.ok(a.list.every(e => e.roll.length === 3));
});
T('shuffle: institute-wise cluster nahi (naam ke order se roll alag, institute roll-order me mix)', () => {
  const d = P.addDraft([], people(150)).list, a = P.assignRolls(d, { rollDigits: 3 });
  // naam-order me roll sequence 1..N jaisa nahi hona chahiye
  const inOrder = d.map(e => parseInt(a.list.find(x => x.mobile === e.mobile).roll, 10));
  const sorted = inOrder.slice().sort((x, y) => x - y);
  assert.notDeepStrictEqual(inOrder, sorted);
  // roll-order me ek hi institute ke lagatar 8+ students nahi (random me practically impossible)
  let run = 1, max = 1; for (let i = 1; i < a.list.length; i++) { run = a.list[i].group === a.list[i - 1].group ? run + 1 : 1; max = Math.max(max, run); }
  assert.ok(max < 8, 'max same-group run ' + max);
});
T('rng inject: deterministic; alag rng alag shuffle (crypto default bhi chalta hai)', () => {
  let s = 1; const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const d = P.addDraft([], people(30)).list;
  const a1 = P.assignRolls(d, { rollDigits: 2, rng: (() => { let q = 7; return () => { q = (q * 48271) % 2147483647; return (q - 1) / 2147483646; }; })() });
  const a2 = P.assignRolls(d, { rollDigits: 2, rng });
  assert.notDeepStrictEqual(a1.list.map(e => e.mobile), a2.list.map(e => e.mobile));
  const c = P.assignRolls(d, { rollDigits: 2 }); assert.strictEqual(c.assigned, 30);
});
T('digits kam hon to DIGITS_FULL, kuch assign nahi', () => {
  const d = P.addDraft([], people(120)).list, a = P.assignRolls(d, { rollDigits: 2 });
  assert.strictEqual(a.error.code, 'DIGITS_FULL'); assert.ok(a.list.every(e => !e.roll));
});
T('publish ke baad naya student: purane roll nahi badalte, naya roll bacha hua unique; retired dobara nahi milta', () => {
  const d = P.addDraft([], people(20)).list, a = P.assignRolls(d, { rollDigits: 3 });
  const before = Object.fromEntries(a.list.map(e => [e.mobile, e.roll]));
  const more = P.addDraft(a.list, [mk(500), mk(501), mk(502)]).list;
  const b = P.assignRolls(more, { rollDigits: 3, retired: ['021', '022'] });
  assert.strictEqual(b.assigned, 3);
  b.list.forEach(e => { if (before[e.mobile]) assert.strictEqual(e.roll, before[e.mobile]); });
  const rolls = b.list.map(e => e.roll); assert.strictEqual(new Set(rolls).size, 23);
  b.list.filter(e => !before[e.mobile]).forEach(e => { assert.ok(parseInt(e.roll, 10) > 20); assert.ok(!['021', '022'].includes(e.roll)); });
});
T('parseRows (Excel paste): mobile kisi bhi column me, header skip, DOB normalize, bad lines alag', () => {
  const r = P.parseRows('Name\tMobile\tFather\tClass\tDOB\tSchool\nAarav Sharma\t9000000001\tRam Sharma\t10\t12/03/2008\tABC School\nSita 9833333333, Mohan, 9, 2009-1-5, XYZ\nRohan, Gupta ji, 9811111111\nsirf naam');
  assert.deepStrictEqual(r.people.map(p => [p.name, p.mobile, p.father, p.cls, p.dob, p.group].join('|')),
    ['Aarav Sharma|9000000001|Ram Sharma|10|2008-03-12|ABC School', 'Sita|9833333333|Mohan|9|2009-01-05|XYZ', 'Rohan|9811111111|Gupta ji|||']);
  assert.strictEqual(r.bad.length, 1);
});
T('normDate: valid/invalid', () => {
  assert.strictEqual(P.normDate('5-1-2009'), '2009-01-05'); assert.strictEqual(P.normDate('2008-03-12'), '2008-03-12');
  assert.strictEqual(P.normDate('31/13/2008'), ''); assert.strictEqual(P.normDate('abc'), '');
});
T('addDraft: father/cls/dob/group/hasPhoto save hote hain', () => {
  const r = P.addDraft([], [{ name: 'A', mobile: '9000000001', father: 'F', cls: '10', dob: '12/03/2008', group: 'ABC', hasPhoto: true }]).list[0];
  assert.deepStrictEqual([r.father, r.cls, r.dob, r.group, r.hasPhoto], ['F', '10', '2008-03-12', 'ABC', true]);
});
T('Google Form: script valid JS, token+titles shamil; responses -> students', () => {
  const sc = P.buildScript('tok123abc'); new (require('vm').Script)(sc);
  assert.ok(sc.includes('tok123abc') && sc.includes('doGet') && sc.includes('createForm') && sc.includes('getResponses'));
  Object.values(P.FORM_Q).forEach(t => assert.ok(sc.includes(t)));
  const Q = P.FORM_Q, ppl = P.rowsToPeople([
    { [Q.name]: 'Riya Singh', [Q.mobile]: '98765 43210', [Q.father]: 'Raj', [Q.cls]: '10', [Q.dob]: '2008-05-02', [Q.school]: 'XYZ School' },
    { [Q.name]: 'Bad', [Q.mobile]: '123' }, { [Q.mobile]: '9876543211' }]);
  assert.strictEqual(ppl.length, 1); assert.deepStrictEqual([ppl[0].mobile, ppl[0].group, ppl[0].dob], ['9876543210', 'XYZ School', '2008-05-02']);
});
T('app-registered hona zaroori nahi: module student-cache use nahi karta', () => {
  const src = R('exam-registration.js'); assert.ok(!/allStudentsCache|ensureAllStudentsCache/.test(src));
});
T('admit card: father/DOB/school rows; set nahi', () => {
  const ac = R('admit-card.js'); assert.ok(/fatherName/.test(ac) && /card\.school/.test(ac) && /card\.dob/.test(ac));
});
T('rules: photos subcollection admin-only', () => assert.ok(/match \/photos\/\{pid\}/.test(R('firestore.rules'))));
T('panel smoke (fake DOM): build + open + render bina error ke', () => {
  const vm = require('vm'), reg = {};
  class El { constructor(t) { this.tag = t; this.children = []; this.style = {}; this.attrs = {}; this._text = ''; this.value = ''; this.listeners = {}; }
    setAttribute(k, v) { this.attrs[k] = v; if (k === 'id') reg[v] = this; } removeAttribute(k) { delete this.attrs[k]; } getAttribute(k) { return this.attrs[k]; }
    set id(v) { this.setAttribute('id', v); } get id() { return this.attrs.id; }
    set textContent(v) { this._text = v; this.children = []; } get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    appendChild(c) { this.children.push(c); return c; } addEventListener() {} click() {} scrollIntoView() {} remove() {}
    get classList() { const s = this; return { add() {}, remove() {} }; } set className(v) { this._c = v; } get className() { return this._c || ''; } }
  const doc = { createElement: t => new El(t), createTextNode: t => ({ textContent: t }), getElementById: id => reg[id] || null, body: new El('body'), activeElement: null, querySelectorAll: () => [] };
  const win = { document: doc, SNAP_CONFIG: {}, localStorage: { getItem() { return null; }, setItem() {} }, console, alert() {}, confirm() { return true; }, Promise, Date, JSON, Object, Math, Array, String, Number, Uint8Array, navigator: {}, setTimeout };
  win.window = win; win.globalThis = win; win.document = doc; vm.createContext(win);
  vm.runInContext(R('exam-registration.js'), win);
  assert.ok(win.SnapReg && typeof win.SnapReg.open === 'function');
  win.SnapReg.open();
  ['reg-overlay', 'reg-list', 'reg-m-name', 'reg-m-mobile', 'reg-m-btn', 'reg-form-box', 'reg-paste', 'reg-publish-btn', 'reg-pdf-btn', 'reg-m-file'].forEach(id => assert.ok(reg[id], 'missing #' + id));
  win.SNAP_CONFIG.registration = false; let msg = ''; win.alert = m => { msg = m; }; win.SnapReg.open(); assert.ok(/band/.test(msg));
});
T('groupsOf unique sorted', () => assert.deepStrictEqual(P.groupsOf(people(9)), ['Inst A', 'Inst B', 'Inst C']));
T('exam se jodna: roll registration wale hi, set exam ke sets se roll se; scanIgnoreSet par set null', () => {
  const a = P.assignRolls(P.addDraft([], people(10)).list, { rollDigits: 2 });
  const x = RO.fromRegistration(a.list, { sets: 3 });
  assert.strictEqual(x.list.length, 10); assert.strictEqual(x.nextRoll, 11);
  x.list.forEach((e, i) => { assert.strictEqual(e.set, 'ABC'[(parseInt(e.roll, 10) - 1) % 3]); });
  // roll-order me adjacent sets alag
  for (let i = 1; i < x.list.length; i++) assert.notStrictEqual(x.list[i].set, x.list[i - 1].set);
  assert.ok(RO.fromRegistration(a.list, { sets: 3, scanIgnoreSet: true }).list.every(e => e.set === null));
  assert.strictEqual(RO.fromRegistration(a.list, { sets: 1 }).list[0].set, null);
});
T('jodne ke baad scan verify: registered roll ok, anon roll NOT_REGISTERED', () => {
  const a = P.assignRolls(P.addDraft([], people(10)).list, { rollDigits: 2 });
  const x = RO.fromRegistration(a.list, { sets: 1 }), Rr = { list: x.list, by: RO.indexList(x.list) };
  const e = x.list[3];
  assert.strictEqual(RO.verify(Rr, { sets: 1 }, { roll: e.roll, id: 'z' }, [], '').level, 'ok');
  assert.strictEqual(RO.verify(Rr, { sets: 1 }, { roll: '99', id: 'z' }, [], '').code === undefined, true);
  assert.strictEqual(RO.verify(Rr, { sets: 1 }, { roll: '99', id: 'z' }, [], '').issues[0].code, 'NOT_REGISTERED');
});
T('admit card par Set kahin nahi', () => {
  assert.ok(!/setLetter/.test(R('admit-card.js')));
  assert.ok(!/EXAM SET/.test(R('admit-card.js')));
  assert.ok(!/setLetter/.test(R('exam-registration.js')));
  const ro = R('exam-roster.js'); assert.ok(!/cardFor[\s\S]{0,400}setLetter/.test(ro.slice(ro.indexOf('function cardFor'), ro.indexOf('function cardFor') + 600)));
});
T('wiring: hub button, create form select, loader, sw, rules, flag, hooks', () => {
  const idx = R('index.html'); assert.ok(/__examgrOpenRegSafe/.test(idx) && /id="examgr-add-reg"/.test(idx));
  assert.ok(/__examgrOpenRegSafe\s*=/.test(R('inline/index-inline-06.js')) && /exam-registration\.js\?v=\d+/.test(R('inline/index-inline-06.js')));
  assert.ok(/"\/exam-registration\.js"/.test(R('sw.js')));
  const rl = R('firestore.rules'); assert.ok(/match \/examRegistrations\/\{regId\}/.test(rl) && /match \/roster\/\{rid\}/.test(rl));
  assert.ok(/registration:\s*true/.test(R('app-config.js')));
  const em = R('exam-manager.js'); assert.ok(/SnapRoster\.fillRegSelect/.test(em) && /SnapRoster\.linkRegistration\(u,rg\)/.test(em));
});
T('XSS: naya module innerHTML se dynamic data nahi likhta', () => {
  assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(R('exam-registration.js')));
});
console.log('registration v231 tests passed: ' + n);

/* ---------- end-to-end flow (fake DOM + fake Firestore): register -> publish -> cards ---------- */
(async () => {
  const vm = require('vm'), reg = {}, store = {};
  class El { constructor(t) { this.tag = t; this.children = []; this.style = {}; this.attrs = {}; this._text = ''; this.value = ''; this.disabled = false; }
    setAttribute(k, v) { this.attrs[k] = v; if (k === 'id') reg[v] = this; } removeAttribute(k) { delete this.attrs[k]; } getAttribute(k) { return this.attrs[k]; }
    set id(v) { this.setAttribute('id', v); } get id() { return this.attrs.id; }
    set textContent(v) { this._text = v; this.children = []; } get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    appendChild(c) { this.children.push(c); return c; } addEventListener() {} click() {} scrollIntoView() {} remove() {}
    get classList() { return { add() {}, remove() {} }; } set className(v) { this._c = v; } get className() { return this._c || ''; } }
  const find = (el, txt) => { if (el.textContent === txt && el.onclick) return el; for (const c of el.children || []) { const r = c.children && find(c, txt); if (r) return r; } return null; };
  let auto = 0;
  const docRef = path => ({
    id: path.split('/').pop(), set: async d => { store[path] = JSON.parse(JSON.stringify(d, (k, v) => (v && v.__ts ? 'TS' : v))); }, update: async d => { store[path] = Object.assign(store[path] || {}, d); },
    get: async () => ({ exists: path in store, data: () => store[path] }), delete: async () => { delete store[path]; },
    collection: n => colRef(path + '/' + n) });
  const colRef = path => ({ doc: id => docRef(path + '/' + (id || 'auto' + (++auto))), where: () => ({ get: async () => ({ docs: Object.keys(store).filter(k => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1).map(k => ({ id: k.split('/').pop(), data: () => store[k] })) }) }),
    get: async () => ({ docs: [] }) });
  const batch = () => { const ops = []; return { set: (r, d) => ops.push(() => r.set(d)), delete: r => ops.push(() => r.delete()), commit: async () => { for (const o of ops) await o(); } }; };
  const doc = { createElement: t => new El(t), createTextNode: t => ({ textContent: t }), getElementById: id => reg[id] || null, body: new El('body'), activeElement: null, querySelectorAll: () => [] };
  const win = { document: doc, SNAP_CONFIG: {}, localStorage: { getItem() { return null; }, setItem() {} }, console, alert(m) { throw new Error('alert: ' + m); }, confirm: () => true, Promise, Date, JSON, Object, Math, Array, String, Number, Uint8Array, navigator: {}, setTimeout,
    getDB: () => ({ collection: colRef, batch }), firebase: { firestore: { FieldValue: { serverTimestamp: () => ({ __ts: 1 }) } } }, getCurrentAdminInstituteId: () => 'inst1', getCachedAdminInstituteName: () => 'Savya Coaching' };
  win.window = win; win.globalThis = win; vm.createContext(win); vm.runInContext(R('exam-registration.js'), win);
  const tick = () => new Promise(r => setTimeout(r, 15)), sheet = () => reg['reg-overlay'];
  try {
    win.SnapReg.open(); await tick();
    reg['reg-new-name'].value = 'Demo Mock Test'; reg['reg-new-digits'].value = '2'; find(sheet(), '➕ Registration banayein').onclick(); await tick(); await tick();
    const rid = Object.keys(store).find(k => /^examRegistrations\/[^/]+$/.test(k)); assert.ok(rid, 'registration nahi bani');
    assert.strictEqual(store[rid].instituteId, 'inst1'); assert.strictEqual(store[rid].published, false);
    // 3 students alag-alag institute: form se 1, paste se 2 (app account ke bina)
    reg['reg-m-name'].value = 'Aarav Sharma'; reg['reg-m-mobile'].value = '9000000001'; reg['reg-m-father'].value = 'Ram'; reg['reg-m-group'].value = 'Alpha School'; reg['reg-m-btn'].onclick(); await tick(); await tick();
    reg['reg-paste'].value = 'Priya Verma, 9000000002, Sunil, 10, 12/03/2008, Beta School\nRohan Gupta\t9000000003\tMohan\t9\t\tGamma School'; find(sheet(), '➕ Paste kiye hue add karein').onclick(); await tick(); await tick();
    const roster = store[rid + '/roster/main']; assert.strictEqual(roster.list.length, 3); assert.ok(roster.list.every(e => !e.roll), 'publish se pehle roll nahi hona chahiye');
    assert.strictEqual(store[rid].count, 3);
    // publish
    reg['reg-f-venue'].value = 'Hall 2'; reg['reg-f-digits'].value = '2'; reg['reg-publish-btn'].onclick(); await tick(); await tick(); await tick(); await tick();
    const r2 = store[rid + '/roster/main'].list; assert.ok(r2.every(e => /^0[1-3]$/.test(e.roll)) && new Set(r2.map(e => e.roll)).size === 3, JSON.stringify(r2));
    assert.strictEqual(store[rid].published, true);
    const cards = Object.keys(store).filter(k => k.startsWith('studentAdmitCards/' + rid.split('/')[1] + '_')); assert.strictEqual(cards.length, 3);
    const c1 = store[cards[0]]; assert.ok(c1.roll && c1.name && c1.venue === 'Hall 2' && !('setLetter' in c1) && !('photo' in c1) && c1.instituteName === 'Savya Coaching');
    // publish ke baad late student: turant roll + card
    reg['reg-m-name'].value = 'Late Student'; reg['reg-m-mobile'].value = '9000000004'; reg['reg-m-btn'].onclick(); await tick(); await tick(); await tick();
    const r3 = store[rid + '/roster/main'].list, late = r3.find(e => e.mobile === '9000000004'); assert.ok(late && /^\d\d$/.test(late.roll) && !['01', '02', '03'].includes(late.roll));
    assert.ok(store['studentAdmitCards/' + rid.split('/')[1] + '_9000000004']);
    n++; console.log('  PASS e2e: register(form+paste, bina app account) -> publish shuffle -> cards -> late student');
  } catch (e) { console.log('  FAIL e2e flow\n   ' + (e.stack || e)); process.exitCode = 1; }
  console.log('registration e2e done');
})();
