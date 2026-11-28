/* qr-lite.js — chhota QR-code generator (byte mode, ECC L/M/Q/H, version 1-10, auto mask). Koi network/library nahi chahiye.
   Use: SnapQR.svg("SA1.abc...", { ecc: "M", size: 320, margin: 2 })  -> SVG string
        SnapQR.matrix("text", "M") -> array of arrays (true = dark)
   Attendance QR token (~40 chars) version 3-4 me aata hai — projector par door se bhi scan hota hai. */
(function (root) {
  "use strict";
  var ECL = { L: 0, M: 1, Q: 2, H: 3 }, FMT = [1, 0, 3, 2];
  var EPB = { L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18], M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26], Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24], H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28] };
  var NBK = { L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4], M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5], Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8], H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8] };

  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataCodewords(v, e) { return Math.floor(rawModules(v) / 8) - EPB[e][v - 1] * NBK[e][v - 1]; }
  function utf8(s) { var o = [], b = unescape(encodeURIComponent(String(s))); for (var i = 0; i < b.length; i++) o.push(b.charCodeAt(i)); return o; }

  /* GF(256) Reed-Solomon */
  function gmul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; }
  function rsDiv(deg) {
    var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1);
    var root = 1;
    for (var k = 0; k < deg; k++) { for (var j = 0; j < r.length; j++) { r[j] = gmul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = gmul(root, 2); }
    return r;
  }
  function rsRem(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) { var f = b ^ r.shift(); r.push(0); div.forEach(function (c, i) { r[i] ^= gmul(c, f); }); });
    return r;
  }

  function encode(text, ecc) {
    var e = ecc || "M", bytes = utf8(text), v, cap;
    for (v = 1; v <= 10; v++) { var cc = v <= 9 ? 8 : 16; if (4 + cc + bytes.length * 8 <= dataCodewords(v, e) * 8) break; }
    if (v > 10) throw new Error("QR: text bahut lamba hai");
    var bits = [];
    function put(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, v <= 9 ? 8 : 16); bytes.forEach(function (b) { put(b, 8); });
    cap = dataCodewords(v, e) * 8;
    put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = []; for (var i = 0; i < bits.length; i += 8) { var x = 0; for (var j = 0; j < 8; j++) x = (x << 1) | bits[i + j]; data.push(x); }
    /* ECC + interleave */
    var nb = NBK[e][v - 1], el = EPB[e][v - 1], raw = Math.floor(rawModules(v) / 8), ns = nb - raw % nb, sl = Math.floor(raw / nb), div = rsDiv(el), blocks = [], k = 0;
    for (var b = 0; b < nb; b++) {
      var dl = sl - el + (b < ns ? 0 : 1), d = data.slice(k, k + dl); k += dl;
      var ec = rsRem(d, div); if (b < ns) d.push(0); blocks.push(d.concat(ec));
    }
    var out = [];
    for (var c = 0; c < blocks[0].length; c++) blocks.forEach(function (bl, bi) { if (c !== sl - el || bi >= ns) out.push(bl[c]); });
    return { v: v, e: e, words: out };
  }

  function build(text, ecc) {
    var enc = encode(text, ecc), v = enc.v, size = v * 4 + 17, m = [], fn = [];
    for (var y = 0; y < size; y++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function set(x, y, d) { if (x < 0 || y < 0 || x >= size || y >= size) return; m[y][x] = d; fn[y][x] = true; }
    for (var i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    function finder(cx, cy) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); } }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var al = []; if (v > 1) { var n = Math.floor(v / 7) + 2, step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2; al = [6]; for (var p = size - 7; al.length < n; p -= step) al.splice(1, 0, p); }
    al.forEach(function (ax, i1) { al.forEach(function (ay, i2) { if ((i1 === 0 && i2 === 0) || (i1 === 0 && i2 === al.length - 1) || (i1 === al.length - 1 && i2 === 0)) return; for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }); });
    function format(mask) {
      var d = (FMT[ECL[enc.e]] << 3) | mask, r = d; for (var i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var bitsF = ((d << 10) | r) ^ 0x5412;
      function g(i) { return ((bitsF >>> i) & 1) !== 0; }
      for (var i = 0; i <= 5; i++) set(8, i, g(i)); set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8));
      for (i = 9; i < 15; i++) set(14 - i, 8, g(i));
      for (i = 0; i < 8; i++) set(size - 1 - i, 8, g(i));
      for (i = 8; i < 15; i++) set(8, size - 15 + i, g(i));
      set(8, size - 8, true);
    }
    format(0);
    if (v >= 7) {
      var r2 = v; for (var q = 0; q < 12; q++) r2 = (r2 << 1) ^ ((r2 >>> 11) * 0x1F25);
      var vb = (v << 12) | r2;
      for (q = 0; q < 18; q++) { var bt = ((vb >>> q) & 1) !== 0, a = size - 11 + q % 3, bb = Math.floor(q / 3); set(a, bb, bt); set(bb, a, bt); }
    }
    /* data zigzag */
    var bi = 0, total = enc.words.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (var j = 0; j < 2; j++) {
        var x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
        if (!fn[y][x] && bi < total) { m[y][x] = ((enc.words[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
      }
    }
    var maskFn = [function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; }, function (x, y) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; }, function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; }, function (x, y) { return x * y % 2 + x * y % 3 === 0; }, function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; }, function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }];
    function apply(k) { for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!fn[y][x] && maskFn[k](x, y)) m[y][x] = !m[y][x]; }
    function penalty() {
      var s = 0, y, x, run, i;
      function line(get) { var runC = 0, last = null, hist = [0, 0, 0, 0, 0, 0, 0, 0]; for (var i = 0; i < size; i++) { var c = get(i); if (c === last) { runC++; if (runC === 5) s += 3; else if (runC > 5) s++; } else { last = c; runC = 1; } } }
      for (y = 0; y < size; y++) line(function (i) { return m[y][i]; });
      for (x = 0; x < size; x++) line(function (i) { return m[i][x]; });
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) { var c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) s += 3; }
      var pat = [1, 0, 1, 1, 1, 0, 1], dark = 0;
      function fp(get) { for (var i = 0; i + 6 < size; i++) { var ok = true; for (var j = 0; j < 7; j++) if ((get(i + j) ? 1 : 0) !== pat[j]) { ok = false; break; } if (ok) { var l = true, r = true; for (j = 1; j <= 4; j++) { if (i - j >= 0 && get(i - j)) l = false; if (i + 6 + j < size && get(i + 6 + j)) r = false; } if (l || r) s += 40; } } }
      for (y = 0; y < size; y++) fp(function (i) { return m[y][i]; });
      for (x = 0; x < size; x++) fp(function (i) { return m[i][x]; });
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (m[y][x]) dark++;
      s += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10 > 0 ? Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10 : 0;
      return s;
    }
    var best = 0, bp = 1e9;
    for (var k = 0; k < 8; k++) { apply(k); format(k); var pn = penalty(); if (pn < bp) { bp = pn; best = k; } apply(k); }
    apply(best); format(best);
    return m;
  }

  function svg(text, o) {
    o = o || {}; var m = build(text, o.ecc || "M"), n = m.length, mg = o.margin == null ? 2 : o.margin, d = "";
    for (var y = 0; y < n; y++) { var x = 0; while (x < n) { if (m[y][x]) { var s = x; while (x < n && m[y][x]) x++; d += "M" + (s + mg) + "," + (y + mg) + "h" + (x - s) + "v1h-" + (x - s) + "z"; } else x++; } }
    var t = n + mg * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + " " + t + '" width="' + (o.size || 320) + '" height="' + (o.size || 320) + '" shape-rendering="crispEdges" role="img" aria-label="Attendance QR"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#0b1220"/></svg>';
  }
  root.SnapQR = { svg: svg, matrix: build };
  if (typeof module !== "undefined" && module.exports) module.exports = root.SnapQR;
})(typeof window !== "undefined" ? window : globalThis);
