// Phase "scan quality": real-photo capture (_hqPhoto) — corner re-detection in the photo + safe fallback.
// Extracts the real functions from exam-manager.js and runs them against a synthetic sheet photo.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'exam-manager.js'), 'utf8');
function grab(name, async_) {
  const start = src.indexOf((async_ ? 'async ' : '') + 'function ' + name + '(');
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
const code = [grab('yn'), grab('aa'), grab('_hqPhoto', true)].join('\n');
// ---- synthetic photo: white page, 4 black registration squares, a header box line and far-away neighbour squares
function makePhoto(W, H, squares, extra) {
  const px = new Uint8ClampedArray(W * H * 4).fill(255);
  const fill = (x0, y0, w, h) => { for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) { const k = (y * W + x) * 4; px[k] = px[k + 1] = px[k + 2] = 0; px[k + 3] = 255; } };
  squares.forEach(([cx, cy, sz]) => fill(Math.round(cx - sz / 2), Math.round(cy - sz / 2), sz, sz));
  (extra || []).forEach((r) => fill(...r));
  return { width: W, height: H, px, close() {} };
}
function mkCanvas() { // fake canvas: nearest-neighbour drawImage + getImageData
  let tx = 0, ty = 0, rotA = 0; const c = { width: 0, height: 0, buf: null, getContext() { return { imageSmoothingQuality: '', translate(x, y) { tx = x; ty = y; }, rotate(a) { rotA = a > 0 ? 1 : -1; }, setTransform() { tx = ty = rotA = 0; }, drawImage(b, x, y, w, h) { const CW = c.width, CH = c.height; c.buf = new Uint8ClampedArray(CW * CH * 4).fill(255); for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) { let u, v; if (rotA === 0) { u = i; v = j; } else if (rotA === 1) { u = j; v = tx - i; } else { u = ty - j; v = i; } if (u < 0 || v < 0 || u >= w || v >= h) continue; const sx = Math.min(b.width - 1, Math.floor(u * b.width / w)), sy = Math.min(b.height - 1, Math.floor(v * b.height / h)); const a = (sy * b.width + sx) * 4, d = (j * CW + i) * 4; c.buf[d] = b.px[a]; c.buf[d + 1] = b.px[a + 1]; c.buf[d + 2] = b.px[a + 2]; c.buf[d + 3] = 255; } }, getImageData(x, y, w, h) { const out = new Uint8ClampedArray(w * h * 4); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const a = ((y + j) * c.width + (x + i)) * 4, d = (j * w + i) * 4; out[d] = c.buf[a]; out[d + 1] = c.buf[a + 1]; out[d + 2] = c.buf[a + 2]; out[d + 3] = 255; } return { data: out }; } }; } };
  return c;
}
function run(photo, o, n, r, opts = {}) {
  const ctx = { Se: false, te: { getVideoTracks: () => [{ readyState: 'live' }] }, console, setTimeout, Promise, Math,
    ImageCapture: function () { this.takePhoto = () => (opts.reject ? Promise.reject(new Error('x')) : Promise.resolve({})); },
    createImageBitmap: async () => photo, document: { createElement: () => mkCanvas() } };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  return vm.runInContext('_hqPhoto', ctx)(o, n, r);
}
let pass = 0; const t = async (name, fn) => { try { await fn(); pass++; console.log('  PASS ' + name); } catch (e) { console.log('  FAIL ' + name + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
(async () => {
  // photo 3000x4000 (3:4), video 1440x1920 (3:4). Markers (in photo px): sheet ~85% of width.
  const PW = 3000, PH = 4000, sz = 40, P = [[420, 700], [2580, 700], [420, 3300], [2580, 3300]];
  const noise = [[300, 400, 2400, 8], [1500, 700, 40, 40], [1500, 3300, 40, 40]];   // header line + neighbour squares far away
  const photo = makePhoto(PW, PH, P.map(([x, y]) => [x, y, sz]), noise);
  const toVideo = (p, dx = 0, dy = 0) => ({ x: p[0] * 1440 / PW + dx, y: p[1] * 1920 / PH + dy });
  await t('photo aligned with video: 4 corners re-found, canvas capped at 1700px, coordinates map onto the photo', async () => {
    const o = P.map((p) => toVideo(p, 3, -4));    // detection in video is a few px off (hand shake)
    const res = await run(photo, o, 1440, 1920); assert.ok(res, 'should accept the photo');
    assert.ok(res.canvas.width <= 1700 && res.canvas.width === Math.round(1700) && res.canvas.height === Math.round(4000 * 1700 / 3000));
    const k = res.canvas.width / PW; res.pts.forEach((q, i) => { assert.ok(Math.hypot(q.x - P[i][0] * k, q.y - P[i][1] * k) < 3, 'corner ' + i + ' off by ' + Math.hypot(q.x - P[i][0] * k, q.y - P[i][1] * k)); });
  });
  await t('sheet moved > 4% between video detection and photo -> null (falls back to video frame)', async () => {
    const o = P.map((p) => toVideo(p, 120, 0)); assert.strictEqual(await run(photo, o, 1440, 1920), null);
  });
  await t('photo with a different aspect ratio (FOV differs) -> null', async () => {
    const wide = makePhoto(4000, 3000, P.map(([x, y]) => [x, y, sz])); assert.strictEqual(await run(wide, P.map((p) => toVideo(p)), 1440, 1920), null);
  });
  await t('a marker missing in the photo -> null', async () => {
    const p3 = makePhoto(PW, PH, P.slice(0, 3).map(([x, y]) => [x, y, sz]), noise); assert.strictEqual(await run(p3, P.map((p) => toVideo(p)), 1440, 1920), null);
  });
  const rotate = (ph, cw) => { const W = ph.width, H = ph.height, out = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const nx = cw ? H - 1 - y : y, ny = cw ? x : W - 1 - x, a = (y * W + x) * 4, d = (ny * H + nx) * 4; out[d] = ph.px[a]; out[d + 1] = ph.px[a + 1]; out[d + 2] = ph.px[a + 2]; out[d + 3] = 255; } return { width: H, height: W, px: out, close() {} }; };
  for (const cw of [true, false]) await t('photo delivered rotated ' + (cw ? 'clockwise' : 'counter-clockwise') + ' (landscape, no EXIF) is auto-straightened and accepted', async () => {
    const res = await run(rotate(photo, cw), P.map((p) => toVideo(p, 2, 3)), 1440, 1920); assert.ok(res, 'rotated photo should still be usable');
    const k = res.canvas.width / PW; res.pts.forEach((q, i) => assert.ok(Math.hypot(q.x - P[i][0] * k, q.y - P[i][1] * k) < 4, 'corner ' + i));
  });
  await t('takePhoto rejects (unsupported/timeout) -> null, never throws', async () => { assert.strictEqual(await run(photo, P.map((p) => toVideo(p)), 1440, 1920, { reject: true }), null); });
  console.log('\n' + pass + ' passed');
})();
