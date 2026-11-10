/* v220 Phase 3B: demo data — sab isDemo, fixed IDs, 400 se kam writes/commit, URL/secret nahi, asli shape */
const assert = require('assert'), path = require('path');
global.window = { SNAP_CONFIG: {} };
require(path.join('..', '..', 'owner-demo.js'));
const T = window.__ownerDemoTest, s = T.build('TS', 1700000000000);
const all = s.A.concat(s.B);
assert(s.A.length <= T.LIM && s.B.length <= T.LIM, 'har commit <= 400');
/* har doc isDemo (qchunks ke alawa — wo parent test se jude hain) */
all.filter((o) => !/\/qchunks\//.test(o.p)).forEach((o) => assert.strictEqual(o.d.isDemo, true, o.p));
/* sirf demo IDs / demo institute ke andar */
all.forEach((o) => assert(/^(institutes\/demo_sample|students\/0{5}\d{5}$|tests\/demo-test-\d|studentRecords\/demo_rec_)/.test(o.p), 'galat path: ' + o.p));
const c = (re) => all.filter((o) => re.test(o.p)).length;
assert.strictEqual(c(/^students\//), 20); assert.strictEqual(c(/^tests\/demo-test-\d$/), 2); assert.strictEqual(c(/^studentRecords\//), 40);
assert.strictEqual(c(/\/batches\/demo_b\d$/), 2); assert.strictEqual(c(/\/items\//), 8); assert.strictEqual(c(/\/qchunks\//), 2);
/* batch rules ke liye institute doc A (pehle commit) me, qchunks (test doc pe depend) B me */
assert(s.A[0].p === 'institutes/demo_sample'); assert(s.B.every((o) => /qchunks|^institutes\/demo_sample\/batches/.test(o.p)));
/* mobile 10 digit, unique; students ke secrets/sessions nahi */
const mobs = s.A.filter((o) => /^students\//.test(o.p)).map((o) => o.d.mobile); assert(mobs.every((m) => /^\d{10}$/.test(m))); assert.strictEqual(new Set(mobs).size, 20);
assert(!all.some((o) => /studentSecrets|studentSessions/.test(o.p)));
/* result me score hisaab sahi */
s.A.filter((o) => /^studentRecords\//.test(o.p)).forEach((o) => { const d = o.d; assert.strictEqual(d.correct + d.wrong + d.unattempted, 5); assert.strictEqual(d.score, d.correct * 4 - d.wrong); assert(mobs.includes(d.mobile)); });
/* member sirf maujooda student; batch ke items me YouTube ID (link nahi) */
s.B.filter((o) => /\/members\//.test(o.p)).forEach((o) => assert(mobs.includes(o.d.mobile)));
s.B.filter((o) => /\/items\//.test(o.p)).forEach((o) => { assert(/^[\w-]{11}$/.test(o.d.ytId)); assert(!/http/.test(JSON.stringify(o.d))); });
/* institute doc: demo flag, active */
assert.strictEqual(s.A[0].d.isDemo, true); assert.strictEqual(s.A[0].d.active, true);
console.log('demo v220 OK:', s.A.length, '+', s.B.length, 'docs');
