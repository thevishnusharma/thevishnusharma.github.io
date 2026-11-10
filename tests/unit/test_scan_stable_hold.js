// Scan Sheet capture gate: 4 corners must be STEADY (~0.9s) before auto-capture, jitter restarts the hold,
// a single-tick flicker does not, and a persistently shaky hand still captures within ~2.5s (relaxed tolerance).
// Runs the real Ct()/_egSpread()/vn() from exam-manager.js against scripted corner detections.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'exam-manager.js'), 'utf8');
function grab(name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'function not found: ' + name);
  let i = src.indexOf('{', start), d = 0, inStr = null, esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}
let __seed = 20261016; const rand = () => (__seed = (__seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const KEYS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const BASE = { 'top-left': [200, 300], 'top-right': [1240, 300], 'bottom-left': [200, 1620], 'bottom-right': [1240, 1620] };
const VW = 1440, VH = 1920;
function simulate(frameFn, maxMs = 6000, onCap, onStatus, pre) {
  let now = 0, captured = null, calls = 0;
  const ea = KEYS.map(k => ({ dataset: { marker: k }, classList: { add() {}, remove() {}, contains() { return false; } }, querySelector() { return null; } }));
  const ctx = {
    Math, performance: { now: () => now }, HTMLMediaElement: { HAVE_CURRENT_DATA: 2 }, requestAnimationFrame: () => 1,
    c: () => ({ classList: { contains: () => false } }), B: { readyState: 4, videoWidth: VW, videoHeight: VH },
    xn: () => ({ videoWidth: VW, videoHeight: VH, scale: 1, offsetX: 0, offsetY: 0 }),
    Re: { width: 0, height: 0, getContext: () => ({ drawImage() {} }) },
    pn: (u) => ({ corner: u, key: u.dataset.marker }),
    _detCorner: (u) => { const p = ctx.__cur && ctx.__cur[u.dataset.marker]; return p ? { x: p[0], y: p[1] } : null; }, // video px
    bn: (f, m, t, r) => (m ? { x: m.x / r, y: m.y / r } : null),
    Nn: () => 100, Ke(m, l, d) { onStatus && onStatus(d); }, Fn: (pts) => { captured = { t: now, pts }; onCap && onCap(captured); }, _cap: () => 2000, document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }) }) },
  };
  vm.createContext(ctx);
  vm.runInContext([
    'let dt=0,Ae=0,fe=[],Me=-Infinity,ht=0,Je=false,ae=null,be=null,_shMax=0,_shOk=false,_stSince=0,_foundSince=0,_prevFresh=null,_miss=0,_retryNote="",_infK="",_needClear=false,_clearTicks=0,_lastSaved="",_lastVp=null;',
    'const pa=100,ya=2,_HOLD=60,_e={},_trk={},kn=6,wn=["top-left","top-right","bottom-left","bottom-right"];',
    grab('vn'), grab('_egSpread'), grab('_med'), grab('_quadOk'), grab('Ct'),
  ].join('\n'), ctx);
  ctx.ea = ea; pre && vm.runInContext(pre, ctx);
  // ea is referenced as a free variable inside Ct -> expose through the context
  vm.runInContext('var ea = this.ea;', ctx);
  for (now = 1000; now < 1000 + maxMs && !captured; now += 16) { // ~60fps rAF
    ctx.__cur = frameFn(now - 1000);
    vm.runInContext('Ct()', ctx);
  }
  return captured ? captured.t - 1000 : null;
}
const jit = (amp) => () => (rand() * 2 - 1) * amp;
function frames(over) { return (t) => { const o = {}; KEYS.forEach((k, i) => { const j = over.jitter ? over.jitter(t, k) : [0, 0]; o[k] = [BASE[k][0] + j[0], BASE[k][1] + j[1]]; }); return over.drop ? over.drop(t, o) : o; }; }
let pass = 0; const T = (n, f) => { try { f(); pass++; console.log('  PASS ' + n); } catch (e) { console.log('  FAIL ' + n + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
T('steady hand (±1px) captures very fast (<0.5s) but only after 2+ stable frames', () => {
  for (let r = 0; r < 20; r++) { const t = simulate(frames({ jitter: () => [jit(1)(), jit(1)()] })); assert.ok(t !== null && t >= 60 && t <= 500, 'capture time ' + t); }
});
T('hand moving continuously never captures while moving', () => {
  const t = simulate(frames({ jitter: (t) => [t * 0.2, t * 0.1] }), 4000); assert.strictEqual(t, null);
});
T('moderate tremor (±0.4% of width) still captures, within ≤2.2s', () => {
  for (let r = 0; r < 20; r++) { const t = simulate(frames({ jitter: () => [jit(0.004 * VW)(), jit(0.004 * VW)()] })); assert.ok(t !== null && t <= 2200, 'capture time ' + t); }
});
T('single missed corner tick does NOT restart the hold', () => {
  const t = simulate(frames({ drop: (t, o) => { if (t > 400 && t < 520) delete o['top-left']; return o; } })); assert.ok(t !== null && t <= 700, 'capture time ' + t);
});
T('two corners lost for ~1s restarts the hold (captures later than steady)', () => {
  const t = simulate(frames({ drop: (t, o) => { if (t > 30 && t < 1300) { delete o['bottom-right']; delete o['top-left']; } return o; } })); assert.ok(t !== null && t >= 1300, 'capture time ' + t);
});
T('sheet jumps mid-hold → hold restarts from the jump', () => {
  const t = simulate(frames({ jitter: (t) => (t > 40 ? [60, 40] : [0, 0]) })); assert.ok(t !== null && t >= 100, 'capture time ' + t);
});
T('only 3 corners ever visible -> still captures fast and 4th corner is inferred exactly', () => {
  for (const miss of KEYS) {
    let got = null;
    const t = simulate(frames({ drop: (t, o) => { delete o[miss]; return o; } }), 6000, (c) => { got = c; });
    assert.ok(t !== null && t >= 60 && t <= 600, miss + ' capture time ' + t);
    assert.ok(Math.hypot(got.pts[miss].x - BASE[miss][0], got.pts[miss].y - BASE[miss][1]) < 1.5, 'inferred ' + miss + ' ' + JSON.stringify(got.pts[miss]));
  }
});
T('blinking detector (each corner randomly fails 45% of ticks) still locks and captures within ~2.5s', () => {
  let slow = 0;
  for (let r = 0; r < 40; r++) { const t = simulate(frames({ drop: (t, o) => { KEYS.forEach(k => { if (rand() < 0.45) delete o[k]; }); return o; } })); if (t === null || t > 2500) slow++; }
  assert.ok(slow <= 2, 'too many slow/failed locks: ' + slow + '/40');
});
T('green state never flickers off during a steady hold with 30% random misses', () => {
  const states = []; simulate(frames({ drop: (t, o) => { KEYS.forEach(k => { if (rand() < 0.3) delete o[k]; }); return o; } }), 900, null, (d) => states.push(d));
  const fi = states.indexOf(true); assert.ok(states.length > 2 && fi >= 0 && states.slice(fi).every(Boolean), 'ready flicker: ' + states.join(','));
});
T('after a save the SAME sheet is never re-captured until it leaves the view', () => {
  assert.strictEqual(simulate(frames({}), 4000, null, null, '_needClear=true;'), null);
});
T('after a save, removing the sheet (~1s) and showing the next one captures it again (not before)', () => {
  const t = simulate(frames({ drop: (t, o) => (t > 300 && t < 1400 ? {} : o) }), 6000, null, null, '_needClear=true;');
  assert.ok(t !== null && t >= 1400 && t <= 2200, 'capture time ' + t);
});
T('blinking detector on the SAME sheet never falsely counts as "sheet removed" (no duplicate scans)', () => {
  let dup = 0;
  for (let r = 0; r < 30; r++) if (simulate(frames({ drop: (t, o) => { KEYS.forEach(k => { if (rand() < 0.45) delete o[k]; }); return o; } }), 5000, null, null, '_needClear=true;') !== null) dup++;
  assert.ok(dup <= 1, 'duplicate captures: ' + dup + '/30');
});
console.log(pass + ' passed');
