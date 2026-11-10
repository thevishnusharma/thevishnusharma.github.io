// Phase 4 — Worker student auth tests (mock KV + mock Firestore). Run: node tests/unit/test_worker_student_auth.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert'), crypto = require('crypto');
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = { project_id: 'demo-test', client_email: 'sa@demo-test.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
const store = new Map();   // "col/doc" -> {k: stringValue|bool}
const kvm = new Map();
const KV = { async get(k, t) { const v = kvm.get(k); if (v === undefined) return null; return t === 'json' ? JSON.parse(v) : v; }, async put(k, v) { kvm.set(k, v); }, async delete(k) { kvm.delete(k); } };
const enc = (o) => { const f = {}; for (const k in o) f[k] = typeof o[k] === 'boolean' ? { booleanValue: o[k] } : { stringValue: String(o[k]) }; return f; };
const sdoc = (p, o) => store.set(p, o);
global.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }));
  if (url.includes('/documents:runQuery')) {
    const q = JSON.parse(init.body).structuredQuery, cid = q.from[0].collectionId;
    const filters = q.where.compositeFilter ? q.where.compositeFilter.filters : [q.where];
    const wanted = Object.fromEntries(filters.map((f) => [f.fieldFilter.field.fieldPath, f.fieldFilter.value.stringValue]));
    const docs = [];
    for (const [p, data] of store) {
      const parts = p.split('/'), direct = parts.length === 2 && parts[0] === cid;
      const group = q.from[0].allDescendants && parts[parts.length - 2] === cid;
      if (!(direct || group) || Object.keys(wanted).some((k) => data[k] !== wanted[k])) continue;
      docs.push({ document: { name: 'projects/demo-test/databases/(default)/documents/' + p, fields: enc(data) } });
    }
    return new Response(JSON.stringify(docs.slice(0, q.limit || docs.length)));
  }
  if (url.includes('/documents:batchWrite')) {
    const writes = JSON.parse(init.body).writes;
    writes.forEach((w) => { const marker = '/documents/'; const i = w.delete.indexOf(marker); if (i >= 0) store.delete(w.delete.slice(i + marker.length)); });
    return new Response(JSON.stringify({ status: writes.map(() => ({ code: 0 })) }));
  }
  const m = url.match(/\/documents\/([^?]+)(\?(.*))?$/); if (!m) throw new Error('unexpected fetch ' + url);
  const p = decodeURIComponent(m[1]);
  if (!init.method || init.method === 'GET') { const d = store.get(p); return d ? new Response(JSON.stringify({ fields: enc(d) })) : new Response('{}', { status: 404 }); }
  if (init.method === 'PATCH') {
    const cur = store.get(p) || {}, body = JSON.parse(init.body).fields || {}, mask = (m[3] || '').split('&').map((x) => decodeURIComponent(x.split('=')[1]));
    for (const k of mask) { if (body[k]) cur[k] = body[k].stringValue !== undefined ? body[k].stringValue : (body[k].booleanValue !== undefined ? body[k].booleanValue : (body[k].integerValue !== undefined ? Number(body[k].integerValue) : body[k].timestampValue)); else delete cur[k]; }
    store.set(p, cur); return new Response('{}');
  }
  if (init.method === 'DELETE') { store.delete(p); return new Response('{}'); }
  throw new Error('bad method');
};
(async () => {
  const tmp = path.join(os.tmpdir(), 'worker_under_test.mjs');
  fs.copyFileSync(path.join(__dirname, '..', '..', 'push-worker', 'worker.js'), tmp);
  const W = (await import('file://' + tmp + '?v=' + Date.now())).default;
  const env = { SERVICE_ACCOUNT_JSON: JSON.stringify(SA), BANK_KV: KV, PBKDF2_ITER: '10000' };
  const ORIG = 'https://thevishnusharma.github.io';
  const call = (p, body, o = {}) => W.fetch(new Request('https://w.test' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: o.origin === undefined ? ORIG : o.origin, 'CF-Connecting-IP': o.ip || '1.1.1.1' }, body: JSON.stringify(body) }), o.env || env, { waitUntil() {} });
  const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
  let n = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('  PASS ' + name); } catch (e) { console.log('  FAIL ' + name + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
  const reset = () => { store.clear(); kvm.clear(); };

  await t('register -> PBKDF2 hash stored (no plain/sha256), then login works and returns custom token with claims', async () => {
    reset(); sdoc('students/9876543210', { name: 'Ravi', instituteId: 'inst_A', classId: 'c1', hasPin: true });
    let r = await call('/student/register', { mobile: '9876543210', password: 'Secret#77', pin: '4321' }); assert.strictEqual(r.status, 200);
    const sec = store.get('studentSecrets/9876543210'); assert.ok(sec.pw.startsWith('pbkdf2$')); assert.ok(sec.pin.startsWith('pbkdf2$')); assert.ok(!sec.hash);
    r = await call('/student/login', { mobile: '9876543210', password: 'Secret#77' }); const j = await r.json(); assert.strictEqual(r.status, 200); assert.strictEqual(j.token.split('.').length, 3);
    const claims = JSON.parse(Buffer.from(j.token.split('.')[1], 'base64url').toString()); assert.strictEqual(claims.uid, 's_9876543210'); assert.strictEqual(claims.claims.mobile, '9876543210'); assert.strictEqual(claims.claims.instituteId, 'inst_A');
    assert.strictEqual(j.student.name, 'Ravi');
  });
  await t('wrong password -> 401 generic; 5th failure locks (429 + retryAfter); even right password blocked while locked', async () => {
    reset(); sdoc('students/9000000001', { name: 'A', instituteId: 'i' }); sdoc('studentSecrets/9000000001', { hash: sha('right-pass') });
    for (let i = 0; i < 5; i++) { const r = await call('/student/login', { mobile: '9000000001', password: 'bad' + i }); assert.strictEqual(r.status, 401); assert.strictEqual((await r.json()).error, 'Mobile number ya password galat hai.'); }
    const r = await call('/student/login', { mobile: '9000000001', password: 'right-pass' }); assert.strictEqual(r.status, 429); assert.ok((await r.json()).retryAfter > 0);
  });
  await t('unknown mobile gives the SAME error as wrong password (no account enumeration)', async () => {
    reset(); const r = await call('/student/login', { mobile: '9111111111', password: 'whatever1' }); assert.strictEqual(r.status, 401); assert.strictEqual((await r.json()).error, 'Mobile number ya password galat hai.');
  });
  await t('successful login resets the failure counter', async () => {
    reset(); sdoc('students/9000000002', { name: 'B', instituteId: 'i' }); sdoc('studentSecrets/9000000002', { hash: sha('good-pass') });
    for (let i = 0; i < 3; i++) await call('/student/login', { mobile: '9000000002', password: 'x' + i });
    assert.strictEqual((await call('/student/login', { mobile: '9000000002', password: 'good-pass' })).status, 200);
    assert.ok(!kvm.has('rl:m:9000000002'));
  });
  await t('legacy SHA-256 user logs in once and is silently upgraded to PBKDF2 (hash kept by default)', async () => {
    reset(); sdoc('students/9000000003', { name: 'C', instituteId: 'i' }); sdoc('studentSecrets/9000000003', { hash: sha('old-pass1'), pinHash: sha('1111') });
    assert.strictEqual((await call('/student/login', { mobile: '9000000003', password: 'old-pass1' })).status, 200);
    const s = store.get('studentSecrets/9000000003'); assert.ok(s.pw.startsWith('pbkdf2$')); assert.ok(s.hash, 'legacy hash kept until DELETE_LEGACY_HASH=1');
    assert.strictEqual((await call('/student/login', { mobile: '9000000003', password: 'old-pass1' })).status, 200);   // now via PBKDF2
  });
  await t('DELETE_LEGACY_HASH=1 removes the unsalted hash after upgrade', async () => {
    reset(); sdoc('students/9000000004', { name: 'D', instituteId: 'i' }); sdoc('studentSecrets/9000000004', { hash: sha('old-pass2') });
    assert.strictEqual((await call('/student/login', { mobile: '9000000004', password: 'old-pass2' }, { env: { ...env, DELETE_LEGACY_HASH: '1' } })).status, 200);
    assert.ok(!store.get('studentSecrets/9000000004').hash);
  });
  await t('CORS: foreign origin is rejected (403), allowed origins + capacitor/localhost pass', async () => {
    reset(); assert.strictEqual((await call('/student/login', { mobile: '9000000005', password: 'x' }, { origin: 'https://evil.example' })).status, 403);
    assert.notStrictEqual((await call('/student/login', { mobile: '9000000005', password: 'x' }, { origin: 'https://localhost' })).status, 403);
    const r = await call('/student/login', { mobile: '9000000005', password: 'x' }, { origin: 'http://localhost:5500' }); assert.strictEqual(r.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5500');
  });
  await t('register rejects weak/short passwords and bad PIN', async () => {
    reset(); for (const pw of ['123456', 'abc', 'password', 'aaaaaaaa']) assert.strictEqual((await call('/student/register', { mobile: '9222222222', password: pw, pin: '1234' })).status, 400);
    assert.strictEqual((await call('/student/register', { mobile: '9222222222', password: 'Good#pass1', pin: '12' })).status, 400);
  });
  await t('account deletion requires the correct password and removes profile, secrets, results, reports, sessions, mistakes and batch memberships', async () => {
    reset();
    sdoc('students/9444444444', { name: 'F', instituteId: 'inst_A', classId: 'c1' });
    await call('/student/register', { mobile: '9444444444', password: 'Delete#77', pin: '2468' });
    sdoc('studentRecords/result_1', { mobile: '9444444444', score: 9 });
    sdoc('studentScanReports/report_1', { mobile: '9444444444', photoDataUrl: 'data:image/jpeg;base64,secret' });
    sdoc('studentSessions/session_1', { mobile: '9444444444', proof: 'proof' });
    sdoc('studentMistakes/9444444444', { mistakes: ['q1'] });
    sdoc('institutes/inst_A/batches/batch_1', { enrolledCount: 1 });
    sdoc('institutes/inst_A/batches/batch_1/members/9444444444', { mobile: '9444444444', instituteId: 'inst_A' });
    sdoc('institutes/inst_B/batches/batch_1/members/9444444444', { mobile: '9444444444', instituteId: 'inst_B' });
    const bad = await call('/student/delete-account', { mobile: '9444444444', confirmMobile: '9444444444', password: 'wrong-pass' });
    assert.strictEqual(bad.status, 401); assert.ok(store.has('students/9444444444'));
    const r = await call('/student/delete-account', { mobile: '9444444444', confirmMobile: '9444444444', password: 'Delete#77' });
    assert.strictEqual(r.status, 200, await r.clone().text()); const deleted = await r.json(); assert.deepStrictEqual(deleted.removed, { records: 1, scanReports: 1, sessions: 1, batchMemberships: 1 });
    assert.ok(!store.has('students/9444444444')); assert.ok(!store.has('studentSecrets/9444444444'));
    assert.ok(!store.has('studentRecords/result_1')); assert.ok(!store.has('studentScanReports/report_1'));
    assert.ok(!store.has('studentSessions/session_1')); assert.ok(!store.has('studentMistakes/9444444444'));
    assert.ok(!store.has('institutes/inst_A/batches/batch_1/members/9444444444'));
    assert.ok(store.has('institutes/inst_B/batches/batch_1/members/9444444444'), 'foreign institute membership must be preserved');
    assert.strictEqual(store.get('institutes/inst_A/batches/batch_1').enrolledCount, 0);
    const unknown = await call('/student/delete-account', { mobile: '9555555555', confirmMobile: '9555555555', password: 'wrong-pass' });
    assert.strictEqual(unknown.status, 401); assert.strictEqual((await unknown.json()).error, 'Mobile number ya password galat hai.');
  });
  await t('large deletion is resumable and does not remove the account until linked records are drained', async () => {
    reset(); const mobile = '9666666666'; sdoc('students/' + mobile, { name: 'G', instituteId: 'inst_A' });
    await call('/student/register', { mobile, password: 'Delete#88', pin: '2468' });
    for (let i = 0; i < 1501; i++) sdoc('studentRecords/large_' + i, { mobile, score: i });
    const body = { mobile, confirmMobile: mobile, password: 'Delete#88' };
    const first = await call('/student/delete-account', body); assert.strictEqual(first.status, 503); assert.ok(store.has('students/' + mobile));
    assert.strictEqual(Array.from(store.keys()).filter((p) => p.startsWith('studentRecords/')).length, 1);
    const second = await call('/student/delete-account', body); assert.strictEqual(second.status, 200, await second.clone().text());
    assert.ok(!store.has('students/' + mobile)); assert.strictEqual(Array.from(store.keys()).filter((p) => p.startsWith('studentRecords/')).length, 0);
  });
  await t('reset-with-pin: wrong PIN locked after 5, right PIN resets password and old password stops working', async () => {
    reset(); sdoc('students/9333333333', { name: 'E', instituteId: 'i' }); sdoc('studentSecrets/9333333333', { hash: sha('oldpw12'), pinHash: sha('2468') });
    assert.strictEqual((await call('/student/reset-with-pin', { mobile: '9333333333', pin: '2468', newPassword: 'New#pass99' })).status, 200);
    assert.strictEqual((await call('/student/login', { mobile: '9333333333', password: 'New#pass99' })).status, 200);
    assert.strictEqual((await call('/student/login', { mobile: '9333333333', password: 'oldpw12' })).status, 401);
    for (let i = 0; i < 5; i++) await call('/student/reset-with-pin', { mobile: '9333333333', pin: '000' + i, newPassword: 'Other#pass1' });
    assert.strictEqual((await call('/student/reset-with-pin', { mobile: '9333333333', pin: '2468', newPassword: 'Other#pass1' })).status, 429);
  });
  await t('IP limit: 20 failures from one IP across different mobiles -> 429', async () => {
    reset(); let last; for (let i = 0; i < 21; i++) last = await call('/student/login', { mobile: '90000' + String(10000 + i), password: 'x' }, { ip: '9.9.9.9' });
    assert.strictEqual(last.status, 429);
  });
  console.log('\n' + n + ' passed'); fs.unlinkSync(tmp);
})();
