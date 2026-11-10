/* v221 Phase 4A: gehri branding — helpers escape karte hain, kill-switch kaam karta hai, purane hard-coded jagah par hook laga hai */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..', '..'), rd = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const LOGO = 'data:image/png;base64,iVBORw0KGgo=';
function boot(cfg, brand) {
  const store = { snap_brand_last: 'i1' }; if (brand) store.snap_brand_i1 = JSON.stringify(brand);
  const el = () => ({ style: {}, setAttribute() {}, getAttribute() { return null; }, appendChild() {}, insertBefore() {}, closest() { return null; } });
  const win = { SNAP_CONFIG: cfg, addEventListener() {}, location: { origin: 'https://x' } };
  const ctx = { window: win, document: { readyState: 'complete', querySelector: () => null, getElementById: () => null, createElement: el, body: el(), documentElement: { style: { setProperty() {} } }, addEventListener() {} },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    setInterval() { return 1; }, clearInterval() {}, setTimeout() {}, fetch: () => Promise.reject(), URL, Blob: function () {}, Image: function () {}, JSON, Date, Math, Promise, console };
  vm.createContext(ctx); vm.runInContext(rd('branding.js'), ctx); return { win, store };
}
const B = { name: 'Gyan <b>"Deep"</b> * Academy', tagline: 'Success <i>Starts</i>', brandColor: '#112233', logoDataUrl: LOGO, hidePoweredBy: false, t: Date.now() };
let { win, store } = boot({}, B);
/* escaped result-sheet fields; logo sirf data:image */
assert(!/<b>|<i>/.test(win.SnapBrand.rsf('name', 'x') + win.SnapBrand.rsf('tag', 'x')), 'rsf escape');
assert.strictEqual(win.SnapBrand.rsf('logo', 'fb.png'), LOGO); assert.strictEqual(win.SnapBrand.rsf('sub', 'COACHING'), '');
/* WhatsApp naam me markdown chars/tags hata ke plain */
assert(!/[*_~`\n]/.test(win.SnapBrand.plain('The Vishnu Sharma')), 'plain markdown-free');
/* print bar: escaped, Powered by dikhe; hidePoweredBy par na dikhe */
assert(/Powered by The Vishnu Sharma/.test(win.SnapBrand.printBar())); assert(!/<b>|<i>/.test(win.SnapBrand.printBar()));
({ win } = boot({}, Object.assign({}, B, { hidePoweredBy: true }))); assert(!/Powered by/.test(win.SnapBrand.printBar()));
/* galat logo (svg / javascript:) kabhi nahi chalta */
({ win } = boot({}, Object.assign({}, B, { logoDataUrl: 'javascript:alert(1)' }))); assert.strictEqual(win.SnapBrand.rsf('logo', 'fb.png'), 'fb.png'); assert(!/<img src="javascript/.test(win.SnapBrand.printBar()));
/* kill-switch: branding2=false -> purana (fallback), koi bar nahi, splash flag off */
({ win, store } = boot({ branding2: false }, B)); assert.strictEqual(win.SnapBrand.rsf('name', 'सव्यसाची'), 'सव्यसाची'); assert.strictEqual(win.SnapBrand.plain(), 'The Vishnu Sharma'); assert.strictEqual(win.SnapBrand.printBar(), ''); assert.strictEqual(store.snap_brand2_off, '1');
({ win, store } = boot({}, B)); assert.strictEqual(store.snap_brand2_off, undefined);
/* cache na ho -> sab purana */
({ win } = boot({}, null)); assert.strictEqual(win.SnapBrand.rsf('name', 'X'), 'X'); assert(/Powered by The Vishnu Sharma/.test(win.SnapBrand.printBar()), 'v233: bina institute-branding ke bhi tag-only bar'); assert(!/<img/.test(win.SnapBrand.printBar()));
/* hooks maujood: result sheet, WhatsApp, print, owner switch, config, splash */
const sj = rd('script.js'); assert(/SnapBrand\.rsf\("logo"/.test(sj) && /SnapBrand\.rsf\("name"/.test(sj)); assert.strictEqual((sj.match(/SnapBrand\.plain\(\)/g) || []).length, 4);
assert(/SnapBrand\.plain/.test(rd('upgrade.js')));
assert(/obr-hpb/.test(rd('owner-panel.js')) && /hidePoweredBy:!!/.test(rd('owner-panel.js')));
assert(/branding2:\s*true/.test(rd('app-config.js'))); assert(/snap_brand2_off/.test(rd('inline/index-inline-05.js')));
/* splash me user text innerHTML se nahi */
assert(!/innerHTML/.test(rd('inline/index-inline-05.js').split('PERF FIX v126')[0]), 'splash innerHTML nahi');
console.log('branding2 v221 OK');
