// v236 — Worker: /readlog (token zaroori, galat rows reject), Worker ke apne Firestore reads ki ginti, owner summary/detail/actual. Asli SQLite (node:sqlite) par.
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert'), nodeCrypto = require('crypto');
process.removeAllListeners('warning');
(async () => {
  const { DatabaseSync } = require('node:sqlite');
  const sdb = new DatabaseSync(':memory:');
  const D1 = { exec: async (q) => { sdb.exec(q); }, prepare: (sql) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, all: async () => ({ results: sdb.prepare(sql).all(...a) }), run: async () => { sdb.prepare(sql).run(...a); return {}; } }; return o; },
    batch: async (list) => { for (const s of list) await s.run(); return []; } };
  const { publicKey, privateKey } = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'k1', alg: 'RS256', use: 'sig' });
  const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000), PID = 'proj-x';
  const tok = (extra = {}, key = privateKey) => { const h = b64({ alg: 'RS256', typ: 'JWT', kid: 'k1' }), p = b64(Object.assign({ aud: PID, iss: 'https://securetoken.google.com/' + PID, sub: 'u1', exp: now + 3600, iat: now }, extra)); return h + '.' + p + '.' + nodeCrypto.sign('sha256', Buffer.from(h + '.' + p), key).toString('base64url'); };
  const fsCalls = [];
  const mock = async (u, o) => {
    u = String(u);
    if (u.includes('securetoken@system')) return new Response(JSON.stringify({ keys: [jwk] }));
    if (u.includes('monitoring.googleapis.com')) return new Response(JSON.stringify({ timeSeries: [{ points: [
      { interval: { endTime: new Date(Math.floor(Date.now() / 60000) * 60000).toISOString() }, value: { int64Value: '5000' } }] }] }));
    if (u.includes('oauth2.googleapis.com')) return new Response(JSON.stringify({ access_token: 'AT', expires_in: 3600 }));
    if (u.includes('firestore.googleapis.com')) { fsCalls.push(u);
      if (u.includes(':runQuery')) return new Response(JSON.stringify([{ document: { name: 'x/1' } }, { document: { name: 'x/2' } }, { document: { name: 'x/3' } }]));
      if (u.includes('/documents/institutes/i1/tests') && !u.includes('/tests/')) return new Response(JSON.stringify({ documents: [{}, {}] }));
      return new Response(JSON.stringify({ fields: {} })); }
    throw new Error('unexpected fetch ' + u);
  };
  global.fetch = mock;   // import se PEHLE: Worker apni fetch isi ko lapetega
  const src = fs.readFileSync(path.join(__dirname, '../../push-worker/worker.js'), 'utf8');
  const tmp = path.join(os.tmpdir(), 'w_reads_' + process.pid + '.mjs'); fs.writeFileSync(tmp, src);
  const { default: worker } = await import('file://' + tmp);
  const { privateKey: saKey } = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const SA = JSON.stringify({ project_id: PID, client_email: 'sa@x', private_key: saKey.export({ type: 'pkcs8', format: 'pem' }) });
  const env = { SERVICE_ACCOUNT_JSON: SA, READS_DB: D1, OWNER_EMAILS: 'owner@x.com' };
  const ctx = { waitUntil: (p) => { ctx.p.push(p); }, p: [] }, idle = async () => { await Promise.all(ctx.p.splice(0)); };
  const call = async (m, p, o = {}) => { const r = await worker.fetch(new Request('https://w.example' + p, Object.assign({ method: m }, o)), env, ctx); await idle(); return [r.status, await r.json()]; };
  const min = Math.floor(Date.now() / 60000);
  const rows = [[min, 'student', 'i1', 'institutes/{id}/tests', 'get', 'loadTests@script.js:10', 40, 2, '9876543210', 'Ravi'], [min, 'admin', '', 'questionBank', 'listen', 'syncBank@script.js:99', 7550, 1, 'a@x.com', ''],
    [min, 'worker', '', 'x', 'get', 'x', 5, 1] /* worker role client se nahi */, [min - 99999, 'student', '', 'y', 'get', 'y', 5, 1] /* bahut purana */, [min, 'student', '', 'z', 'get', 'z', 9e9, 1] /* absurd */, 'junk'];

  // 1. token ke bina / galat token
  let [s] = await call('POST', '/readlog', { body: JSON.stringify({ rows }) }); assert.strictEqual(s, 401, 'bina token reject');
  [s] = await call('POST', '/readlog', { headers: { Authorization: 'Bearer ' + tok({}, nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey) }, body: JSON.stringify({ rows }) }); assert.strictEqual(s, 401, 'forged token reject');
  // 2. sahi token: sirf 2 valid rows
  let j; [s, j] = await call('POST', '/readlog', { headers: { Authorization: 'Bearer ' + tok() }, body: JSON.stringify({ build: '236', rows }) });
  assert.strictEqual(s, 200); assert.strictEqual(j.stored, 2, 'sirf 2 valid rows');
  await call('POST', '/readlog', { headers: { Authorization: 'Bearer ' + tok() }, body: JSON.stringify({ build: '236', rows: [rows[0]] }) });   // upsert: add hona chahiye
  // 3. READS_DB na ho to tracker ko error nahi
  const r0 = await worker.fetch(new Request('https://w.example/readlog', { method: 'POST', body: '{}' }), { SERVICE_ACCOUNT_JSON: SA }, ctx); assert.strictEqual((await r0.json()).stored, false);
  // 4. Worker ke apne Firestore reads
  await fetch('https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents/institutes/i1/tests', {});                  // list: 2 docs
  await fetch('https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents/students/9876543210', {});                 // doc: 1
  await fetch('https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents:runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'students' }] } }) });   // 3 docs
  await fetch('https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents/students/9?updateMask.fieldPaths=a', { method: 'PATCH', body: '{}' });   // write: 0 read
  // 5. owner summary
  const OT = tok({ email: 'owner@x.com' });
  [s, j] = await call('GET', '/owner/reads/summary?minutes=60', { headers: { Authorization: 'Bearer ' + OT } });
  assert.strictEqual(s, 200, JSON.stringify(j));
  const by = Object.fromEntries(j.byRole.map((r) => [r.role, r.n]));
  assert.strictEqual(by.student, 80, 'student: 40 + 40 (upsert)'); assert.strictEqual(by.admin, 7550); assert.strictEqual(by.worker, 2 + 1 + 3, 'worker reads 2+1+3, write ginti nahi');
  assert.strictEqual(j.total.n, 80 + 7550 + 6); assert(j.series.length >= 1 && j.series[0].t <= min);
  assert.strictEqual(j.bySite[0].site, 'syncBank@script.js:99', 'sabse bada karan upar');
  assert.strictEqual(j.byUser[0].usr, 'a@x.com'); assert.strictEqual(j.byUser[0].n, 7550, 'admin ID-wise ginti');
  const stu = j.byUser.find((u) => u.usr === '9876543210'); assert(stu && stu.n === 80 && stu.uname === 'Ravi' && stu.role === 'student', 'student ID-wise ginti (upsert ke baad)');
  assert(j.byBuild.some((b) => b.build === '236') && j.byBuild.some((b) => b.build === 'w'));
  assert(!JSON.stringify(j.bySite).includes('9876543210') && !JSON.stringify(j.byColl).includes('9876543210'), 'collection/site me doc id nahi');
  // 6. detail + owner-only
  [s, j] = await call('GET', '/owner/reads/detail?from=' + (min - 1) + '&to=' + (min + 1), { headers: { Authorization: 'Bearer ' + OT } });
  assert.strictEqual(s, 200); assert(j.rows.length >= 3 && j.rows[0].n >= j.rows[1].n);
  assert(j.users.some((u) => u.usr === 'a@x.com'), 'detail me users');
  [s, j] = await call('GET', '/owner/reads/user?role=student&usr=9876543210&minutes=60', { headers: { Authorization: 'Bearer ' + OT } });
  assert.strictEqual(s, 200, JSON.stringify(j)); assert.strictEqual(j.total.n, 80); assert.strictEqual(j.colls[0].coll, 'institutes/{id}/tests');
  [s] = await call('GET', '/owner/reads/summary', { headers: { Authorization: 'Bearer ' + tok({ email: 'stranger@x.com' }) } }); assert.strictEqual(s, 403, 'owner ke alawa koi nahi');
  // 7. actual (Cloud Monitoring)
  [s, j] = await call('GET', '/owner/reads/actual?minutes=60', { headers: { Authorization: 'Bearer ' + OT } });
  assert.strictEqual(s, 200, JSON.stringify(j)); assert.strictEqual(j.total, 5000); assert(j.until > 0);
  console.log('test_worker_reads_v236 OK');
})().catch((e) => { console.error(e); process.exit(1); });
