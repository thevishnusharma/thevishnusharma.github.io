// v330 — SnapAuth client: email OTP flow for student login / password reset. Run: node tests/unit/test_snapauth_otp.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
function setup(responses) {
  const ls = {}, calls = [], signed = [];
  const win = { SNAP_CONFIG: { serverAuth: true, workerUrl: 'https://w.test' }, location: { search: '' } };
  win.window = win; win.localStorage = { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } };
  win.firebase = { auth: () => ({ currentUser: null, signInWithCustomToken: async (t) => { signed.push(t); } }) };
  win.fetch = async (url, init) => { const body = JSON.parse(init.body); calls.push({ path: url.replace('https://w.test', ''), body }); const r = responses.shift(); return { ok: r.status === undefined || r.status < 400, status: r.status || 200, json: async () => r.json }; };
  const otpCalls = []; win.SnapOtp = { student: async (initial, ctx) => { otpCalls.push({ initial, purpose: ctx.purpose }); return responses.__otpResult; } };
  vm.runInNewContext(fs.readFileSync(__dirname + '/../../server-auth.js', 'utf8'), win);
  return { A: win.SnapAuth, calls, signed, ls, otpCalls, responses };
}
let n = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('  PASS ' + name); } catch (e) { console.log('  FAIL ' + name + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
(async () => {
  await t('login without OTP: unchanged (token -> custom sign-in, student returned, no device token sent)', async () => {
    const r = [{ json: { ok: true, token: 'T1', student: { mobile: '9876543210', name: 'S' } } }]; const x = setup(r);
    const s = await x.A.login('9876543210', 'pw', 'inst_A');
    assert.strictEqual(s.mobile, '9876543210'); assert.deepStrictEqual(x.signed, ['T1']); assert.strictEqual(x.otpCalls.length, 0); assert.strictEqual(x.calls[0].body.deviceToken, undefined);
  });
  await t('login with OTP: popup flow, token from the verified result, device token saved per institute+real mobile and sent next time (also after register with composite key)', async () => {
    const r = [{ json: { ok: true, otpRequired: true, challenge: 'C', needEmail: true } }]; r.__otpResult = { ok: true, token: 'T2', student: { mobile: 'inst_A__9876543210' }, deviceToken: 'D'.repeat(64) };
    const x = setup(r); const s = await x.A.login('9876543210', 'pw', 'inst_A');
    assert.strictEqual(x.otpCalls.length, 1); assert.strictEqual(x.otpCalls[0].purpose, 'login'); assert.deepStrictEqual(x.signed, ['T2']); assert.strictEqual(s.mobile, 'inst_A__9876543210');
    assert.strictEqual(x.ls['snap_td:inst_A:9876543210'], 'D'.repeat(64));
    x.responses.push({ json: { ok: true, token: 'T3', student: { mobile: 'x' } } });
    await x.A.login('inst_A__9876543210', 'pw', 'inst_A');                    // register ke baad composite key se login: wahi device pehchana
    assert.strictEqual(x.calls[1].body.deviceToken, 'D'.repeat(64));
    x.responses.push({ json: { ok: true, token: 'T4', student: { mobile: 'y' } } });
    await x.A.login('9876543210', 'pw', 'inst_B'); assert.strictEqual(x.calls[2].body.deviceToken, undefined);   // dusre institute ka device token nahi
  });
  await t('login OTP cancelled -> error, nobody signed in', async () => {
    const r = [{ json: { ok: true, otpRequired: true, challenge: 'C' } }]; const x = setup(r);
    x.otpCalls.length = 0; const win = { }; 
    const A = x.A; let threw = false;
    // SnapOtp ko cancel karwao
    try { const ctxWin = x; ctxWin.signed.length = 0; } catch (e) {}
    r.__otpResult = null;
    try { await A.login('9876543210', 'pw', 'inst_A'); } catch (e) { threw = true; }
    assert.ok(threw, 'null OTP result must not sign in'); assert.strictEqual(x.signed.length, 0);
  });
  await t('password reset with OTP: first call asks for OTP, second call carries the proof', async () => {
    const r = [{ json: { ok: true, otpRequired: true, challenge: 'RC', maskedEmail: 'r***@x.com' } }, { json: { ok: true } }]; r.__otpResult = { ok: true, proof: 'PROOF' };
    const x = setup(r); const j = await x.A.resetWithPin('9876543210', '1234', 'NewPass#1', 'inst_A');
    assert.strictEqual(j.ok, true); assert.strictEqual(x.otpCalls[0].purpose, 'reset'); assert.strictEqual(x.calls.length, 2);
    assert.strictEqual(x.calls[0].body.proof, undefined); assert.strictEqual(x.calls[1].body.proof, 'PROOF'); assert.strictEqual(x.calls[1].body.newPassword, 'NewPass#1');
  });
  await t('password reset without OTP requirement: single call as before', async () => {
    const r = [{ json: { ok: true } }]; const x = setup(r); await x.A.resetWithPin('9876543210', '1234', 'NewPass#1');
    assert.strictEqual(x.calls.length, 1); assert.strictEqual(x.otpCalls.length, 0);
  });
  console.log('\n' + n + ' passed');
})();
