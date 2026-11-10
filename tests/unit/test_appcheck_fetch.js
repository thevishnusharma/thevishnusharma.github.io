// v239 — firebase-config.js ka fetch wrapper: App Check token sirf Worker POST par jaata hai, kabhi atakta nahi. Run: node tests/unit/test_appcheck_fetch.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(require('path').join(__dirname, '../../firebase-config.js'), 'utf8');
const code = src.slice(src.indexOf('/* v239: App Check token Worker'));
assert(code.length > 200, 'wrapper code nahi mila');
const W = 'https://w.example.workers.dev';
function setup(state, tokenFn) {
  const seen = [];
  const win = { SNAP_CONFIG: { workerUrl: W }, vishnuFirebase: { appCheckState: state }, fetch: async (u, i) => { seen.push({ u: String(u), h: new Headers((i && i.headers) || {}).get('X-Firebase-AppCheck'), m: (i && i.method) || 'GET' }); return { ok: true }; } };
  const ctx = { window: win, Headers, Promise, Date, setTimeout, String, Object, firebase: { appCheck: () => ({ getToken: tokenFn }) } };
  vm.runInNewContext(code, ctx);
  return { win, seen };
}
(async () => {
  let n = 0;
  let s = setup('initialized:web-recaptcha-v3', async () => { n++; return { token: 'TOK1' }; });
  await s.win.fetch(W + '/student/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.strictEqual(s.seen[0].h, 'TOK1', 'Worker POST par token jaana chahiye');
  await s.win.fetch(W + '/student/login', { method: 'POST' });
  assert.strictEqual(n, 1, 'token cache hona chahiye (SDK dobara nahi bulana)');
  await s.win.fetch(W + '/bank/meta');
  assert.strictEqual(s.seen[2].h, null, 'GET par header nahi');
  await s.win.fetch('https://other.example/api', { method: 'POST' });
  assert.strictEqual(s.seen[3].h, null, 'doosre domain par token kabhi nahi jaana chahiye (leak)');
  s = setup('web-site-key-missing', async () => ({ token: 'X' }));
  await s.win.fetch(W + '/x', { method: 'POST' });
  assert.strictEqual(s.seen[0].h, null, 'App Check active nahi => header nahi, request phir bhi jaati hai');
  s = setup('initialized:web-recaptcha-v3', () => new Promise(() => {}));   // kabhi resolve nahi hota
  const t0 = Date.now(); await s.win.fetch(W + '/x', { method: 'POST' }); const dt = Date.now() - t0;
  assert(dt < 2200 && s.seen.length === 1 && s.seen[0].h === null, 'token atke to 1.5s baad bina header ke jaana chahiye (dt=' + dt + ')');
  s = setup('initialized:web-recaptcha-v3', async () => { throw new Error('boom'); });
  await s.win.fetch(W + '/x', { method: 'POST' });
  assert.strictEqual(s.seen.length, 1, 'getToken error par bhi request jaati hai');
  console.log('appcheck fetch wrapper OK');
})().catch((e) => { console.error(e); process.exit(1); });
