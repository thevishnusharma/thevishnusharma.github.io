// Phase 4 — Worker student auth tests (mock KV + mock Firestore). Run: node tests/unit/test_worker_student_auth.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert'), crypto = require('crypto');
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = { project_id: 'demo-test', client_email: 'sa@demo-test.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
const store = new Map();   // "col/doc" -> {k: stringValue|bool}
const kvm = new Map();
const KV = { async get(k, t) { const v = kvm.get(k); if (v === undefined) return null; return t === 'json' ? JSON.parse(v) : v; }, async put(k, v) { kvm.set(k, v); }, async delete(k) { kvm.delete(k); }, async list({ prefix = '' } = {}) { return { keys: [...kvm.keys()].filter((x) => x.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; } };
const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), fbJwk = { ...fb.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const mails = [], idtk = { users: {} };   // brevo me gaye email, identitytoolkit custom claims
const enc = (o) => { const f = {}; for (const k in o) f[k] = typeof o[k] === 'boolean' ? { booleanValue: o[k] } : { stringValue: String(o[k]) }; return f; };
const sdoc = (p, o) => store.set(p, o);
global.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.includes('service_accounts/v1/jwk')) return new Response(JSON.stringify({ keys: [fbJwk] }));
  if (url.startsWith('https://api.brevo.com/v3/smtp/email')) { mails.push({ headers: init.headers, body: JSON.parse(init.body) }); return new Response('{}', { status: 201 }); }
  if (url.includes('identitytoolkit.googleapis.com') && url.endsWith('/accounts:lookup')) { const id = JSON.parse(init.body).localId[0]; return new Response(JSON.stringify({ users: [{ localId: id, customAttributes: idtk.users[id] || '' }] })); }
  if (url.includes('identitytoolkit.googleapis.com') && url.endsWith('/accounts:update')) { const b = JSON.parse(init.body); idtk.users[b.localId] = b.customAttributes; return new Response('{}'); }
  if (url.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }));
  if (url.includes('/documents:runQuery')) {
    const q = JSON.parse(init.body).structuredQuery, cid = q.from[0].collectionId;
    if (q.from[0].allDescendants) return new Response('{"error":{"code":400,"status":"FAILED_PRECONDITION","message":"The query requires a COLLECTION_GROUP index"}}', { status: 400 });   // asli Firestore: collection-group query ko index chahiye (bana nahi hota)
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
  if ((!init.method || init.method === 'GET') && !store.has(p) && Array.from(store.keys()).some((k) => k.startsWith(p + '/'))) {   // collection LIST (showMissing: parent doc na ho tab bhi child ids)
    const ids = [...new Set(Array.from(store.keys()).filter((k) => k.startsWith(p + '/')).map((k) => k.slice(p.length + 1).split('/')[0]))];
    return new Response(JSON.stringify({ documents: ids.map((id) => ({ name: 'projects/demo-test/databases/(default)/documents/' + p + '/' + id, ...(store.has(p + '/' + id) ? { fields: enc(store.get(p + '/' + id)) } : {}) })) }));
  }
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
  const otpCfgReset = () => {};   // settings cache ko neeche W ko dobara import karke saaf karte hain (60s TTL)

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
  await t('legacy SHA-256 user logs in once and is silently upgraded to PBKDF2 (hash kept only when DELETE_LEGACY_HASH=0)', async () => {
    reset(); sdoc('students/9000000003', { name: 'C', instituteId: 'i' }); sdoc('studentSecrets/9000000003', { hash: sha('old-pass1'), pinHash: sha('1111') });
    assert.strictEqual((await call('/student/login', { mobile: '9000000003', password: 'old-pass1' }, { env: { ...env, DELETE_LEGACY_HASH: '0' } })).status, 200);
    const s = store.get('studentSecrets/9000000003'); assert.ok(s.pw.startsWith('pbkdf2$')); assert.ok(s.hash, 'legacy hash kept only when DELETE_LEGACY_HASH=0');
    assert.strictEqual((await call('/student/login', { mobile: '9000000003', password: 'old-pass1' })).status, 200);   // now via PBKDF2
  });
  await t('default (v326): the unsalted hash is removed right after the first successful login', async () => {
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
    const bad = await call('/student/delete-account', { mobile: '9444444444', confirmMobile: '9444444444', password: 'wrong-pass', instituteId: 'inst_A' });
    assert.strictEqual(bad.status, 401); assert.ok(store.has('students/9444444444'));
    const r = await call('/student/delete-account', { mobile: '9444444444', confirmMobile: '9444444444', password: 'Delete#77', instituteId: 'inst_A' });
    assert.strictEqual(r.status, 200, await r.clone().text()); const deleted = await r.json(); assert.deepStrictEqual(deleted.removed, { records: 1, scanReports: 1, sessions: 1, batchMemberships: 1 });
    assert.ok(!store.has('students/9444444444')); assert.ok(!store.has('studentSecrets/9444444444'));
    assert.ok(!store.has('studentRecords/result_1')); assert.ok(!store.has('studentScanReports/report_1'));
    assert.ok(!store.has('studentSessions/session_1')); assert.ok(!store.has('studentMistakes/9444444444'));
    assert.ok(!store.has('institutes/inst_A/batches/batch_1/members/9444444444'));
    assert.ok(store.has('institutes/inst_B/batches/batch_1/members/9444444444'), 'foreign institute membership must be preserved');
    assert.strictEqual(store.get('institutes/inst_A/batches/batch_1').enrolledCount, 0);
    const unknown = await call('/student/delete-account', { mobile: '9555555555', confirmMobile: '9555555555', password: 'wrong-pass', instituteId: 'inst_A' });
    assert.strictEqual(unknown.status, 401); assert.strictEqual((await unknown.json()).error, 'Mobile number ya password galat hai.');
  });
  await t('large deletion is resumable and does not remove the account until linked records are drained', async () => {
    reset(); const mobile = '9666666666'; sdoc('students/' + mobile, { name: 'G', instituteId: 'inst_A' });
    await call('/student/register', { mobile, password: 'Delete#88', pin: '2468' });
    for (let i = 0; i < 1501; i++) sdoc('studentRecords/large_' + i, { mobile, score: i });
    const body = { mobile, confirmMobile: mobile, password: 'Delete#88', instituteId: 'inst_A' };
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
  // ===== v325 multi-institute: ek mobile, alag institute = alag identity =====
  const claimsOf = (tok) => JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()).claims;
  await t('multi-institute: same mobile registers in institute B (composite key) while institute A student (legacy key) stays untouched', async () => {
    reset(); sdoc('students/9876543210', { name: 'RaviA', instituteId: 'inst_A', hasPin: true }); sdoc('studentSecrets/9876543210', { hash: sha('passA#11') });
    let r = await call('/student/register', { mobile: 'inst_B__9876543210', password: 'PassB#22', pin: '1111', instituteId: 'inst_B' });
    const j = await r.json(); assert.strictEqual(r.status, 200); assert.strictEqual(j.mobile, 'inst_B__9876543210');
    assert.ok(store.get('studentSecrets/inst_B__9876543210').pw.startsWith('pbkdf2$'));
    assert.strictEqual(store.get('studentSecrets/9876543210').hash, sha('passA#11'));          // A ka password bilkul same
  });
  await t('multi-institute: login picks the right identity by institute; wrong institute / wrong password get the same generic 401', async () => {
    reset(); sdoc('students/9876543210', { name: 'RaviA', instituteId: 'inst_A', hasPin: true }); sdoc('studentSecrets/9876543210', { hash: sha('passA#11') });
    sdoc('students/inst_B__9876543210', { name: 'RaviB', instituteId: 'inst_B', hasPin: true });
    await call('/student/register', { mobile: 'inst_B__9876543210', password: 'PassB#22', pin: '1111', instituteId: 'inst_B' });
    let r = await call('/student/login', { mobile: '9876543210', password: 'passA#11', instituteId: 'inst_A' }); let j = await r.json();
    assert.strictEqual(r.status, 200); assert.strictEqual(claimsOf(j.token).mobile, '9876543210'); assert.strictEqual(j.student.name, 'RaviA'); assert.strictEqual(j.student.phone, '9876543210');
    r = await call('/student/login', { mobile: '9876543210', password: 'PassB#22', instituteId: 'inst_B' }); j = await r.json();
    assert.strictEqual(r.status, 200); assert.strictEqual(claimsOf(j.token).mobile, 'inst_B__9876543210'); assert.strictEqual(claimsOf(j.token).instituteId, 'inst_B'); assert.strictEqual(j.student.phone, '9876543210');
    assert.strictEqual((await call('/student/login', { mobile: '9876543210', password: 'passA#11', instituteId: 'inst_B' })).status, 401);   // A ka password B me nahi chalta
    assert.strictEqual((await call('/student/login', { mobile: '9876543210', password: 'PassB#22', instituteId: 'inst_A' })).status, 401);   // B ka password A me nahi chalta
    assert.strictEqual((await call('/student/login', { mobile: '9876543210', password: 'passA#11', instituteId: 'inst_C' })).status, 401);   // C me registered hi nahi
  });
  await t('multi-institute: legacy login WITHOUT institute still works exactly as before', async () => {
    reset(); sdoc('students/9876543210', { name: 'RaviA', instituteId: 'inst_A' }); sdoc('studentSecrets/9876543210', { hash: sha('passA#11') });
    const r = await call('/student/login', { mobile: '9876543210', password: 'passA#11' }); assert.strictEqual(r.status, 200); assert.strictEqual(claimsOf((await r.json()).token).mobile, '9876543210');
  });
  await t('multi-institute: duplicate registration in the SAME institute is rejected (409), legacy and composite', async () => {
    reset(); sdoc('students/9876543210', { name: 'RaviA', instituteId: 'inst_A' }); sdoc('studentSecrets/9876543210', { hash: sha('passA#11') });
    let r = await call('/student/register', { mobile: 'inst_A__9876543210', password: 'Other#pass1', pin: '2222', instituteId: 'inst_A' }); assert.strictEqual(r.status, 409);
    sdoc('students/inst_B__9876543210', { name: 'B', instituteId: 'inst_B' }); sdoc('studentSecrets/inst_B__9876543210', { pw: 'pbkdf2$x' });
    r = await call('/student/register', { mobile: 'inst_B__9876543210', password: 'Other#pass1', pin: '2222', instituteId: 'inst_B' }); assert.strictEqual(r.status, 409);
  });
  await t('multi-institute: PIN reset in institute B changes only B password, A untouched', async () => {
    reset(); sdoc('students/9876543210', { name: 'RaviA', instituteId: 'inst_A', hasPin: true }); sdoc('studentSecrets/9876543210', { hash: sha('passA#11') });
    sdoc('students/inst_B__9876543210', { name: 'RaviB', instituteId: 'inst_B', hasPin: true });
    await call('/student/register', { mobile: 'inst_B__9876543210', password: 'PassB#22', pin: '1111', instituteId: 'inst_B' });
    assert.strictEqual((await call('/student/reset-with-pin', { mobile: '9876543210', pin: '1111', newPassword: 'NewB#pass9', instituteId: 'inst_B' })).status, 200);
    assert.strictEqual((await call('/student/login', { mobile: '9876543210', password: 'NewB#pass9', instituteId: 'inst_B' })).status, 200);
    assert.strictEqual((await call('/student/login', { mobile: '9876543210', password: 'passA#11', instituteId: 'inst_A' })).status, 200);
  });
  await t('multi-institute: deleting the institute-B identity removes only B (profile, secrets, batch membership) and keeps institute A untouched; no collection-group query needed', async () => {
    reset(); const ph = '9777777777';
    sdoc('students/' + ph, { name: 'A', instituteId: 'inst_A' }); sdoc('studentSecrets/' + ph, { hash: sha('passA#11') });
    sdoc('students/inst_B__' + ph, { name: 'B', instituteId: 'inst_B' });
    await call('/student/register', { mobile: 'inst_B__' + ph, password: 'PassB#22', pin: '1111', instituteId: 'inst_B' });
    sdoc('institutes/inst_B/batches/b1/members/inst_B__' + ph, { mobile: 'inst_B__' + ph }); sdoc('institutes/inst_A/batches/b1/members/' + ph, { mobile: ph });
    sdoc('studentRecords/rB', { mobile: 'inst_B__' + ph, score: 1 }); sdoc('studentRecords/rA', { mobile: ph, score: 2 });
    const bad = await call('/student/delete-account', { mobile: ph, confirmMobile: ph, password: 'passA#11', instituteId: 'inst_B' }); assert.strictEqual(bad.status, 401);   // A ka password B ko delete nahi karta
    const r = await call('/student/delete-account', { mobile: ph, confirmMobile: ph, password: 'PassB#22', instituteId: 'inst_B' }); assert.strictEqual(r.status, 200, await r.clone().text());
    assert.ok(!store.has('students/inst_B__' + ph) && !store.has('studentSecrets/inst_B__' + ph) && !store.has('studentRecords/rB') && !store.has('institutes/inst_B/batches/b1/members/inst_B__' + ph));
    assert.ok(store.has('students/' + ph) && store.has('studentSecrets/' + ph) && store.has('studentRecords/rA') && store.has('institutes/inst_A/batches/b1/members/' + ph), 'institute A must be untouched');
  });
  await t('v329 STRICT delete: institute is mandatory, an account of ANOTHER institute is never deleted, even with the right password', async () => {
    reset(); const ph = '9888888888';
    sdoc('students/inst_A__' + ph, { name: 'A', instituteId: 'inst_A' }); sdoc('students/inst_B__' + ph, { name: 'B', instituteId: 'inst_B' });
    await call('/student/register', { mobile: 'inst_A__' + ph, password: 'Same#pass1', pin: '1111', instituteId: 'inst_A' });
    await call('/student/register', { mobile: 'inst_B__' + ph, password: 'Same#pass1', pin: '2222', instituteId: 'inst_B' });     // same number + same password, 2 institutes
    const noInst = await call('/student/delete-account', { mobile: ph, confirmMobile: ph, password: 'Same#pass1' }); assert.strictEqual(noInst.status, 400);
    assert.ok(store.has('students/inst_A__' + ph) && store.has('students/inst_B__' + ph), 'nothing deleted without an institute');
    const wrongKey = await call('/student/delete-account', { mobile: 'inst_A__' + ph, confirmMobile: 'inst_A__' + ph, password: 'Same#pass1', instituteId: 'inst_B' }); assert.strictEqual(wrongKey.status, 400);
    assert.ok(store.has('students/inst_A__' + ph) && store.has('students/inst_B__' + ph));
    const ok = await call('/student/delete-account', { mobile: ph, confirmMobile: ph, password: 'Same#pass1', instituteId: 'inst_B' }); assert.strictEqual(ok.status, 200, await ok.clone().text());
    assert.ok(!store.has('students/inst_B__' + ph) && !store.has('studentSecrets/inst_B__' + ph), 'B deleted');
    assert.ok(store.has('students/inst_A__' + ph) && store.has('studentSecrets/inst_A__' + ph), 'A untouched');
  });
  await t('v329 STRICT delete: a legacy (plain-key) account of institute A cannot be deleted by choosing institute B', async () => {
    reset(); const ph = '9899999999';
    sdoc('students/' + ph, { name: 'A', instituteId: 'inst_A' }); sdoc('studentSecrets/' + ph, { hash: sha('passA#11') });
    const r = await call('/student/delete-account', { mobile: ph, confirmMobile: ph, password: 'passA#11', instituteId: 'inst_B' }); assert.strictEqual(r.status, 401);
    assert.ok(store.has('students/' + ph) && store.has('studentSecrets/' + ph), 'legacy A account must survive');
    const r2 = await call('/student/delete-account', { mobile: ph, confirmMobile: ph, password: 'passA#11', instituteId: 'inst_A' }); assert.strictEqual(r2.status, 200, await r2.clone().text());
    assert.ok(!store.has('students/' + ph));
  });
  await t('v329: /student/institutes lists only active, non-demo institutes with id + name (nothing else)', async () => {
    reset(); sdoc('institutes/inst_A', { name: 'Alpha Coaching', active: true, secretField: 'x' }); sdoc('institutes/inst_B', { name: 'Beta', active: false }); sdoc('institutes/inst_D', { name: 'Demo', isDemo: true }); sdoc('institutes/inst_C', { name: 'Gamma' });
    const r = await call('/student/institutes', {}); const j = await r.json(); assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(j.institutes.map((i) => i.id).sort(), ['inst_A', 'inst_C']);
    assert.ok(j.institutes.every((i) => Object.keys(i).sort().join() === 'id,name'), 'only id + name');
  });
  await t('multi-institute: malformed keys never become odd document paths (they collapse to the plain 10-digit mobile, as before)', async () => {
    reset();
    assert.notStrictEqual((await call('/student/login', { mobile: '../students/9876543210', password: 'x1y2z3' })).status, 200);
    assert.notStrictEqual((await call('/student/login', { mobile: 'a/b__9876543210', password: 'x1y2z3' })).status, 200);
    await call('/student/register', { mobile: 'x'.repeat(80) + '__9876543210', password: 'Secret#77', pin: '1234' });
    assert.ok([...store.keys()].every((k) => /^studentSecrets\/(\d{10}|[A-Za-z0-9_-]{1,64}__\d{10})$/.test(k)), 'unexpected doc path: ' + [...store.keys()]);
    assert.ok(!store.has('studentSecrets/' + 'x'.repeat(80) + '__9876543210'));
  });
  // ===== v330 EMAIL OTP =====
  const OTPENV = { ...env, BREVO_API_KEY: 'k', OTP_FROM: 'no-reply@example.com' };
  const callO = (pth, body, o = {}) => W.fetch(new Request('https://w.test' + pth, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIG, 'CF-Connecting-IP': o.ip || '1.1.1.1' }, body: JSON.stringify(body) }), o.env || OTPENV, { waitUntil() {} });
  const lastCode = () => /(\d{6})/.exec(mails[mails.length - 1].body.textContent)[1];
  const coolOff = () => { for (const k of [...kvm.keys()]) if (k.startsWith('otpcd:')) kvm.delete(k); };   // test me 60s ka intezaar nahi
  const idTok = (claims) => { const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url'), now = Math.floor(Date.now() / 1000); const b = Buffer.from(JSON.stringify({ aud: 'demo-test', iss: 'https://securetoken.google.com/demo-test', sub: 'uid_admin', iat: now, exp: now + 3600, auth_time: now - 5, ...claims })).toString('base64url'); return h + '.' + b + '.' + crypto.sign('RSA-SHA256', Buffer.from(h + '.' + b), fb.privateKey).toString('base64url'); };
  const seedStudent = (k, inst = 'inst_A') => { sdoc('students/' + k, { name: 'S', instituteId: inst, classId: 'c1' }); sdoc('studentSecrets/' + k, { hash: sha('Pass#1234') }); };

  await t('OTP: email service NOT configured -> login works exactly as before (no OTP, never locks anyone out)', async () => {
    reset(); mails.length = 0; seedStudent('9123456780');
    const r = await call('/student/login', { mobile: '9123456780', password: 'Pass#1234' }); const j = await r.json();
    assert.strictEqual(r.status, 200); assert.ok(j.token && !j.otpRequired); assert.strictEqual(mails.length, 0);
  });
  await t('OTP: first login (no email) -> otpRequired + needEmail, NO token; email gets a code; right code returns token + device token and saves the verified email', async () => {
    reset(); mails.length = 0; seedStudent('9123456781');
    let j = await (await callO('/student/login', { mobile: '9123456781', password: 'Pass#1234' })).json();
    assert.strictEqual(j.otpRequired, true); assert.strictEqual(j.needEmail, true); assert.ok(!j.token && j.challenge);
    assert.strictEqual((await callO('/student/otp-send', { challenge: j.challenge })).status, 400);                              // email bina bheje code nahi
    const s = await (await callO('/student/otp-send', { challenge: j.challenge, email: 'Ravi@Example.com' })).json();
    assert.ok(s.ok && s.otpId && /@example\.com$/.test(s.sentTo)); assert.strictEqual(mails.length, 1); assert.strictEqual(mails[0].body.to[0].email, 'ravi@example.com');
    assert.ok(!store.get('studentSecrets/9123456781').email, 'email abhi save nahi (verify se pehle)');
    const bad = await callO('/student/otp-verify', { challenge: j.challenge, otpId: s.otpId, code: '000000' }); assert.strictEqual(bad.status, 400);
    const v = await (await callO('/student/otp-verify', { challenge: j.challenge, otpId: s.otpId, code: lastCode() })).json();
    assert.ok(v.token && /^[a-f0-9]{64}$/.test(v.deviceToken) && v.student.mobile === '9123456781');
    assert.strictEqual(store.get('studentSecrets/9123456781').email, 'ravi@example.com'); assert.strictEqual(store.get('studentSecrets/9123456781').emailVerified, true);
    // bharosemand device: dobara login par OTP nahi
    const j2 = await (await callO('/student/login', { mobile: '9123456781', password: 'Pass#1234', deviceToken: v.deviceToken })).json(); assert.ok(j2.token && !j2.otpRequired);
    // naya device (token nahi): OTP, aur code SIRF jure hue email par (body.email se nahi badal sakte)
    const j3 = await (await callO('/student/login', { mobile: '9123456781', password: 'Pass#1234' })).json(); assert.strictEqual(j3.otpRequired, true); assert.strictEqual(j3.needEmail, false); assert.ok(/@example\.com$/.test(j3.maskedEmail));
    coolOff(); await callO('/student/otp-send', { challenge: j3.challenge, email: 'attacker@evil.com' }); assert.strictEqual(mails[mails.length - 1].body.to[0].email, 'ravi@example.com');
    // galat password par OTP tak pahunchte hi nahi
    assert.strictEqual((await callO('/student/login', { mobile: '9123456781', password: 'wrong-pass' })).status, 401);
  });
  await t('OTP: 5 wrong codes burn the code; old code can never be used again; send has a 60s cooldown; challenge cannot be forged', async () => {
    reset(); mails.length = 0; seedStudent('9123456782');
    const j = await (await callO('/student/login', { mobile: '9123456782', password: 'Pass#1234' })).json();
    const s = await (await callO('/student/otp-send', { challenge: j.challenge, email: 'a@example.com' })).json(); const code = lastCode();
    assert.strictEqual((await callO('/student/otp-send', { challenge: j.challenge, email: 'a@example.com' })).status, 429);      // cooldown
    for (let i = 0; i < 5; i++) assert.strictEqual((await callO('/student/otp-verify', { challenge: j.challenge, otpId: s.otpId, code: '111111' })).status, 400);
    assert.strictEqual((await callO('/student/otp-verify', { challenge: j.challenge, otpId: s.otpId, code })).status, 429);       // 6th: sahi code bhi band
    assert.strictEqual((await callO('/student/otp-verify', { challenge: j.challenge, otpId: s.otpId, code })).status, 400);       // code jal chuka
    const forged = j.challenge.split('.')[0] + '.' + 'a'.repeat(64);
    assert.strictEqual((await callO('/student/otp-send', { challenge: forged, email: 'x@example.com' })).status, 401);
    assert.strictEqual((await callO('/student/otp-send', { challenge: 'abc.def', email: 'x@example.com' })).status, 401);
  });
  await t('OTP: Security Center switch studentOtp=false turns student OTP off', async () => {
    reset(); mails.length = 0; otpCfgReset(); seedStudent('9123456783'); store.set('config/privacy', { studentOtp: false });
    const j = await (await callO('/student/login', { mobile: '9123456783', password: 'Pass#1234' }, { env: { ...OTPENV } })).json(); assert.ok(j.token && !j.otpRequired); store.delete('config/privacy');
  });
  await t('OTP: password reset with an email on file needs the email code (proof) and then untrusts every device', async () => {
    reset(); mails.length = 0; seedStudent('9123456784');
    await call('/student/register', { mobile: '9777000011', password: 'Secret#77', pin: '4321' }).catch(() => {});
    sdoc('students/9123456784', { name: 'S', instituteId: 'inst_A', hasPin: true }); sdoc('studentSecrets/9123456784', { hash: sha('Pass#1234'), pinHash: sha('4321'), email: 'r@example.com', emailVerified: true });
    kvm.set('td:9123456784:' + sha('devtoken'), '1');
    let j = await (await callO('/student/reset-with-pin', { mobile: '9123456784', pin: '4321', newPassword: 'NewPass#99' })).json();
    assert.strictEqual(j.otpRequired, true); assert.ok(j.challenge && /@example\.com$/.test(j.maskedEmail));
    assert.ok(store.get('studentSecrets/9123456784').hash, 'abhi password nahi badla');
    const s = await (await callO('/student/otp-send', { challenge: j.challenge })).json(); assert.strictEqual(mails[mails.length - 1].body.to[0].email, 'r@example.com');
    const v = await (await callO('/student/otp-verify', { challenge: j.challenge, otpId: s.otpId, code: lastCode() })).json(); assert.ok(v.proof);
    const bad = await callO('/student/reset-with-pin', { mobile: '9999999999', pin: '4321', newPassword: 'NewPass#99', proof: v.proof }); assert.notStrictEqual(bad.status, 200);   // proof doosre account par nahi chalta
    const ok = await callO('/student/reset-with-pin', { mobile: '9123456784', pin: '4321', newPassword: 'NewPass#99', proof: v.proof }); assert.strictEqual((await ok.json()).ok, true);
    assert.ok(![...kvm.keys()].some((k) => k.startsWith('td:9123456784:')), 'bharosemand devices hat gaye');
  });
  await t('OTP admin: config/send/verify use the Firebase session; claim otpAuth (this login session only) is added and existing claims are kept', async () => {
    reset(); mails.length = 0; otpCfgReset(); idtk.users = { uid_admin: JSON.stringify({ snapRole: 'admin', instituteId: 'inst_A' }) };
    sdoc('admins/ad@example.com', { active: true, instituteId: 'inst_A' });
    const T = idTok({ email: 'ad@example.com', email_verified: true }); const authTime = JSON.parse(Buffer.from(T.split('.')[1], 'base64url')).auth_time;
    let j = await (await callO('/admin/otp-config', { idToken: T })).json(); assert.strictEqual(j.required, true); assert.strictEqual(j.verified, false);
    const s = await (await callO('/admin/otp-send', { idToken: T })).json(); assert.ok(s.ok); assert.strictEqual(mails[0].body.to[0].email, 'ad@example.com');
    assert.strictEqual((await callO('/admin/otp-verify', { idToken: T, otpId: s.otpId, code: '000000' })).status, 400);
    assert.strictEqual((await callO('/admin/otp-verify', { idToken: idTok({ email: 'ad@example.com', sub: 'uid_other' }), otpId: s.otpId, code: lastCode() })).status, 400);   // doosre user ka code nahi chalta
    assert.strictEqual((await callO('/admin/otp-verify', { idToken: T, otpId: s.otpId, code: lastCode() })).status, 200);
    const claims = JSON.parse(idtk.users.uid_admin); assert.deepStrictEqual(claims.otpAuth, [authTime]); assert.strictEqual(claims.snapRole, 'admin'); assert.strictEqual(claims.instituteId, 'inst_A');
    const T2 = idTok({ email: 'ad@example.com', otpAuth: [authTime], auth_time: authTime }); j = await (await callO('/admin/otp-config', { idToken: T2 })).json(); assert.strictEqual(j.verified, true);
    const T3 = idTok({ email: 'ad@example.com', otpAuth: [authTime], auth_time: authTime + 500 }); j = await (await callO('/admin/otp-config', { idToken: T3 })).json(); assert.strictEqual(j.verified, false);   // nayi (chori ki) login session verified nahi
  });
  await t('OTP admin: a non-admin Firebase user gets required=false and cannot request codes', async () => {
    reset(); mails.length = 0; otpCfgReset();
    const T = idTok({ email: 'random@example.com', sub: 'uid_x' });
    assert.strictEqual((await (await callO('/admin/otp-config', { idToken: T })).json()).required, false);
    assert.strictEqual((await callO('/admin/otp-send', { idToken: T })).status, 403); assert.strictEqual(mails.length, 0);
  });
  console.log('\n' + n + ' passed'); fs.unlinkSync(tmp);
})();
