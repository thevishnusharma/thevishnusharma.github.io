/* SnapBrand (v174) — har institute ko "apna app" jaisa look + storage limit.
   Owner Panel -> institute -> "🎨 Branding & Plan" me jo set hota hai (institutes/{id}: name, logoDataUrl, brandColor, tagline, plan,
   storageLimitMB) wahi us institute ke Admin aur Students ko dikhta hai:
     • header ka naam + logo, tagline, app ka rang (--blue / --navy), browser theme-color, tab title
     • install karne par (best-effort) institute ke naam/icon wala manifest
   Branding cache hoti hai (localStorage) taaki agli baar app khulte hi turant dikhe. Kabhi throw nahi karta; fail ho to purana look.
   Storage quota: Drive upload se pehle limit check (SnapQuota.check) aur upload/delete ke baad usage counter (storageUsedBytes) update.
   Kill-switch: SNAP_CONFIG.branding = false. */
(function () {
  "use strict";
  if (window.SnapBrand) return;
  var LAST = "snap_brand_last", PFX = "snap_brand_", TTL = 10 * 60 * 1000, cur = null, pending = {}, baseManifest = null;

  function on() { return !(window.SNAP_CONFIG && window.SNAP_CONFIG.branding === false); }
  function DB() { var v = window.vishnuFirebase; return v && v.enabled ? v.db : null; }
  function jget(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function okColor(c) { return /^#[0-9a-f]{6}$/i.test(c || ""); }
  function shade(hex, f) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; function k(x) { return Math.max(0, Math.min(255, Math.round(x * f))); } return "#" + [k(r), k(g), k(b)].map(function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }

  /* is device par abhi kaun sa institute? admin ho to uska, warna student ka (login ke baad) */
  function instId() {
    var id = null;
    try { if (window.SnapLock) id = window.SnapLock.id(); } catch (e) {}
    if (id) return id;
    try { if (typeof getCurrentAdminInstituteId === "function") id = getCurrentAdminInstituteId(); } catch (e) {}
    if (!id) { try { var s = typeof getStudentSession === "function" ? getStudentSession() : null; id = s && s.instituteId; } catch (e) {} }
    return id || null;
  }

  function apply(b) {
    if (!b) return;
    var q = function (s) { return document.querySelector(s); };
    if (okColor(b.brandColor)) {
      var r = document.documentElement.style;
      r.setProperty("--blue", b.brandColor); r.setProperty("--navy", shade(b.brandColor, 0.32)); r.setProperty("--navy2", shade(b.brandColor, 0.24)); r.setProperty("--navy-dark", shade(b.brandColor, 0.16));
      var tcm = q('meta[name="theme-color"]'); if (tcm) tcm.setAttribute("content", shade(b.brandColor, 0.32));
    }
    if (b.name) {
      var t = q(".site-title"); if (t) t.textContent = b.name;
      document.title = b.name + " — Online Tests & Classes";
    }
    var sub = q(".site-sub"); if (sub && b.name) sub.textContent = b.tagline || (on2() ? "" : "Powered by The Vishnu Sharma");
    if (b.logoDataUrl) { var li = q(".logo-img"); if (li) li.src = b.logoDataUrl; }
    applyManifest(b);
    try { deep(b); } catch (e) {}
    try { paintHeader(); } catch (e) {}
  }

  /* ---- v221 Phase 4A: gehri branding (login card, "Powered by" footer, result sheet/print/WhatsApp ke liye helper) ----
     Kill-switch: SNAP_CONFIG.branding2 = false -> sab purana. User ka diya text hamesha textContent / escH se jata hai. */
  function on2() { return on() && !(window.SNAP_CONFIG && window.SNAP_CONFIG.branding2 === false); }
  function okLogo(u) { return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(u || ""); }
  function escH(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function curB() { if (!on2() || !cur) return null; var x = jget(PFX + cur); return x && x.name ? x : null; }
  /* WhatsApp / plain text ke liye institute ka naam (markdown ke * _ ~ hata kar); institute na ho to fb */
  function plain(fb) { var x = curB(), n = x ? String(x.name).replace(/[*_~`\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) : ""; return n || fb || "The Vishnu Sharma"; }
  /* result sheet ka brand block: institute ho to uska (escaped), warna fb (purana hard-coded) */
  function rsf(key, fb) {
    var x = curB(); if (!x) return fb;
    if (key === "logo") return okLogo(x.logoDataUrl) ? x.logoDataUrl : fb;
    if (key === "name") return escH(x.name);
    if (key === "tag") return escH(x.tagline || "");
    return "";
  }
  /* print (booklet / 4-column) ke upar ek patli brand patti; "Powered by" usi me chhoti, taaki page layout na chhede */
  /* v233: "Powered by The Vishnu Sharma" tag -- institute ke generate kiye outputs (admit card, result sheet, paper print) par.
     Institute-wise chhupana: Owner Panel -> "Powered by chhupayein" (hidePoweredBy). Kill-switch: SNAP_CONFIG.brandMark=false */
  var MARK_TXT = "Powered by The Vishnu Sharma";
  function markOn() { if (window.SNAP_CONFIG && window.SNAP_CONFIG.brandMark === false) return false; var x = cur && jget(PFX + cur); return !(x && x.hidePoweredBy); }
  function markHtml(style) { return markOn() ? '<div class="snap-mark" style="' + (style || "text-align:center;font-size:10px;color:#6b7280;padding:4px 0;") + '">' + MARK_TXT + "</div>" : ""; }
  function printBar() {
    var x = curB(); if (!x) return on2() && markOn() ? '<div class="snap-mark" style="text-align:right;font-size:9px;color:#6b7280;padding:2px 8px;margin-bottom:4px;">' + MARK_TXT + "</div>" : "";
    var col = okColor(x.brandColor) ? x.brandColor : "#1f2937";
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;margin-bottom:6px;border-bottom:2px solid ' + col + ';-webkit-print-color-adjust:exact;print-color-adjust:exact;">' +
      (okLogo(x.logoDataUrl) ? '<img src="' + x.logoDataUrl + '" alt="" style="width:26px;height:26px;object-fit:contain;">' : "") +
      '<div style="font-weight:800;font-size:13px;color:' + col + ';flex:1;line-height:1.2;">' + escH(x.name) + (x.tagline ? ' <span style="font-weight:500;font-size:10px;color:#4b5563;">• ' + escH(x.tagline) + "</span>" : "") + "</div>" +
      (x.hidePoweredBy ? "" : '<div style="font-size:9px;color:#6b7280;white-space:nowrap;">Powered by The Vishnu Sharma</div>') + "</div>";
  }

  /* ---- v234: "mera apna app" — institute ka naam/logo har jagah, saath me chhota "Powered by The Vishnu Sharma" tag.
     Sab kuch localStorage ke cached branding se (naya Firestore read nahi, turant). Institute/branding na ho to purana look. ---- */
  function ident(fb) {
    fb = fb || {};
    var x = on() && cur ? jget(PFX + cur) : null;
    if (!(x && x.name)) return { brand: false, name: fb.name || "The Vishnu Sharma", logo: "", sub: fb.sub || "", powered: false };
    var p = markOn();
    return { brand: true, name: String(x.name), logo: okLogo(x.logoDataUrl) ? x.logoDataUrl : "", sub: p ? MARK_TXT : (x.tagline || ""), powered: p };
  }
  /* institute ka logo (img) ya logo na ho to naam ka pehla akshar (brand rang me); branding na ho to fbSrc (purana icon) */
  function logoHtml(sz, fbSrc) {
    var d = ident(), s = "width:" + sz + "px;height:" + sz + "px;border-radius:" + Math.round(sz * 0.26) + "px;flex:none;";
    if (d.brand && d.logo) return '<img src="' + d.logo + '" alt="" style="' + s + 'object-fit:contain;background:#fff;border:1px solid rgba(0,0,0,.08)">';
    if (d.brand) {
      var x = jget(PFX + cur) || {}, col = okColor(x.brandColor) ? x.brandColor : "#1d4ed8";
      return '<div style="' + s + "background:" + col + ';color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:' + Math.round(sz * 0.5) + 'px">' + escH(d.name.trim().charAt(0).toUpperCase()) + "</div>";
    }
    return '<img src="' + (fbSrc || "icon-512-maskable.png") + '" alt="" style="' + s + '">';
  }
  /* student header (#sn-top .lg): logo + institute naam + "Powered by The Vishnu Sharma". Key se idempotent — baar-baar chalne par DOM nahi chhedta */
  function paintHeader() {
    var lg = document.querySelector("#sn-top .lg"); if (!lg) return;
    var d = ident({ name: "The Vishnu Sharma", sub: "Smart Practice \u2022 Better Result" });
    var key = d.brand ? cur + "|" + d.name + "|" + d.sub + "|" + d.logo.length : "def";
    if (lg.getAttribute("data-bk") === key) return;
    lg.setAttribute("data-bk", key);
    lg.innerHTML = logoHtml(34) + "<div><b>" + escH(d.name) + "</b><small>" + escH(d.sub) + "</small></div>";
  }
  function deep(b) {
    var ok = on2() && b && b.name;
    /* "Powered by" footer (home ke neeche) — sirf jab institute ka naam ho aur Owner ne chhupaya na ho */
    var f = document.getElementById("snap-powered-by");
    if (!(ok && !b.hidePoweredBy)) { if (f) f.style.display = "none"; }
    else {
      if (!f) { f = document.createElement("div"); f.id = "snap-powered-by"; f.style.cssText = "text-align:center;font-size:.7rem;opacity:.65;padding:14px 10px 22px;"; f.textContent = "Powered by The Vishnu Sharma"; (document.getElementById("home-screen") || document.body).appendChild(f); }
      f.style.display = "";
    }
    /* login card ke upar institute ka logo + naam + tagline (student aur admin) */
    var sa = document.querySelector("#student-auth-screen .hero-card"), af = document.getElementById("admin-login-form"), ac = af && (af.closest(".card") || af.parentNode);
    [["snap-login-brand-s", sa], ["snap-login-brand-a", ac]].forEach(function (t) {
      var host = t[1]; if (!host) return;
      var el = document.getElementById(t[0]);
      if (!ok) { if (el) el.style.display = "none"; return; }
      var key = b.name + "|" + (b.tagline || "") + "|" + (okLogo(b.logoDataUrl) ? b.logoDataUrl.length : 0);
      if (el && el.getAttribute("data-k") === key) { el.style.display = "flex"; return; }
      if (!el) { el = document.createElement("div"); el.id = t[0]; host.insertBefore(el, host.firstChild); }
      el.setAttribute("data-k", key); el.textContent = ""; el.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:12px;";
      if (okLogo(b.logoDataUrl)) { var im = document.createElement("img"); im.src = b.logoDataUrl; im.alt = ""; im.style.cssText = "width:44px;height:44px;object-fit:contain;border-radius:10px;background:#fff;border:1px solid rgba(0,0,0,.08);flex:none;"; el.appendChild(im); }
      var d = document.createElement("div"), n = document.createElement("div"); n.textContent = b.name; n.style.cssText = "font-weight:800;font-size:1.02rem;line-height:1.2;"; d.appendChild(n);
      if (b.tagline) { var g = document.createElement("div"); g.textContent = b.tagline; g.style.cssText = "font-size:.78rem;opacity:.7;"; d.appendChild(g); }
      el.appendChild(d);
    });
  }

  /* install ka naam/icon: existing manifest ki copy, naam + icon badal kar (blob). Browser support par nirbhar — best effort */
  function applyManifest(b) {
    if (!b || !b.name) return;
    var go = function (m) {
      var man = JSON.parse(JSON.stringify(m)); man.name = b.name; man.short_name = String(b.name).slice(0, 12);
      man.start_url = location.origin + "/"; man.scope = location.origin + "/"; man.id = location.origin + "/";
      if (okColor(b.brandColor)) man.theme_color = shade(b.brandColor, 0.32);
      var fin = function (icons) {
        if (icons) man.icons = icons;
        else if (Array.isArray(man.icons)) man.icons = man.icons.map(function (i) { return Object.assign({}, i, { src: new URL(i.src, location.href).href }); });
        if (Array.isArray(man.shortcuts)) man.shortcuts = man.shortcuts.map(function (s) { var c = Object.assign({}, s); if (c.url) c.url = new URL(c.url, location.href).href; if (c.icons) c.icons = c.icons.map(function (i) { return Object.assign({}, i, { src: new URL(i.src, location.href).href }); }); return c; });
        try {
          var u = URL.createObjectURL(new Blob([JSON.stringify(man)], { type: "application/manifest+json" })), l = document.querySelector('link[rel="manifest"]');
          if (!l) { l = document.createElement("link"); l.rel = "manifest"; document.head.appendChild(l); }
          l.href = u;
        } catch (e) {}
      };
      if (!b.logoDataUrl) return fin(null);
      var im = new Image(); im.onload = function () {
        try {
          var out = [192, 512].map(function (sz) {
            var c = document.createElement("canvas"); c.width = c.height = sz; var g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, sz, sz);
            var p = sz * 0.12, w = sz - 2 * p, sc = Math.min(w / im.width, w / im.height), dw = im.width * sc, dh = im.height * sc;
            g.drawImage(im, (sz - dw) / 2, (sz - dh) / 2, dw, dh);
            return { src: c.toDataURL("image/png"), sizes: sz + "x" + sz, type: "image/png", purpose: "any" };
          });
          fin(out);
        } catch (e) { fin(null); }
      }; im.onerror = function () { fin(null); }; im.src = b.logoDataUrl;
    };
    if (baseManifest) return go(baseManifest);
    fetch("manifest.webmanifest").then(function (r) { return r.json(); }).then(function (m) { baseManifest = m; go(m); }).catch(function () {});
  }

  function pick(d) { var x = d || {}; return { active: x.active !== false, planExpiresAt: +x.planExpiresAt || 0, studentLimit: +x.studentLimit || 0, studentCount: +x.studentCount || 0, name: x.name || "", logoDataUrl: x.logoDataUrl || "", brandColor: x.brandColor || "", tagline: x.tagline || "", hidePoweredBy: x.hidePoweredBy === true, plan: x.plan || "", storageLimitMB: +x.storageLimitMB || 0, storageUsedBytes: +x.storageUsedBytes || 0, youtubeChannelUrl: x.youtubeChannelUrl || "", t: Date.now() }; }

  function load(id, force) {
    var c = jget(PFX + id);
    if (c && !force && Date.now() - (c.t || 0) < TTL) return Promise.resolve(c);
    var db = DB(); if (!db) return Promise.resolve(c);
    if (pending[id]) return pending[id];
    return (pending[id] = Promise.resolve(window.vishnuFirebase.authReady).catch(function () {}).then(function () {
      return db.collection("institutes").doc(id).get();
    }).then(function (d) { delete pending[id]; if (!d.exists) return c; var b = pick(d.data()); jset(PFX + id, b); return b; }, function () { delete pending[id]; return c; }));
  }

  function refresh() {
    if (!on()) return;
    var id = instId(); if (!id) return;
    if (id !== cur) { cur = id; try { localStorage.setItem(LAST, id); } catch (e) {} var c0 = jget(PFX + id); if (c0) apply(c0); }
    load(id).then(function (b) { if (b && id === cur) apply(b); });
  }

  /* ---- storage quota (Drive upload ke liye) ---- */
  function check(id, bytes) {
    if (!id || !DB()) return Promise.resolve({ ok: true });
    return load(id, true).then(function (b) {
      if (!b || !b.storageLimitMB) return { ok: true };
      var lim = b.storageLimitMB * 1048576, used = b.storageUsedBytes || 0;
      if (used + bytes > lim) return { ok: false, msg: "Storage limit poori (" + Math.round(used / 1048576) + " / " + b.storageLimitMB + " MB). Owner se plan badhwayein ya purani file delete karein." };
      return { ok: true };
    }, function () { return { ok: true }; });
  }
  function bump(id, bytes, files) {
    var db = DB(); if (!id || !db || !bytes) return Promise.resolve(false);
    var inc = firebase.firestore.FieldValue.increment;
    return db.collection("institutes").doc(id).update({ storageUsedBytes: inc(bytes), storageFiles: inc(files || 0) }).then(function () {
      var c = jget(PFX + id); if (c) { c.storageUsedBytes = Math.max(0, (c.storageUsedBytes || 0) + bytes); jset(PFX + id, c); } return true;
    }, function () { return false; });
  }

  window.SnapBrand = { refresh: refresh, load: load, cached: function (id) { return jget(PFX + id); } };
  window.SnapBrand.ident = ident; window.SnapBrand.logoHtml = logoHtml; window.SnapBrand.paintHeader = paintHeader; window.SnapBrand.esc = escH;
  window.SnapBrand.plain = plain; window.SnapBrand.rsf = rsf; window.SnapBrand.printBar = printBar; window.SnapBrand.mark = { on: markOn, text: MARK_TXT, html: markHtml };
  window.SnapQuota = { check: check, add: function (id, b) { return bump(id, b, 1); }, sub: function (id, b) { return bump(id, -Math.abs(b || 0), -1); } };

  /* splash (index-inline-05.js) ke liye kill-switch flag — wo script app-config se pehle chalti hai, isliye localStorage me */
  try { if (on2()) localStorage.removeItem("snap_brand2_off"); else localStorage.setItem("snap_brand2_off", "1"); } catch (e) {}

  /* shuru: pichla institute turant dikhao, phir login/session badalne par dobara */
  try { var l0 = localStorage.getItem(LAST), c1 = l0 && jget(PFX + l0); if (on() && c1) { cur = l0; apply(c1); } } catch (e) {}
  var n = 0, iv = setInterval(function () { refresh(); if (++n > 40) { clearInterval(iv); } }, 1500);
  setInterval(refresh, 30000);
  window.addEventListener("storage", refresh);
  window.addEventListener("focus", refresh);
  if (document.readyState !== "loading") refresh(); else document.addEventListener("DOMContentLoaded", refresh);
})();
