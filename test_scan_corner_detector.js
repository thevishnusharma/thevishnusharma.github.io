// Live-video corner detector (_detLum): compared against the old single-threshold box-only detector (aa) on synthetic
// blurry / noisy / shadowed / rotated frames with distractors. The new one must (a) find far more markers when aligned,
// (b) also find them when NOT perfectly inside the blue box, (c) almost never report a wrong blob.
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
const ctx = { Math, Uint8Array, Uint32Array, Int32Array, Float64Array };
vm.createContext(ctx); const pbStart = src.indexOf('const _pb={'); assert.ok(pbStart >= 0, 'const _pb not found');
const pbDecl = src.slice(pbStart, src.indexOf('};', pbStart) + 2); // shared scratch buffers used by _detLum
vm.runInContext([pbDecl, grab('_pbS'), grab('_pbQ'), grab('yn'), grab('aa'), grab('_detLum')].join('\n'), ctx);
const detNew = vm.runInContext('_detLum', ctx), detOld = vm.runInContext('aa', ctx);
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; const rr = (a, b) => a + (b - a) * rnd();
const W = 250, H = 250, BOX = 156; // region = 1.6 x blue box
function frame(opts) {
  const f = new Float64Array(W * H), P = opts.paper;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const sh = opts.shadow * Math.max(0, 1 - Math.hypot(x - opts.sx, y - opts.sy) / 200); f[y * W + x] = P * (1 - sh); }
  const ink = opts.ink;
  const poly = (cx, cy, size, rot) => { const c = Math.cos(rot), s = Math.sin(rot), h = size / 2; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = x - cx, dy = y - cy, u = dx * c + dy * s, v = -dx * s + dy * c; if (Math.abs(u) <= h && Math.abs(v) <= h) f[y * W + x] = ink; } };
  const disk = (cx, cy, r, inner) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= r && d >= (inner || 0)) f[y * W + x] = ink; } };
  poly(opts.mx, opts.my, opts.size, opts.rot);
  // distractors (never overlapping the marker)
  opts.d.forEach(d => { if (d.t === 'ring') disk(d.x, d.y, d.r, d.r - 2); else if (d.t === 'disk') disk(d.x, d.y, d.r); else if (d.t === 'text') for (let k = 0; k < 6; k++) poly(d.x + k * 7, d.y, 4, 0); else if (d.t === 'edge') for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (d.side === 'r' && x > W - d.w) f[y * W + x] = 55; if (d.side === 'b' && y > H - d.w) f[y * W + x] = 55; } });
  // blur (box, separable) then noise
  const r = opts.blur; if (r > 0) { const t = new Float64Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < W) { s += f[y * W + xx]; n++; } } t[y * W + x] = s / n; } for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < H) { s += t[yy * W + x]; n++; } } f[y * W + x] = s / n; } }
  const L = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) L[i] = Math.max(0, Math.min(255, f[i] + (rnd() + rnd() + rnd() - 1.5) * opts.noise));
  return L;
}
function rgbaCtx(L) { return { getImageData: (x, y, w, h) => { const d = new Uint8ClampedArray(w * h * 4); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = L[(y + j) * W + (x + i)], k = (j * w + i) * 4; d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255; } return { data: d }; } }; }
function trial(offFrac) {
  const size = rr(14, 30), ang = rnd() < .5 ? rr(-.4, .4) : rr(0, .1);
  const a = rnd() * 6.283, off = offFrac * BOX * rnd();
  const mx = W / 2 + Math.cos(a) * off, my = H / 2 + Math.sin(a) * off;
  const d = [];
  const place = (t, r) => { for (let k = 0; k < 20; k++) { const x = rr(15, W - 15), y = rr(15, H - 15); if (Math.hypot(x - mx, y - my) > size * 1.8 + r + 6) { d.push({ t, x, y, r }); return; } } };
  if (rnd() < .6) place('ring', 9); if (rnd() < .4) place('disk', 8); if (rnd() < .5) place('text', 0);
  if (rnd() < .4) { const side = rnd() < .5 ? 'r' : 'b', w = 25; if ((side === 'r' ? W - mx : H - my) > size + w + 8) d.push({ t: 'edge', side, w }); }
  const paper = rr(110, 235), o = { paper, ink: Math.min(rr(18, 70), paper * 0.42), // printed black ink stays well below half of the paper level
    shadow: rnd() < .5 ? rr(0, .35) : 0, sx: rr(0, W), sy: rr(0, H), size, rot: ang, mx, my, blur: Math.floor(rr(0, 3.4)), noise: rr(2, 12), d };
  return { L: frame(o), mx, my, off };
}
function run(label, offFrac, n) {
  let okN = 0, wrongN = 0, okO = 0, wrongO = 0;
  for (let i = 0; i < n; i++) {
    const t = trial(offFrac);
    const rn = detNew(t.L, W, H); if (rn) { Math.hypot(rn.x - t.mx, rn.y - t.my) <= 3 ? okN++ : wrongN++; }
    const crop = Math.round(BOX), cx = Math.round((W - crop) / 2); // old detector only sees the blue box
    const ro = detOld(rgbaCtx(t.L), { x: cx, y: cx, width: crop, height: crop }, W, H); if (ro) { Math.hypot(ro.x - t.mx, ro.y - t.my) <= 3 ? okO++ : wrongO++; }
  }
  const pct = v => (100 * v / n).toFixed(1) + '%';
  console.log(`    ${label}: NEW found ${pct(okN)} (wrong ${pct(wrongN)})   OLD found ${pct(okO)} (wrong ${pct(wrongO)})`);
  return { okN: okN / n, wrongN: wrongN / n, okO: okO / n };
}
let pass = 0; const T = (n, f) => { try { f(); pass++; console.log('  PASS ' + n); } catch (e) { console.log('  FAIL ' + n + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
T('marker inside the blue box (blur/noise/shadow/rotation/distractors)', () => { const r = run('aligned   ', 0.25, 400); assert.ok(r.okN >= 0.95, 'found ' + r.okN); assert.ok(r.wrongN <= 0.02, 'wrong ' + r.wrongN); assert.ok(r.okN >= r.okO); });
T('marker NOT exactly inside the box (up to ~0.5 box away)', () => { const r = run('misaligned', 0.5, 400); assert.ok(r.okN >= 0.9, 'found ' + r.okN); assert.ok(r.wrongN <= 0.03, 'wrong ' + r.wrongN); });
T('empty region -> nothing found (no phantom corners)', () => {
  let bad = 0; for (let i = 0; i < 200; i++) { const t = trial(0.2); const L = frame({ paper: rr(110, 235), ink: 30, shadow: rnd() < .5 ? .3 : 0, sx: 100, sy: 100, size: 1, rot: 0, mx: -50, my: -50, blur: 1, noise: 6, d: [{ t: 'ring', x: 60, y: 60, r: 9 }, { t: 'text', x: 150, y: 180, r: 0 }, { t: 'disk', x: 190, y: 70, r: 8 }] }); if (detNew(L, W, H)) bad++; }
  assert.ok(bad <= 2, 'phantoms ' + bad + '/200');
});
console.log(pass + ' passed');
