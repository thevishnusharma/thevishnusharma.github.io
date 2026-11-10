// 45-square refit pass (_warp2): after the first 4-corner warp, all detected registration squares are used to re-fit the
// sheet->photo homography. Verifies on a synthetic perspective photo that (a) the maths recovers the true corners,
// (b) a badly-inferred 4th corner (the 3-corner case) gets corrected so ~all 45 squares line up, (c) it never makes things worse.
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
assert.ok(src.includes('const O={width:1203,height:1536},qe=[105,345,585,825,1065],Be=[195,345,495,645,795,945,1095,1245,1395]'), 'sheet constants changed');
assert.ok(src.includes('et={"top-left":{x:115,y:205},"top-right":{x:1075,y:205},"bottom-left":{x:115,y:1405},"bottom-right":{x:1075,y:1405}}'), 'corner constants changed');
const code = 'const O={width:1203,height:1536},qe=[105,345,585,825,1065],Be=[195,345,495,645,795,945,1095,1245,1395];\n' +
  ['yn', 'aa', 'sn', 'on', 'Ua', 'Ka', 'Jn', 'Wa', '_refitCorners', '_mo', '_warp2'].map(grab).join('\n');
function mkCanvas(w, h) {
  const c = { width: w || 0, height: h || 0, buf: null };
  c.getContext = () => ({
    getImageData: (x, y, ww, hh) => { const d = new Uint8ClampedArray(ww * hh * 4); for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) { const xs = x + i, ys = y + j, k = (j * ww + i) * 4; if (xs < c.width && ys < c.height) { const s = (ys * c.width + xs) * 4; d[k] = c.buf[s]; d[k + 1] = c.buf[s + 1]; d[k + 2] = c.buf[s + 2]; d[k + 3] = 255; } } return { data: d }; },
    createImageData: (ww, hh) => ({ data: new Uint8ClampedArray(ww * hh * 4) }),
    putImageData: (im) => { c.buf = im.data; }, drawImage() {},
  });
  return c;
}
const ctx = { Math, Float32Array, Float64Array, Int32Array, Uint8Array, Uint8ClampedArray, Array, isFinite, document: { createElement: () => mkCanvas() } };
vm.createContext(ctx); vm.runInContext(code, ctx);
const warp2 = ctx.__w = vm.runInContext('_warp2', ctx);
const refit = vm.runInContext('_refitCorners', ctx);
const mo = vm.runInContext('_mo', ctx), on = vm.runInContext('on', ctx);
// true homography sheet -> photo (tilted + slightly rotated, perspective)
const PW = 1800, PH = 2400;
const S = [{ x: 115, y: 205 }, { x: 1075, y: 205 }, { x: 115, y: 1405 }, { x: 1075, y: 1405 }];
const T = [{ x: 330, y: 420 }, { x: 1530, y: 380 }, { x: 250, y: 1960 }, { x: 1640, y: 2050 }]; // true corner positions in the photo
function homog(S, T) { // 4pt DLT via the app's own Ka
  return vm.runInContext('Ka', ctx)(S, T);
}
const H = homog(S, T), Hinv = (() => { const T2 = homog(T, S); return T2; })();
const proj = (h, x, y) => { const w = h[6] * x + h[7] * y + 1; return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w }; };
function makePhoto(noise) {
  const c = mkCanvas(PW, PH); c.buf = new Uint8ClampedArray(PW * PH * 4).fill(235);
  const size = 18;
  [105, 345, 585, 825, 1065].forEach(qx => [195, 345, 495, 645, 795, 945, 1095, 1245, 1395].forEach(by => {
    const cx = qx + 10, cy = by + 10; const pts = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => proj(H, cx + a * size / 2, cy + b * size / 2));
    const x0 = Math.floor(Math.min(...pts.map(p => p.x))) - 2, x1 = Math.ceil(Math.max(...pts.map(p => p.x))) + 2, y0 = Math.floor(Math.min(...pts.map(p => p.y))) - 2, y1 = Math.ceil(Math.max(...pts.map(p => p.y))) + 2;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const q = proj(Hinv, x, y); if (Math.abs(q.x - cx) <= size / 2 && Math.abs(q.y - cy) <= size / 2) { const k = (y * PW + x) * 4; c.buf[k] = c.buf[k + 1] = c.buf[k + 2] = 20; } }
  }));
  return c;
}
let pass = 0; const t = (n, f) => { try { f(); pass++; console.log('  PASS ' + n); } catch (e) { console.log('  FAIL ' + n + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
const photo = makePhoto();
const warpedCtx = (w) => w.canvas.getContext('2d');
const stats = (pts) => { const w = warp2({ canvas: photo, pts }, S); const r = on(warpedCtx(w), 1203, 1536); return { n: r.points.length, mo: mo(r) }; };
const jitter = (p, a) => ({ x: p.x + a[0], y: p.y + a[1] });
t('perfect corners: all 45 squares found', () => { const s = stats(T); console.log('    ', JSON.stringify(s)); assert.ok(s.n >= 44, 'n=' + s.n); });
t('3-corner case (4th corner inferred 22px/15px off) is corrected by the 45-square refit', () => {
  const bad = [T[0], T[1], T[2], jitter(T[3], [22, -15])];
  // without refit
  const plain = (() => { const w = vm.runInContext('Wa', ctx)(photo, bad, S, { width: 1203, height: 1536 }); const r = on(warpedCtx(w), 1203, 1536); return { n: r.points.length, mo: mo(r) }; })();
  const fixed = stats(bad);
  console.log('     plain', JSON.stringify(plain), ' refit', JSON.stringify(fixed));
  assert.ok(fixed.n >= 43, 'markers after refit n=' + fixed.n);
  assert.ok(fixed.mo < 1.0, 'mean offset ' + fixed.mo);
  assert.ok(fixed.n >= plain.n && fixed.mo <= plain.mo + 1e-9, 'refit must not be worse');
});
t('all corners slightly off (±4px) are tightened', () => {
  const bad = [jitter(T[0], [4, -3]), jitter(T[1], [-4, 3]), jitter(T[2], [3, 4]), jitter(T[3], [-3, -4])];
  const fixed = stats(bad); assert.ok(fixed.n >= 43 && fixed.mo < 0.8, JSON.stringify(fixed));
});
t('refit maths recovers true corners from noisy correspondences + outliers', () => {
  const cor = []; for (let i = 0; i < 45; i++) { const sx = 115 + (i % 5) * 240, sy = 205 + Math.floor(i / 5) * 150; const q = proj(H, sx, sy); cor.push({ sx, sy, x: q.x + (Math.random() - .5) * 1.2, y: q.y + (Math.random() - .5) * 1.2 }); }
  cor[3].x += 40; cor[17].y -= 55; // outliers
  const out = refit(cor, S); assert.ok(out);
  out.forEach((p, i) => assert.ok(Math.hypot(p.x - T[i].x, p.y - T[i].y) < 1.5, 'corner ' + i + ' err ' + Math.hypot(p.x - T[i].x, p.y - T[i].y)));
});
t('too few markers -> unchanged result (safe fallback)', () => { assert.strictEqual(refit([{ sx: 1, sy: 1, x: 1, y: 1 }], S), null); });
console.log(pass + ' passed');
