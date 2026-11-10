// v234 — student header / About me institute naam + logo + "Powered by The Vishnu Sharma". Plain Node.
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
const R = p => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');
let n = 0; const T = (name, fn) => { try { fn(); n++; console.log('  PASS ' + name); } catch (e) { console.log('  FAIL ' + name + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
function boot(cfg, brand) {
  const store = {}; if (brand) { store['snap_brand_inst1'] = JSON.stringify(brand); store['snap_brand_last'] = 'inst1'; }
  const lg = { attrs: {}, innerHTML: 'ORIG', getAttribute(k) { return this.attrs[k] || null; }, setAttribute(k, v) { this.attrs[k] = v; } };
  const el = () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, querySelector: () => null, classList: { add() {}, remove() {} } });
  const doc = { readyState: 'complete', addEventListener() {}, getElementById: () => null, querySelector: s => (s === '#sn-top .lg' ? lg : null), querySelectorAll: () => [], createElement: el, head: el(), body: el(), documentElement: el() };
  const win = { document: doc, SNAP_CONFIG: cfg || {}, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, addEventListener() {}, console, setInterval() { return 1; }, clearInterval() {}, setTimeout, location: { origin: 'https://x', href: 'https://x/' }, URL, Blob: function () {}, firebase: {} };
  win.window = win; win.self = win; vm.createContext(win); vm.runInContext(R('branding.js'), win); win.__lg = lg; return win;
}
const LOGO = 'data:image/png;base64,iVBORw0KGgo=';
T('institute: header me naam + Powered by', () => { const w = boot({}, { name: 'Demo Coaching', logoDataUrl: LOGO }); w.SnapBrand.paintHeader(); const h = w.__lg.innerHTML; assert(h.includes('Demo Coaching') && h.includes('Powered by The Vishnu Sharma') && h.includes(LOGO)); assert(!h.includes('Smart Practice')); });
T('logo na ho: pehla akshar avatar', () => { const w = boot({}, { name: 'vishnu sharma', brandColor: '#112233' }); w.SnapBrand.paintHeader(); assert(w.__lg.innerHTML.includes('>V</div>') && w.__lg.innerHTML.includes('#112233')); });
T('hidePoweredBy: tag nahi, tagline', () => { const w = boot({}, { name: 'ABC', tagline: 'Result First', hidePoweredBy: true }); w.SnapBrand.paintHeader(); const h = w.__lg.innerHTML; assert(!h.includes('Powered by') && h.includes('Result First')); });
T('brandMark=false: Powered by nahi', () => { const w = boot({ brandMark: false }, { name: 'ABC' }); w.SnapBrand.paintHeader(); assert(!w.__lg.innerHTML.includes('Powered by')); });
T('branding nahi: purana look + ident fallback', () => { const w = boot({}, null); w.SnapBrand.paintHeader(); assert(w.__lg.innerHTML.includes('The Vishnu Sharma') && w.__lg.innerHTML.includes('Smart Practice')); const i = w.SnapBrand.ident({ name: 'X' }); assert(!i.brand && i.name === 'X'); assert(w.SnapBrand.logoHtml(40).includes('icon-512-maskable.png')); });
T('idempotent: dobara paint par DOM nahi chhedta', () => { const w = boot({}, { name: 'ABC' }); w.SnapBrand.paintHeader(); w.__lg.innerHTML = 'MARK'; w.SnapBrand.paintHeader(); assert.strictEqual(w.__lg.innerHTML, 'MARK'); });
T('XSS: naam escape hota hai', () => { const w = boot({}, { name: '<img src=x onerror=1>' }); w.SnapBrand.paintHeader(); assert(!w.__lg.innerHTML.includes('<img src=x')); });
T('admin welcome ke neeche instruction line hat gayi', () => { assert(!/Tests banayein, question bank manage karein/.test(R('index.html'))); });
console.log(n + ' passed');
