// v239 — Worker App Check verify + staged gate (off/monitor/enforce). Run: node tests/unit/test_worker_appcheck.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert'), nodeCrypto = require('crypto');
(async () => {
  const src = fs.readFileSync(path.join(__dirname, '../../push-worker/worker.js'), 'utf8').replace('export default worker;', 'export default worker; export { verifyAppCheck };');
  const tmp = path.join(os.tmpdir(), 'w_appcheck_' + process.pid + '.mjs'); fs.writeFileSync(tmp, src);
  const { default: worker, verifyAppCheck } = await import('file://' + tmp);
  const gen = () => nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const { publicKey, privateKey } = gen(), other = gen().privateKey;
  const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'k1', alg: 'RS256', use: 'sig' });
  const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const mk = (payload, kid = 'k1', key = privateKey) => { const h = b64({ alg: 'RS256', typ: 'JWT', kid }), p = b64(payload); return h + '.' + p + '.' + nodeCrypto.sign('sha256', Buffer.from(h + '.' + p), key).toString('base64url'); };
  let jwksUp = true;
  global.fetch = async (u) => { if (String(u).includes('firebaseappcheck.googleapis.com/v1/jwks')) { if (!jwksUp) throw new Error('down'); return new Response(JSON.stringify({ keys: [jwk] })); } throw new Error('unexpected fetch ' + u); };
  const now = Math.floor(Date.now() / 1000), base = { iss: 'https://firebaseappcheck.googleapis.com/12345', aud: ['projects/12345', 'projects/proj-x'], sub: '1:12345:web:abc', exp: now + 3600, iat: now };
  const cases = [
    ['valid', mk(base), 'proj-x', undefined, 'ok'], ['valid + project number', mk(base), 'proj-x', '12345', 'ok'],
    ['wrong project number', mk(base), 'proj-x', '99999', 'bad-iss'], ['token of another project', mk({ ...base, aud: ['projects/1', 'projects/other'] }), 'proj-x', undefined, 'wrong-project'],
    ['expired', mk({ ...base, exp: now - 600 }), 'proj-x', undefined, 'expired'], ['forged signature', mk(base, 'k1', other), 'proj-x', undefined, 'bad-signature'],
    ['unknown key id', mk(base, 'zz'), 'proj-x', undefined, 'unknown-key'], ['Firebase Auth token is not App Check', mk({ ...base, iss: 'https://securetoken.google.com/proj-x' }), 'proj-x', undefined, 'bad-iss'],
    ['garbage', 'abc', 'proj-x', undefined, 'malformed']];
  for (const [n, t, pid, num, exp] of cases) assert.strictEqual(await verifyAppCheck(t, pid, num), exp, n);
  jwksUp = false; assert.strictEqual(await verifyAppCheck(mk(base), 'proj-x'), 'jwks-unavailable'); jwksUp = true;
  const SA = JSON.stringify({ project_id: 'proj-x' }), good = mk(base);
  const call = async (mode, m, p, tok) => worker.fetch(new Request('https://w.example' + p, { method: m, headers: tok ? { 'X-Firebase-AppCheck': tok } : {} }), { APPCHECK_MODE: mode, SERVICE_ACCOUNT_JSON: SA }, {});
  const log = console.log; console.log = () => {};
  try {
    assert.notStrictEqual((await call('off', 'POST', '/x')).status, 401, 'off: token ke bina bhi chalega');
    assert.notStrictEqual((await call('monitor', 'POST', '/x')).status, 401, 'monitor kabhi block nahi karta');
    assert.strictEqual((await call('monitor', 'POST', '/x')).headers.get('X-AppCheck'), 'missing');
    assert.strictEqual((await call('enforce', 'POST', '/x')).status, 401, 'enforce: token nahi => 401');
    assert.strictEqual((await call('enforce', 'POST', '/x', 'garbage')).status, 401);
    assert.notStrictEqual((await call('enforce', 'POST', '/x', good)).status, 401, 'enforce: sahi token chalega');
    assert.notStrictEqual((await call('enforce', 'GET', '/bank/meta')).status, 401, 'GET exempt');
    assert.notStrictEqual((await call('enforce', 'POST', '/broadcast')).status, 401, '/broadcast exempt (GitHub Action)');
    assert.notStrictEqual((await call('enforce', 'POST', '/alert')).status, 401, '/alert exempt');
    jwksUp = false; assert.notStrictEqual((await call('enforce', 'POST', '/x', good)).status, 401, 'JWKS down => fail-open');
  } finally { console.log = log; fs.unlinkSync(tmp); }
  console.log('worker app check OK');
})().catch((e) => { console.error(e); process.exit(1); });
