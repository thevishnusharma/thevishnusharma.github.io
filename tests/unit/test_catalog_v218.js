/* v218 Phase 2: catalog build / chunking / hash / entry<->item / sync (fake Firestore) */
const assert = require('assert'), fs = require('fs'), path = require('path');
const store = {}; global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const written = []; const deleted = [];
const fakeDoc = (p) => ({ path: p });
global.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
const mkDb = () => ({ batch: () => { const ops = []; return { set: (r, d) => ops.push(['set', r.path, d]), delete: (r) => ops.push(['del', r.path]), commit: async () => { ops.forEach((o) => (o[0] === 'set' ? written.push(o) : deleted.push(o))); } }; },
  collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ collection: () => ({ doc: (id) => fakeDoc('c/' + id) }) }) }) }) }) });
global.window = { vishnuFirebase: { enabled: true, db: mkDb() }, SNAP_CONFIG: {} };
const C = require(path.join('..', '..', 'batch-catalog.js'));

const mk = (n, extra) => Array.from({ length: n }, (_, i) => Object.assign({ id: 'i' + String(i).padStart(4, '0'), kind: 'recording', title: 'L' + i, published: true, createdAt: i + 1, url: 'https://secret.example/' + i, ytId: 'dQw4w9WgXcQ' }, extra || {}));

/* sirf published; unpublished/bina id wale nahi */
let docs = C.build([...mk(3), { id: 'x', kind: 'note', title: 'draft', published: false }, { kind: 'note', title: 'noid', published: true }]);
assert.strictEqual(docs.length, 1); assert.strictEqual(docs[0].n, 3); assert.strictEqual(docs[0].tot, 1);
/* link catalog me nahi aata */
assert(!JSON.stringify(docs).includes('secret.example'), 'URL catalog me nahi hona chahiye');
/* khaali batch: c1 phir bhi */
docs = C.build([]); assert.strictEqual(docs.length, 1); assert.strictEqual(docs[0].n, 0);
/* chunking: 700 items -> 3 docs (300,300,100), har me tot=3 */
docs = C.build(mk(700)); assert.deepStrictEqual(docs.map((d) => d.n), [300, 300, 100]); assert(docs.every((d) => d.tot === 3));
assert.deepStrictEqual(docs.map((d) => d.id), ['c1', 'c2', 'c3']);
/* hash: same input -> same hash; ek item badla -> sirf us doc ka hash badla */
const a = C.build(mk(700)), items2 = mk(700); items2[650].title = 'changed'; const b = C.build(items2);
assert.strictEqual(a[0].h, b[0].h); assert.strictEqual(a[1].h, b[1].h); assert.notStrictEqual(a[2].h, b[2].h);
/* entry <-> item */
const it = { id: 'c9', kind: 'class', title: 'Live', published: true, status: 'live', ytId: 'dQw4w9WgXcQ', scheduledAt: { toMillis: () => 1234 }, createdAt: { toMillis: () => 99 }, subjectId: 's1', chapterId: 'h1', subject: 'Phy', chapter: 'Motion' };
const e = C.entryOf(it), back = C.toItem(e, 'b1', 'inst1');
assert.strictEqual(back.status, 'live'); assert.strictEqual(back.ytId, 'dQw4w9WgXcQ'); assert.strictEqual(back.scheduledAt, 1234); assert.strictEqual(back.createdAt, 99);
assert.strictEqual(back._p, 1); assert.strictEqual(back.batchId, 'b1'); assert.strictEqual(back.subjectId, 's1'); assert(!('url' in back));
/* purani live (link, bina ytId) -> _lv; file wali recording -> _f; announcement desc */
assert.strictEqual(C.toItem(C.entryOf({ id: 'a', kind: 'class', title: 't', status: 'live', liveUrl: 'https://x.y/z', published: true }), 'b', 'i')._lv, 1);
assert.strictEqual(C.toItem(C.entryOf({ id: 'a', kind: 'note', title: 't', ownFile: { key: 'k' }, published: true }), 'b', 'i')._f, 1);
assert.strictEqual(C.toItem(C.entryOf({ id: 'a', kind: 'announcement', title: 't', desc: 'hello', published: true }), 'b', 'i').desc, 'hello');

/* sync: pehli baar sab docs likhe, dobara same data -> 0 writes, ek item badla -> 1 doc, ghatne par extra doc delete */
(async () => {
  const items = mk(700);
  assert.strictEqual(await C.sync('inst1', 'b1', items), true); assert.strictEqual(written.length, 3);
  written.length = 0; assert.strictEqual(await C.sync('inst1', 'b1', items), false); assert.strictEqual(written.length, 0, 'bina badlaav ke write nahi');
  const it2 = mk(700); it2[650].title = 'changed'; assert.strictEqual(await C.sync('inst1', 'b1', it2), true); assert.strictEqual(written.length, 1, 'sirf badla hua doc');
  written.length = 0; assert.strictEqual(await C.sync('inst1', 'b1', mk(100)), true); assert.strictEqual(written.length, 1); assert.deepStrictEqual(deleted.map((d) => d[1]).sort(), ['c/c2', 'c/c3']);
  /* kill-switch */
  global.window.SNAP_CONFIG.catalog = false; written.length = 0; assert.strictEqual(await C.sync('inst1', 'b2', mk(5)), false); assert.strictEqual(written.length, 0);
  console.log('ok test_catalog_v218');
})().catch((err) => { console.error(err); process.exit(1); });
