/* SnapPdf (v172) — app ke andar PDF viewer (pdf.js, repo me hi: vendor/pdfjs/ — Mozilla, Apache-2.0; koi bahari service nahi).
   - Badi PDF (31 MB, 100 MB...) bhi turant: sirf wahi pages mangwata hai jo screen par dikhte hain (HTTP Range).
   - Sirf pehli PDF kholne par pdf.js load hota hai (app ki start-up speed par asar nahi).
   - Page-by-page, screen ki chaudai ke hisaab se; − / + zoom; page number; ⬇ aur Open ↗ bhi. */
(function () {
  "use strict";
  if (window.SnapPdf) return;
  var VER = "3.11.174", loading = null;
  function abs(p) { return new URL(p, document.baseURI).href; }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function load() {
    if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = abs("vendor/pdfjs/pdf.worker.min.js?v=" + VER); return Promise.resolve(window.pdfjsLib); }
    if (loading) return loading;
    loading = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = abs("vendor/pdfjs/pdf.min.js?v=" + VER);
      s.onload = function () { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = abs("vendor/pdfjs/pdf.worker.min.js?v=" + VER); res(window.pdfjsLib); } catch (e) { loading = null; rej(e); } };
      s.onerror = function () { loading = null; rej(new Error("PDF viewer load nahi hua (internet?)")); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function open(title, url, o) {
    o = o || {};
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#1f2328;display:flex;flex-direction:column;font-family:inherit";
    var bs = "background:rgba(255,255,255,.14);color:#fff;border:0;border-radius:8px;padding:7px 11px;font-size:.95rem;font-weight:700;cursor:pointer";
    ov.innerHTML = '<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#111418;color:#fff;padding-top:max(8px,env(safe-area-inset-top))">' +
      '<b style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.95rem">' + esc(title || "PDF") + '</b>' +
      '<span data-pg style="font-size:.8rem;opacity:.8;white-space:nowrap"></span>' +
      '<button data-zo style="' + bs + '">\u2212</button><button data-zi style="' + bs + '">+</button>' +
      '<button data-d style="' + bs + '">\u2B07</button><button data-o style="' + bs + '">\u2197</button><button data-x style="' + bs + '">\u2715</button></div>' +
      '<div data-w style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y pinch-zoom;background:#3b3f45"><div data-m style="color:#fff;padding:30px;text-align:center">\u23F3 PDF khul rahi hai\u2026</div></div>';
    document.body.appendChild(ov);
    var wrap = ov.querySelector("[data-w]"), pgEl = ov.querySelector("[data-pg]"), msg = ov.querySelector("[data-m]");
    var pdf = null, task = null, pages = [], z = 1, ratio1 = 1.414, raf = 0, dead = false;
    function close() { dead = true; try { wrap.removeEventListener("scroll", sched); window.removeEventListener("resize", relayout); } catch (e) {} try { pdf && pdf.destroy(); task && task.destroy(); } catch (e) {} ov.remove(); }
    ov.querySelector("[data-x]").onclick = close;
    ov.querySelector("[data-o]").onclick = function () { window.open(url, "_blank", "noopener"); };
    ov.querySelector("[data-d]").onclick = function () { var a = document.createElement("a"); a.href = url; a.download = o.name || title || "file.pdf"; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); };
    function fail(e) {
      if (dead) return; var m = (e && e.message) || String(e);
      msg.innerHTML = "PDF yahan nahi khul payi (" + esc(m).slice(0, 120) + ").<br><br>Upar <b>\u2197</b> ya <b>\u2B07</b> se phone ke viewer me kholein.";
    }
    function cssW() { return Math.max(240, wrap.clientWidth) * z; }
    function place(st) { st.div.style.height = Math.round(cssW() * (st.ratio || ratio1)) + "px"; st.div.style.width = Math.round(cssW()) + "px"; }
    function relayout() { pages.forEach(function (st) { st.canvas.width = st.canvas.height = 0; st.done = false; place(st); }); sched(); }
    function renderPage(st) {
      if (st.busy || st.done || dead) return; st.busy = true;
      pdf.getPage(st.n).then(function (page) {
        if (dead) return;
        var v0 = page.getViewport({ scale: 1 }), w = cssW(), dpr = Math.min(window.devicePixelRatio || 1, 2), s = (w / v0.width) * dpr;
        if (v0.width * s * v0.height * s > 16e6) s = Math.sqrt(16e6 / (v0.width * v0.height));
        var vp = page.getViewport({ scale: s }); st.ratio = v0.height / v0.width;
        st.canvas.width = Math.floor(vp.width); st.canvas.height = Math.floor(vp.height);
        st.canvas.style.width = Math.round(w) + "px"; st.canvas.style.height = Math.round(w * st.ratio) + "px"; place(st);
        return page.render({ canvasContext: st.canvas.getContext("2d"), viewport: vp }).promise.then(function () { st.done = true; st.div.style.background = "#fff"; });
      }).catch(function () {}).then(function () { st.busy = false; });
    }
    function kick() {
      raf = 0; if (dead || !pages.length) return;
      var wr = wrap.getBoundingClientRect(), near = wr.height * 1.2, far = wr.height * 3, mid = wr.top + wr.height / 2, cur = 1;
      for (var i = 0; i < pages.length; i++) {
        var st = pages[i], r = st.div.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) cur = st.n;
        if (r.bottom > wr.top - near && r.top < wr.bottom + near) renderPage(st);
        else if ((r.bottom < wr.top - far || r.top > wr.bottom + far) && st.done) { st.canvas.width = st.canvas.height = 0; st.done = false; st.div.style.background = "#555"; }
      }
      pgEl.textContent = cur + " / " + pages.length;
    }
    function sched() { if (!raf) raf = requestAnimationFrame(kick); }
    function zoom(d) { var nz = Math.max(1, Math.min(3, Math.round((z + d) * 2) / 2)); if (nz === z) return; var f = wrap.scrollHeight ? wrap.scrollTop / wrap.scrollHeight : 0; z = nz; relayout(); wrap.scrollTop = f * wrap.scrollHeight; }
    ov.querySelector("[data-zi]").onclick = function () { zoom(0.5); };
    ov.querySelector("[data-zo]").onclick = function () { zoom(-0.5); };

    /* Sirf zaroorat ke tukde (HTTP Range) — poori file kabhi nahi mangwate. Size pata ho (o.size) to extra request bhi nahi. */
    function rfetch(b, e) {
      var tries = 0;
      function go() {
        return fetch(url, { headers: { Range: "bytes=" + b + "-" + (e - 1) } }).then(function (r) {
          if (r.status !== 206 && r.status !== 200) throw new Error("HTTP " + r.status);
          return r.arrayBuffer().then(function (ab) { return { buf: new Uint8Array(ab), full: r.status === 200 }; });
        }).catch(function (err) { if (++tries >= 3 || dead) throw err; return new Promise(function (ok) { setTimeout(ok, 700 * tries); }).then(go); });
      }
      return go();
    }
    function sizeOf() {
      if (o.size > 0) return Promise.resolve(o.size);
      return fetch(url, { headers: { Range: "bytes=0-0" } }).then(function (r) { var m = /\/(\d+)$/.exec(r.headers.get("content-range") || ""); if (m) return +m[1]; throw new Error("size pata nahi"); });
    }
    function openDoc(lib) {
      return sizeOf().then(function (len) {
        var first = Math.min(len, 1 << 20);
        return rfetch(0, first).then(function (init) {
          if (init.full || len <= first) { task = lib.getDocument({ data: init.buf }); return task.promise; }
          var tr = new lib.PDFDataRangeTransport(len, init.buf);
          tr.requestDataRange = function (b, e) { rfetch(b, Math.min(e, len)).then(function (r) { if (!dead) tr.onDataRange(b, r.buf); }).catch(fail); };
          task = lib.getDocument({ range: tr, length: len, disableAutoFetch: true, disableStream: true });
          return task.promise;
        });
      }, function () {   /* size pata nahi chala (server Range nahi deta) — pdf.js ka apna tareeka */
        task = lib.getDocument({ url: url, rangeChunkSize: 1 << 20, disableAutoFetch: true, withCredentials: false });
        return task.promise;
      });
    }
    load().then(function (lib) {
      if (dead) return;
      return openDoc(lib);
    }).then(function (p) {
      if (dead || !p) return; pdf = p;
      return p.getPage(1).then(function (pg1) {
        var v = pg1.getViewport({ scale: 1 }); ratio1 = v.height / v.width;
        wrap.innerHTML = ""; var box = document.createElement("div"); box.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 0"; wrap.appendChild(box);
        for (var n = 1; n <= p.numPages; n++) {
          var d = document.createElement("div"), c = document.createElement("canvas"); d.style.cssText = "background:#555;flex:none;overflow:hidden"; c.style.display = "block"; d.appendChild(c); box.appendChild(d);
          var st = { n: n, div: d, canvas: c, done: false, busy: false, ratio: 0 }; pages.push(st); place(st);
        }
        wrap.addEventListener("scroll", sched, { passive: true }); window.addEventListener("resize", relayout); sched();
      });
    }).catch(function (e) { fail(e); });
    return { close: close };
  }
  window.SnapPdf = { open: open };
})();
