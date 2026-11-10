// v236 — read-tracker.js: Firestore reads ki ginti (cache=0, doc=1, query=size, listener pehla/badlav) + payload me koi data nahi. Run: node tests/unit/test_read_tracker_v236.js
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '../../read-tracker.js'), 'utf8');
function mkSandbox() {
  const sent = [], timers = [];
  // fake compat SDK
  const snapQ = (size, o = {}) => ({ size, metadata: { fromCache: !!o.cache, hasPendingWrites: !!o.pend }, docChanges: () => new Array(o.ch == null ? size : o.ch).fill({}) });
  class Query { constructor(p) { this.path = p; } get() { return Promise.resolve(this.next); } onSnapshot(cb) { this.cb = cb; return () => {}; } }
  class DocumentReference { constructor(p) { this.path = p; } get() { return Promise.resolve(this.next); } onSnapshot(cb) { this.cb = cb; return () => {}; } }
  const win = { SNAP_CONFIG: { workerUrl: 'https://w.example', build: '236' }, location: { pathname: '/index.html', search: '' },
    firebase: { firestore: { Query, DocumentReference }, apps: [] }, vishnuFirebase: { auth: { currentUser: { isAnonymous: true, getIdToken: () => Promise.resolve('TOK') } } },
    addEventListener() {} };
  win.window = win;
  const ctx = vm.createContext(Object.assign(win, { document: { addEventListener() {}, visibilityState: 'visible' }, localStorage: { getItem: (k) => k === 'savya_student_session' ? JSON.stringify({ mobile: '9876543210', name: 'Ravi' }) : null, setItem() {} },
    setInterval: (f, ms) => { timers.push(f); return timers.length; }, clearInterval() {}, setTimeout, Date, Math, JSON, Promise, Error, Object, Array, String, console,
    fetch: (u, o) => { sent.push({ u, o }); return Promise.resolve({ ok: true, status: 200 }); } }));
  vm.runInContext(src, ctx, { filename: 'https://app.example/read-tracker.js?v=1' });
  return { win, sent, snapQ, Query, DocumentReference };
}
(async () => {
  const { win, sent, snapQ, Query, DocumentReference } = mkSandbox();
  const R = win.SnapReads; assert(R && R.installed, 'tracker install nahi hua');
  function getFromTestSite() { return q.get(); }
  const q = new Query('institutes/instA/tests'); q.next = snapQ(7);
  await getFromTestSite(); await new Promise(r => setImmediate(r));
  assert.strictEqual(R.total, 7, 'query get = 7 docs');
  q.next = snapQ(5, { cache: true }); await q.get(); await new Promise(r => setImmediate(r));
  assert.strictEqual(R.total, 7, 'cache se aaya = 0 read');
  q.next = snapQ(0); await q.get(); await new Promise(r => setImmediate(r));
  assert.strictEqual(R.total, 8, 'khaali query bhi 1 read');
  const d = new DocumentReference('students/9876543210'); d.next = { metadata: { fromCache: false } }; await d.get(); await new Promise(r => setImmediate(r));
  assert.strictEqual(R.total, 9, 'doc get = 1');
  // listener: pehla = poore, badlav = changed docs, cache/pending = 0
  const q2 = new Query('questionBank'); let seen = 0; q2.onSnapshot(() => { seen++; });
  q2.cb(snapQ(100, { cache: true })); assert.strictEqual(R.total, 9);
  q2.cb(snapQ(100)); assert.strictEqual(R.total, 109, 'listener pehla server snapshot');
  q2.cb(snapQ(100, { ch: 2 })); assert.strictEqual(R.total, 111, 'listener badlav = sirf changed docs');
  q2.cb(snapQ(100, { ch: 1, pend: true })); assert.strictEqual(R.total, 111, 'local pending write = 0');
  assert.strictEqual(seen, 4, 'app ka apna callback chalta rahe');
  // observer object form
  const q3 = new Query('admins'); let nx = 0; q3.onSnapshot({ next() { nx++; }, error() {} }); q3.cb.next ? q3.cb.next(snapQ(3)) : null;
  assert.strictEqual(nx, 1);
  // key me data nahi: template path, student id {id}
  const keys = Object.keys(R.buf).join('\n');
  assert(!/students\/9876543210/.test(keys), 'doc id path me nahi jaana chahiye (sirf user column me mobile)');
  assert(/\|9876543210\|Ravi/.test(keys), 'user ki pehchan (mobile+naam) key me honi chahiye');
  assert(/students\/\{id\}/.test(keys) && /institutes\/\{id\}\/tests/.test(keys), 'template path: ' + keys);
  assert(/instA/.test(keys), 'institute alag column me');
  assert(/getFromTestSite@/.test(keys), 'function ka naam site me: ' + keys);
  // Owner APK (page index.html) — ownerGetAuth se pehchan
  const o = mkSandbox(); o.win.ownerGetAuth = () => null; const oq = new o.Query('admins'); oq.next = o.snapQ(2); await oq.get(); await new Promise(r => setImmediate(r));
  assert(/\|owner\|/.test(Object.keys(o.win.SnapReads.buf).join('\n')), 'owner role pehchana nahi gaya');
  // flush
  R.flush(); await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
  assert.strictEqual(sent.length, 1, 'ek hi POST');
  assert.strictEqual(sent[0].u, 'https://w.example/readlog');
  assert.strictEqual(sent[0].o.headers.Authorization, 'Bearer TOK');
  const body = JSON.parse(sent[0].o.body);
  assert.strictEqual(body.build, '236'); assert(body.rows.every(r => r.length === 10 && r[1] === 'student'));
  assert.strictEqual(body.rows.reduce((s, r) => s + r[6], 0), 111 + 3, 'bheji gayi ginti = total');
  assert(body.rows.every(r => r[8] === '9876543210' && r[9] === 'Ravi'), 'har row me user');
  assert(!/students\/9876543210/.test(sent[0].o.body), 'doc path me id nahi');
  console.log('test_read_tracker_v236 OK');
})().catch(e => { console.error(e); process.exit(1); });
