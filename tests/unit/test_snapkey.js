// v325 — SnapKey (multi-institute student identity) tests. Run: node tests/unit/test_snapkey.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
function load(cfg, search, docs, denyReads) {
  const ls = {}, ss = {}, win = { SNAP_CONFIG: cfg, location: { search: search || '' } };
  win.window = win; win.localStorage = { getItem: (k) => ls[k] || null, setItem: (k, v) => { ls[k] = String(v); } };
  win.sessionStorage = { getItem: (k) => ss[k] || null, setItem: (k, v) => { ss[k] = String(v); } };
  win.URLSearchParams = URLSearchParams;
  win.document = { readyState: 'complete', addEventListener() {}, getElementById: (id) => win.__els && win.__els[id] || null };
  win.setTimeout = () => 0;
  const db = { collection: (c) => ({ doc: (id) => ({ get: async () => { if (denyReads) { const e = new Error('Missing or insufficient permissions'); e.code = 'permission-denied'; throw e; } const d = docs[c + '/' + id]; return { exists: !!d, data: () => d }; } }) }) };
  vm.runInNewContext(fs.readFileSync(__dirname + '/../../snap-key.js', 'utf8'), win);
  return { K: win.SnapKey, db, win, ls };
}
let n = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('  PASS ' + name); } catch (e) { console.log('  FAIL ' + name + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
(async () => {
  await t('isKey / phone / compose: plain mobile stays a plain mobile, composite maps back to the real number', async () => {
    const { K } = load({}, '', {});
    assert.ok(!K.isKey('9876543210')); assert.ok(K.isKey('inst_B__9876543210')); assert.ok(!K.isKey('../x__9876543210')); assert.ok(!K.isKey('inst_B__98765'));
    assert.strictEqual(K.phone('9876543210'), '9876543210'); assert.strictEqual(K.phone('inst_B__9876543210'), '9876543210'); assert.strictEqual(K.compose('inst_B', '9876543210'), 'inst_B__9876543210'); assert.strictEqual(K.phone(null), '');
  });
  await t('switch OFF (default): login/register keys are the plain mobile exactly like before, no extra reads of composite docs', async () => {
    const { K, db } = load({}, '', { 'students/9876543210': { instituteId: 'inst_A' } });
    assert.strictEqual(K.on(), false); assert.strictEqual(await K.loginKey(db, '9876543210', 'inst_B'), '9876543210');
    assert.strictEqual(JSON.stringify(await K.registerKey(db, 'inst_B', '9876543210')), JSON.stringify({ key: '9876543210', exists: true }));
    assert.strictEqual(JSON.stringify(await K.registerKey(db, 'inst_B', '9111111111')), JSON.stringify({ key: '9111111111', exists: false }));
    assert.strictEqual(K.selected('login'), '');
  });
  const ON = { multiInstitute: true };
  await t('ON: login resolves composite first, then legacy key only if its institute matches', async () => {
    const docs = { 'students/9876543210': { instituteId: 'inst_A' }, 'students/inst_B__9876543210': { instituteId: 'inst_B' } };
    const { K, db } = load(ON, '', docs);
    assert.strictEqual(await K.loginKey(db, '9876543210', 'inst_B'), 'inst_B__9876543210');
    assert.strictEqual(await K.loginKey(db, '9876543210', 'inst_A'), '9876543210');
    assert.strictEqual(await K.loginKey(db, '9876543210', 'inst_C'), 'inst_C__9876543210');       // kahin registered nahi -> composite (not found)
    assert.strictEqual(await K.loginKey(db, '9876543210', ''), '9876543210');                    // institute nahi chuna -> purana tareeka
  });
  await t('ON: register always uses the composite key; duplicate only inside the SAME institute (legacy or composite)', async () => {
    const docs = { 'students/9876543210': { instituteId: 'inst_A' } };
    const { K, db } = load(ON, '', docs);
    assert.strictEqual(JSON.stringify(await K.registerKey(db, 'inst_B', '9876543210')), JSON.stringify({ key: 'inst_B__9876543210', exists: false }));   // doosre institute me ok
    assert.strictEqual(JSON.stringify(await K.registerKey(db, 'inst_A', '9876543210')), JSON.stringify({ key: 'inst_A__9876543210', exists: true }));    // wahi institute: duplicate
    docs['students/inst_B__9876543210'] = { instituteId: 'inst_B' };
    assert.strictEqual(JSON.stringify(await K.registerKey(db, 'inst_B', '9876543210')), JSON.stringify({ key: 'inst_B__9876543210', exists: true }));
  });
  await t('ON + profileLockdown (reads denied): never throws; duplicate decision is left to the Worker', async () => {
    const { K, db } = load(ON, '', {}, true);
    assert.strictEqual(JSON.stringify(await K.registerKey(db, 'inst_B', '9876543210')), JSON.stringify({ key: 'inst_B__9876543210', exists: false }));
    assert.strictEqual(await K.loginKey(db, '9876543210', 'inst_B'), 'inst_B__9876543210');
  });
  await t('preset institute from ?inst= link (and remembered for the session); bad ids are ignored', async () => {
    let r = load(ON, '?inst=inst_X', {}); assert.strictEqual(r.K.preset(), 'inst_X'); assert.strictEqual(r.K.selected('login'), 'inst_X');
    r = load(ON, '?inst=../../evil', {}); assert.strictEqual(r.K.preset(), '');
    r = load({ multiInstitute: true, instituteId: 'inst_APP' }, '', {}); assert.strictEqual(r.K.selected('login'), 'inst_APP');
    r = load({}, '?inst=inst_X', {}); assert.strictEqual(r.K.selected('login'), '');              // switch OFF: link ka koi asar nahi
  });
  await t('dropdown value is used when there is no preset; invalid value ignored', async () => {
    const r = load(ON, '', {}); r.win.__els = { 'login-institute': { value: 'inst_Z' }, 'forgot-institute': { value: 'bad id!' } };
    assert.strictEqual(r.K.selected('login'), 'inst_Z'); assert.strictEqual(r.K.selected('forgot'), '');
  });
  console.log('\n' + n + ' passed');
})();
