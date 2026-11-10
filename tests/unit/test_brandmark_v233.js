// v233 — "Powered by The Vishnu Sharma" tag har output par (admit card, result sheet, paper print). Plain Node.
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
const R = p => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');
let n = 0; const T = (name, fn) => { try { fn(); n++; console.log('  PASS ' + name); } catch (e) { console.log('  FAIL ' + name + '\n   ' + (e.stack || e)); process.exitCode = 1; } };

/* branding.js ko fake window me chalao */
function boot(cfg, brand) {
  const store = {}; if (brand) { store['snap_brand_inst1'] = JSON.stringify(brand); store['snap_brand_last'] = 'inst1'; }
  const el = () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, querySelector: () => null, classList: { add() {}, remove() {} } });
  const doc = { readyState: 'complete', addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, head: el(), body: el(), documentElement: el() };
  const win = { document: doc, SNAP_CONFIG: cfg || {}, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, addEventListener() {}, console, setInterval() { return 1; }, clearInterval() {}, setTimeout, location: { origin: 'https://x', href: 'https://x/' }, URL, Blob: function () {}, firebase: {} };
  win.window = win; win.self = win; vm.createContext(win); vm.runInContext(R('branding.js'), win); return win;
}
T('mark API: default ON, text sahi, html tag', () => {
  const w = boot({}); assert.strictEqual(w.SnapBrand.mark.on(), true); assert.strictEqual(w.SnapBrand.mark.text, 'Powered by The Vishnu Sharma');
  assert.ok(/Powered by The Vishnu Sharma/.test(w.SnapBrand.mark.html()));
});
T('institute branded + hidePoweredBy=true => tag nahi', () => {
  const w = boot({}, { name: 'Gyan Academy', hidePoweredBy: true }); assert.strictEqual(w.SnapBrand.mark.on(), false); assert.strictEqual(w.SnapBrand.mark.html(), '');
});
T('institute branded, hidePoweredBy nahi => tag', () => {
  const w = boot({}, { name: 'Gyan Academy' }); assert.strictEqual(w.SnapBrand.mark.on(), true);
});
T('kill-switch brandMark=false => nahi', () => { const w = boot({ brandMark: false }); assert.strictEqual(w.SnapBrand.mark.on(), false); assert.strictEqual(w.SnapBrand.mark.html(), ''); });
T('printBar: bina institute-branding ke bhi tag-only bar; hide par khali; branding2=false par khali', () => {
  assert.ok(/Powered by The Vishnu Sharma/.test(boot({}).SnapBrand.printBar()));
  assert.strictEqual(boot({}, { name: 'G', hidePoweredBy: true }).SnapBrand.printBar().includes('Powered by'), false);
  assert.strictEqual(boot({ branding2: false }).SnapBrand.printBar(), '');
});
T('wiring: admit card, result sheet, config flag', () => {
  assert.ok(/function markText\(\)/.test(R('admit-card.js')) && /markText\(\)/.test(R('admit-card.js')));
  assert.ok(/SnapBrand\.mark\.html\(/.test(R('script.js')));
  assert.ok(/brandMark:\s*true/.test(R('app-config.js')));
});
T('admit card: tag footer me aata hai (canvas stub), hide par nahi', () => {
  const calls = []; const ctx = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : k === 'fillText' ? (...a) => calls.push(String(a[0])) : (typeof t[k] === 'undefined' ? () => {} : t[k]), set: (t, k, v) => { t[k] = v; return true; } });
  const mkWin = cfg => { const w = { SNAP_CONFIG: cfg, document: { createElement: () => ({ getContext: () => ctx, width: 0, height: 0, toDataURL: () => '' }), getElementById: () => null, addEventListener() {}, readyState: 'loading', body: {} }, localStorage: { getItem() { return null; }, setItem() {} }, Image: function () {}, console }; w.window = w; w.globalThis = w; return w; };
  const run = cfg => { calls.length = 0; const w = mkWin(cfg); vm.createContext(w); vm.runInContext(R('admit-card.js'), w); return w.SnapAdmit.render({ examId: 'abc', name: 'A', roll: '01', date: '2026-11-08' }, null, 1).then(() => calls.slice()); };
  return run({}).then(a => run({ brandMark: false }).then(b => [a, b])).then(r => { assert.ok(r[0].includes('Powered by The Vishnu Sharma'), 'tag missing'); assert.ok(!r[1].includes('Powered by The Vishnu Sharma')); n++; console.log('  PASS admit card canvas tag on/off'); }).catch(e => { console.log('  FAIL admit card canvas\n   ' + (e.stack || e)); process.exitCode = 1; });
});
console.log('brandmark v233 tests passed: ' + n);
