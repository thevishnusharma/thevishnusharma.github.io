/* v163 — Student Settings: Admin Settings jaisa professional look.
   Purane elements (ID Card + photo upload, notification toggle, theme, logout) COPY nahi hote — wahi original elements naye page me aate hain,
   isliye unke saare purane functions waise hi chalte hain. Page band hone par wo apni purani jagah wapas chale jaate hain. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function bi() { var S = window.SnapBrand; return S && S.ident ? S.ident({ name: "The Vishnu Sharma" }) : { brand: false, name: "The Vishnu Sharma", sub: "", powered: false }; }
  function bl(sz) { var S = window.SnapBrand; return S && S.logoHtml ? S.logoHtml(sz) : '<img src="icon-512-maskable.png" alt="" style="width:' + sz + 'px;height:' + sz + 'px">'; }
  var C = function () { return window.SNAP_CONFIG || {}; };
  var IC = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 8H4c0-1 2-2 2-8"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    chev: '<path d="M9 6l6 6-6 6"/>', back: '<path d="M15 6l-6 6 6 6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    build: '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>',
    hash: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
    pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M3 21v-5h5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>', dl: '<path d="M12 3v12M6 11l6 6 6-6M4 21h16"/>',
    alert: '<path d="M12 3l10 18H2zM12 10v5M12 18h.01"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.5-1 0-2 1.5-2H17a4 4 0 0 0 4-4c0-5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
    book: '<path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4zM4 16a4 4 0 0 1 4-4h10"/>',
    type: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5 4.2 4.2 0 0 1 17 18z"/>',
    idc: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17c.8-2 5.2-2 6 0M14 9h4M14 13h4"/>'
  };
  var ico = function (n) { return '<svg class="ssp-i" viewBox="0 0 24 24">' + (IC[n] || "") + "</svg>"; };
  var TILE = { pur: "linear-gradient(135deg,#c084fc,#7e22ce)", orc: "linear-gradient(135deg,#fb923c,#c2410c)", idg: "linear-gradient(135deg,#818cf8,#3730a3)", ind: "linear-gradient(135deg,#6366f1,#4338ca)", amb: "linear-gradient(135deg,#fbbf24,#ea580c)", tea: "linear-gradient(135deg,#2dd4bf,#0f766e)", blu: "linear-gradient(135deg,#60a5fa,#1d4ed8)", gry: "linear-gradient(135deg,#94a3b8,#475569)", pnk: "linear-gradient(135deg,#f472b6,#be185d)", red: "linear-gradient(135deg,#f87171,#b91c1c)" };
  var OPT_OUT = "savya_push_optout_v1";
  function txt(id) { var e = $(id); return e ? String(e.textContent || "").trim() : ""; }
  function initials(n) { var p = String(n || "S").trim().split(/\s+/); return ((p[0] || "S")[0] + (p[1] ? p[1][0] : "")).toUpperCase(); }
  function toast(m, ms) {
    try { var b = document.createElement("div"); b.textContent = m;
      b.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#1e1b4b;color:#fff;padding:11px 18px;border-radius:22px;font-size:.84rem;z-index:2147483647;max-width:90vw;text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.35);pointer-events:none";
      document.body.appendChild(b); setTimeout(function () { b.remove(); }, ms || 3500); } catch (e) {}
  }
  function css() {
    if ($("ssp-css")) return;
    var st = document.createElement("style"); st.id = "ssp-css";
    st.textContent =
      ".ssp-wrap{margin-bottom:14px}.ssp-i{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}" +
      ".ssp-hero{background:linear-gradient(135deg,#1e1b4b,#3730a3 60%,#4f46e5);border-radius:20px;padding:16px;color:#fff;display:flex;gap:14px;align-items:center;box-shadow:0 10px 22px rgba(49,46,129,.3);position:relative;overflow:hidden;margin-bottom:4px}" +
      ".ssp-hero:after{content:'';position:absolute;right:-30px;top:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.07)}" +
      ".ssp-av{width:60px;height:60px;border-radius:50%;border:3px solid #fbbf24;background:#fff;display:flex;align-items:center;justify-content:center;color:#312e81;font-weight:800;font-size:1.3rem;flex:none}" +
      ".ssp-hero b{font-size:1.05rem;display:block;position:relative}.ssp-hero small{font-size:.76rem;opacity:.85;display:block;margin-top:2px;position:relative}" +
      ".ssp-pill{display:inline-flex;align-items:center;gap:5px;font-size:.7rem;font-weight:700;padding:3px 9px;border-radius:99px;margin-top:7px;background:#dcfce7;color:#15803d;position:relative}.ssp-pill.r{background:#fee2e2;color:#b91c1c}.ssp-pill i{width:7px;height:7px;border-radius:50%;background:currentColor;display:block}" +
      ".ssp-sec{font-size:.68rem;font-weight:800;color:#94a3b8;letter-spacing:.09em;margin:16px 4px 7px}" +
      ".ssp-grp{background:#fff;border-radius:18px;box-shadow:0 2px 10px rgba(15,23,42,.07);overflow:hidden}" +
      ".ssp-row{display:flex;align-items:center;gap:13px;width:100%;background:#fff;border:0;border-bottom:1px solid #f1f5f9;border-radius:0;padding:12px 14px;margin:0;text-align:left;cursor:pointer;font:inherit;color:#0f172a}.ssp-row:last-child{border-bottom:0}" +
      ".ssp-row:active{background:#f8fafc}.ssp-ic{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex:none;color:#fff}" +
      ".ssp-tx{flex:1;min-width:0}.ssp-tx b{display:block;font-size:.93rem}.ssp-tx small{display:block;color:#64748b;font-size:.76rem;margin-top:2px}.ssp-ch{color:#cbd5e1;display:flex}.ssp-ch .ssp-i{width:18px;height:18px}" +
      ".ssp-logout{margin-top:16px;border:1px solid #fecaca!important;border-radius:16px!important}" +
      "#ssp-page{position:fixed;inset:0;z-index:99990;background:#f4f6fc;overflow:auto;display:none;-webkit-overflow-scrolling:touch}" +
      "#ssp-page .ssp-top{position:sticky;top:0;background:linear-gradient(135deg,#1e1b4b,#312e81);color:#fff;display:flex;align-items:center;gap:12px;padding:14px;z-index:2}" +
      "#ssp-page .ssp-top button{border:0;background:rgba(255,255,255,.15);color:#fff;border-radius:11px;width:38px;height:38px;cursor:pointer;display:flex;align-items:center;justify-content:center}" +
      "#ssp-page .ssp-top b{font-size:1.05rem;display:block}#ssp-page .ssp-top small{display:block;font-size:.7rem;opacity:.7;margin-top:1px}" +
      "#ssp-page .ssp-body{padding:14px;max-width:640px;margin:0 auto}.ssp-card{background:#fff;border-radius:18px;box-shadow:0 2px 10px rgba(15,23,42,.07);padding:15px;margin-bottom:12px}" +
      ".ssp-card p{margin:6px 0 0;color:#64748b;font-size:.84rem;line-height:1.5}.ssp-card h4{margin:0;font-size:.92rem;font-weight:800;display:flex;align-items:center;gap:8px}.ssp-ctr{text-align:center}" +
      ".ssp-kv{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #f1f5f9}.ssp-kv:last-child{border:0;padding-bottom:0}.ssp-kv.f{padding-top:10px}" +
      ".ssp-kvi{width:34px;height:34px;border-radius:10px;background:#eef2ff;color:#4338ca;display:flex;align-items:center;justify-content:center;flex:none}.ssp-kvi .ssp-i{width:17px;height:17px}" +
      ".ssp-kv>div>span:first-child{display:block;font-size:.72rem;color:#94a3b8;font-weight:600}.ssp-kv b{display:block;font-size:.88rem;margin-top:1px;word-break:break-all}" +
      ".ssp-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ssp-btn{flex:1;min-width:120px;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;border:0;border-radius:13px;padding:12px;font-weight:700;font-size:.9rem;cursor:pointer;background:linear-gradient(135deg,#f97316,#c2410c);color:#fff;box-shadow:0 6px 14px rgba(234,88,12,.3)}.ssp-btn .ssp-i{width:18px;height:18px}" +
      ".ssp-btn.g{background:linear-gradient(135deg,#22c55e,#15803d);box-shadow:0 6px 14px rgba(22,163,74,.28)}.ssp-btn.o{background:#eef2ff;color:#3730a3;box-shadow:none}.ssp-btn.r{background:#fee2e2;color:#b91c1c;box-shadow:none}" +
      ".ssp-ok{color:#15803d;font-weight:700}.ssp-bad{color:#b91c1c;font-weight:700}.ssp-h{font-weight:800;font-size:1.05rem;margin:2px 0 8px;color:var(--text,#0f172a)}" +
      ".ssp-bell{width:74px;height:74px;border-radius:50%;margin:4px auto 14px;background:linear-gradient(135deg,#fbbf24,#ea580c);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 0 0 8px #ffedd5,0 0 0 16px #fff7ed}.ssp-bell .ssp-i{width:34px;height:34px}" +
      ".ssp-stat{display:flex;align-items:center;justify-content:space-between;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:13px;padding:11px 13px;margin-top:12px;font-size:.85rem;font-weight:700}.ssp-stat .l{display:flex;align-items:center;gap:10px}.ssp-stat .ssp-pill{margin:0}" +
      ".ssp-ping{width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 5px rgba(34,197,94,.25)}.ssp-stat.bad{background:#fef2f2;border-color:#fecaca}.ssp-stat.bad .ssp-ping{background:#ef4444;box-shadow:0 0 0 5px rgba(239,68,68,.2)}.ssp-stat.wait{background:#f8fafc;border-color:#e2e8f0}.ssp-stat.wait .ssp-ping{background:#94a3b8;box-shadow:0 0 0 5px rgba(148,163,184,.2)}" +
      ".ssp-note{display:flex;gap:10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:13px;padding:11px 12px;margin-top:12px;font-size:.78rem;color:#9a3412;line-height:1.5}.ssp-note .ssp-i{width:18px;height:18px;margin-top:1px}" +
      ".ssp-ver{display:flex;align-items:center;gap:14px}.ssp-ver img{width:54px;height:54px;border-radius:15px}.ssp-sep{height:1px;background:#f1f5f9;margin:14px 0}" +
      ".ssp-line{display:flex;align-items:flex-start;gap:12px}.ssp-line .ssp-tx p{margin-top:3px}.ssp-mini{font-size:.76rem;font-weight:700;padding:9px 14px;border-radius:10px;white-space:nowrap;align-self:center;border:0;cursor:pointer;background:#eef2ff;color:#3730a3}.ssp-mini.g{background:#16a34a;color:#fff}" +
      ".ssp-tag{font-size:.66rem;font-weight:700;color:#64748b;background:#f1f5f9;padding:2px 8px;border-radius:6px;margin-top:6px;display:inline-block}" +
      ".ssp-big{width:62px;height:62px;border-radius:50%;margin:0 auto 8px;background:linear-gradient(135deg,#4ade80,#15803d);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 7px #dcfce7,0 0 0 14px #f0fdf4}.ssp-big.off{background:linear-gradient(135deg,#94a3b8,#475569);box-shadow:0 0 0 7px #f1f5f9,0 0 0 14px #f8fafc}.ssp-big .ssp-i{width:28px;height:28px}" +
      ".ssp-code{display:inline-block;background:#f1f5f9;border:1.5px dashed #94a3b8;border-radius:10px;padding:7px 16px;font-weight:800;letter-spacing:.18em;font-size:1rem;margin-top:6px;color:#1e1b4b}" +
      ".ssp-lbl{font-size:.68rem;font-weight:800;color:#c2410c;letter-spacing:.06em;margin:14px 0 6px}" +
      "body.dark-mode .ssp-row,body.dark-mode .ssp-card,body.dark-mode .ssp-grp,[data-theme=dark] .ssp-row,[data-theme=dark] .ssp-card,[data-theme=dark] .ssp-grp{background:#1e293b;color:#e2e8f0;border-color:#334155}" +
      "body.dark-mode .ssp-card p,[data-theme=dark] .ssp-card p{color:#94a3b8}body.dark-mode .ssp-kvi,[data-theme=dark] .ssp-kvi{background:#334155;color:#a5b4fc}body.dark-mode .ssp-btn.o,[data-theme=dark] .ssp-btn.o,body.dark-mode .ssp-mini,[data-theme=dark] .ssp-mini{background:#334155;color:#c7d2fe}" +
      "body.dark-mode #ssp-page,[data-theme=dark] #ssp-page{background:#0f172a;color:#e2e8f0}" +
      "#student-settings-card>*:not(#ssp-menu):not(h3.section-title){display:none!important}" +
      "#theme-picker-modal{z-index:2147483000!important}" +
      ".ssp-sw{position:relative;display:inline-block;width:46px;height:26px;flex:none}.ssp-sw input{opacity:0;width:0;height:0}.ssp-sw i{position:absolute;inset:0;background:#cbd5e1;border-radius:99px;transition:.2s}.ssp-sw i:after{content:'';position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s}.ssp-sw input:checked+i{background:#16a34a}.ssp-sw input:checked+i:after{transform:translateX(20px)}" +
      ".ssp-seg{display:flex;background:#eef2ff;border-radius:12px;padding:4px;gap:4px;margin-top:10px}.ssp-seg button{flex:1;border:0;background:transparent;padding:9px 0;border-radius:9px;font:700 .8rem inherit;color:#64748b;cursor:pointer}.ssp-seg button.on{background:#fff;color:#3730a3;box-shadow:0 2px 6px rgba(15,23,42,.12)}" +
      ".ssp-srow{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9}.ssp-srow:last-child{border:0;padding-bottom:0}.ssp-srow:first-of-type{padding-top:0}.ssp-srow .ssp-tx{flex:1}.ssp-tile{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none;color:#fff}" +
      "#ssp-page #push-notify-toggle-btn{display:flex;align-items:center;justify-content:center;width:100%;margin:14px 0 0;border:0;border-radius:13px;padding:12px;font-weight:700;font-size:.9rem;background:#eef2ff;color:#3730a3;cursor:pointer}" +
      "#ssp-page #push-notify-status{margin:10px 0 0;font-size:.78rem;color:#64748b;text-align:center}" +
      "#ssp-page #student-idcard-outer{margin:0}" +
      "body.dark-mode .ssp-seg,[data-theme=dark] .ssp-seg{background:#334155}body.dark-mode .ssp-seg button.on,[data-theme=dark] .ssp-seg button.on{background:#1e293b;color:#c7d2fe}";

    document.head.appendChild(st);
  }

  /* ---------- purane elements ko naye page me udhaar lena ---------- */
  var borrowed = [];
  function borrow(host) {
    String(host.getAttribute("data-borrow")).split(",").forEach(function (id) {
      var n = $(id); if (!n || n.parentNode === host) return;
      borrowed.push({ n: n, p: n.parentNode, nx: n.nextSibling }); host.appendChild(n);
    });
  }
  function giveBack() {
    while (borrowed.length) { var b = borrowed.pop(); try { if (b.nx && b.nx.parentNode === b.p) b.p.insertBefore(b.n, b.nx); else b.p.appendChild(b.n); } catch (e) {} }
    if (pnObs) { pnObs.disconnect(); pnObs = null; }
  }
  var pnObs = null;

  function row(ic, bg, t, sub, key, subId) { return '<button type="button" class="ssp-row" data-ssp="' + key + '"><span class="ssp-ic" style="background:' + TILE[bg] + '">' + ico(ic) + '</span><span class="ssp-tx"><b>' + t + "</b><small" + (subId ? ' id="' + subId + '"' : "") + ">" + sub + '</small></span><span class="ssp-ch">' + ico("chev") + "</span></button>"; }
  function kv(k, v, ic, first) { return '<div class="ssp-kv' + (first ? " f" : "") + '"><div class="ssp-kvi">' + ico(ic) + '</div><div style="flex:1;min-width:0"><span>' + k + "</span><b>" + v + "</b></div></div>"; }
  function pnOn() { try { return !localStorage.getItem(OPT_OUT); } catch (e) { return true; } }
  function syncSub() {
    var o = window.OfflineSync && OfflineSync.state || {}, n = o.pending || 0;
    if (o.offline) return n || o.unknown ? "Offline • " + (n || "") + " badlav online save hona baaki" : "Offline • saved data se chal raha hai";
    return n || o.unknown ? "Online save ho rahe hain…" : "Sab online save hai";
  }
  function apkState() { var u = window.SnapAppUpdate; return u && u.state && u.state.available ? u.state : null; }
  function apkCard() {
    var st = apkState(); if (!st) return "";
    return '<div class="ssp-card" style="border:1.5px solid #fdba74;background:linear-gradient(135deg,#fff7ed,#fff)"><div class="ssp-line"><div class="ssp-ic" style="background:' + TILE.amb + '">' + ico("dl") + '</div><div class="ssp-tx"><b>Naya APK aaya hai' + (st.name ? " (" + esc(st.name) + ")" : "") + '</b><p>' + esc(st.notes || "App ka naya version taiyaar hai.") + '</p></div></div><div class="ssp-act"><button type="button" class="ssp-btn" data-sgo="apkdl">' + ico("dl") + ' Download &amp; Update karein</button></div></div>';
  }

  var pages = {
    about: function (done) {
      var c = C();
      var B = bi(); done("About App", esc(c.version || "1.0"), '<div class="ssp-card"><h4>' + ico("info") + ' ' + esc(B.name) + '</h4><p>Practice tests, exam results aur institute features ek jagah.</p>' + (B.powered ? '<p style="font-size:.78rem;color:#64748b">' + esc(B.sub) + '</p>' : '') + '<div class="ssp-act"><a class="ssp-btn o" href="' + esc(c.privacyUrl || "/privacy.html") + '" target="_blank" rel="noopener">Privacy Policy</a><a class="ssp-btn o" href="' + esc(c.termsUrl || "/terms.html") + '" target="_blank" rel="noopener">Terms &amp; Conditions</a></div><p><a href="/delete-account.html">Account/data delete karne ki jankari</a></p></div>');
    },
    delete: function (done) {
      var s = typeof window.getStudentSession === "function" ? window.getStudentSession() : null, mobile = s && s.mobile ? String(s.mobile) : "";
      done("Delete Account & Data", "Permanent deletion request", mobile ? '<form id="ssp-delete-form"><div class="ssp-card"><p>Account, profile/photo, test results, scan reports, mistakes, login sessions aur batch enrollments permanent delete honge.</p><label for="ssp-delete-mobile">Account mobile number</label><input id="ssp-delete-mobile" type="tel" value="' + esc(mobile) + '" readonly><label for="ssp-delete-confirm">Confirm ke liye wahi 10-digit mobile dobara likhein</label><input id="ssp-delete-confirm" type="tel" inputmode="numeric" maxlength="10" autocomplete="off" required><label for="ssp-delete-password">Account password</label><input id="ssp-delete-password" type="password" autocomplete="current-password" required><p class="ssp-note">Deletion undo nahi hoti. Network issue ho to retry karein; partial request safe tareeke se dobara chal sakti hai.</p><button class="ssp-btn danger" type="submit">Account aur data permanently delete karein</button></div></form>' : '<div class="ssp-card"><p>Account delete karne ke liye pehle student ke roop mein login karein.</p><a href="/delete-account.html">Deletion ke steps</a></div>');
    },
    privacy: function (done) {
      var c = C();
      done("Privacy & Legal", "Data use and account controls", '<div class="ssp-card"><p>Aapka account data kaise use hota hai aur use delete karne ke liye:</p><div class="ssp-act"><a class="ssp-btn o" href="' + esc(c.privacyUrl || "/privacy.html") + '" target="_blank" rel="noopener">Privacy Policy</a><a class="ssp-btn o" href="' + esc(c.termsUrl || "/terms.html") + '" target="_blank" rel="noopener">Terms</a><a class="ssp-btn o" href="/delete-account.html">Delete account help</a></div></div>');
    },
    profile: function (done) {
      var nm = txt("student-dp-name") || txt("student-welcome-name") || "—";
      done("Profile & ID Card", "Aapki details",
        '<div class="ssp-card" style="padding:13px"><h4>' + ico("idc") + ' Aapka ID Card</h4><p style="margin:5px 0 11px">Photo par tap karke apni photo lagayein ya badlein. Photo admin ko bhi turant dikhegi.</p><div data-borrow="student-idcard-outer"></div></div>' +
        '<div class="ssp-card"><h4>' + ico("user") + ' Meri Details</h4><div style="height:10px"></div>' +
        kv("Naam", esc(nm), "user", 1) + kv("ID Number", esc(txt("idcard-id-number") || "—"), "hash") + kv("Class", esc(txt("idcard-class") || "—"), "book") + kv("Academic Session", esc(txt("idcard-session") || "—"), "clock") + "</div>");
    },
    notif: function (done) {
      var on = pnOn();
      done("Notifications", "Naye test aur updates ke alert",
        '<div class="ssp-card ssp-ctr" style="padding:20px 15px"><div class="ssp-bell">' + ico("bell") + '</div><div id="ssp-pn-t" style="font-size:1rem;font-weight:800;margin-top:14px">' + (on ? "Notifications ON hain" : "Notifications OFF hain") + '</div><p>Naya test, result ya app update aate hi aapke phone par alert aayega — app band ho tab bhi.</p><span class="ssp-pill' + (on ? "" : " r") + '" id="ssp-pn-p"><i></i>' + (on ? "Chalu hai" : "Band hai") + '</span><div data-borrow="push-notify-toggle-btn,push-notify-status"></div></div>' +
        '<div class="ssp-card"><h4>' + ico("info") + ' Aapko kya milega</h4><div style="height:10px"></div>' + kv("Naya test", "Publish hote hi", "book", 1) + kv("Exam result", "Result publish hote hi", "pulse") + kv("App update", "Naya version aane par", "dl") + "</div>" +
        '<div class="ssp-note">' + ico("alert") + '<div>Alert na aaye to phone Settings → Apps → The Vishnu Sharma → Notifications → Allow karein.</div></div>');
    },
    display: function (done) {
      var ts = localStorage.getItem("sn_textsize") || "100", wakeOK = !!navigator.wakeLock, wake = localStorage.getItem("sn_wake") === "1";
      done("Display & Exam", "Text size aur exam setting",
        '<div class="ssp-card"><h4>' + ico("palette") + ' Appearance</h4><div style="height:10px"></div>' +
        '<div style="padding-top:12px"><div style="display:flex;align-items:center;gap:12px"><div class="ssp-tile" style="background:' + TILE.tea + '">' + ico("type") + '</div><div class="ssp-tx"><b style="font-size:.9rem;display:block">Text size</b><small style="color:#64748b;font-size:.76rem">Padhne mein aasani ke liye</small></div></div><div class="ssp-seg" id="ssp-ts">' +
        [["90", "Chhota"], ["100", "Normal"], ["112", "Bada"]].map(function (x) { return '<button type="button" data-sts="' + x[0] + '"' + (x[0] === ts ? ' class="on"' : "") + ">" + x[1] + "</button>"; }).join("") + "</div></div></div>" +
        (wakeOK ? '<div class="ssp-card"><h4>' + ico("book") + ' Exam</h4><div style="height:10px"></div><div class="ssp-srow"><div class="ssp-tx"><b style="font-size:.9rem;display:block">Exam ke dauran screen on rakhein</b><small style="color:#64748b;font-size:.76rem">Test dete waqt screen apne aap band nahi hogi</small></div><label class="ssp-sw"><input type="checkbox" id="ssp-wake"' + (wake ? " checked" : "") + "><i></i></label></div></div>" : ""));
    },
    data: function (done) {
      var c = C();
      done("App & Data", "Update, cache aur offline sync",
        apkCard() +
        '<div class="ssp-card"><div class="ssp-ver">' + bl(52) + '<div><b style="font-size:1rem">' + esc(bi().name) + '</b><div style="font-size:.76rem;color:#64748b;margin-top:2px">' + esc(bi().brand ? bi().sub : (c.tagline || "")) + '</div><span class="ssp-pill"><i></i>Version ' + esc((c.version || "1.0") + (c.build ? " (" + c.build + ")" : "")) + "</span></div></div></div>" +
        '<div class="ssp-card"><div class="ssp-line"><div class="ssp-ic" style="background:' + TILE.ind + '">' + ico("dl") + '</div><div class="ssp-tx"><b>Update check</b><p>Naya version / APK aaya hai ya nahi dekhein.</p></div></div><div class="ssp-act"><button type="button" class="ssp-btn" data-sgo="update">' + ico("refresh") + ' Update check karein</button></div>' +
        '<div class="ssp-sep"></div><div class="ssp-line"><div class="ssp-ic" style="background:' + TILE.tea + '">' + ico("trash") + '</div><div class="ssp-tx"><b>Cache saaf karke refresh</b><p>Kuch purana ya adhura dikhe to ye karein. Aapka login bana rahega.</p></div></div><div class="ssp-act"><button type="button" class="ssp-btn o" data-sgo="cache">' + ico("trash") + ' Cache saaf karein</button></div></div>' +
        '<div class="ssp-card"><h4>' + ico("cloud") + ' Offline &amp; Sync</h4><div class="ssp-stat wait" id="ssp-sync-box"><div class="l"><span class="ssp-ping"></span>Data status</div><span class="ssp-pill" id="ssp-sync-pill" style="margin:0"><i></i><span id="ssp-sync-txt">…</span></span></div>' +
        '<p style="margin-top:10px">Internet na ho tab bhi app saved data se chalegi. Offline kiye badlav internet aate hi apne aap online save ho jaayenge.</p><div class="ssp-act"><button type="button" class="ssp-btn o" data-sgo="sync">' + ico("refresh") + " Abhi sync karein</button></div></div>");
      paintSync();
    }
  };
  function paintSync() {
    var b = $("ssp-sync-box"), p = $("ssp-sync-pill"), t = $("ssp-sync-txt"); if (!b || !p || !t) return;
    var o = window.OfflineSync && OfflineSync.state || {}, n = o.pending || 0, has = n || o.unknown;
    b.className = "ssp-stat" + (o.offline || has ? " bad" : ""); p.className = "ssp-pill" + (o.offline || has ? " r" : "");
    t.textContent = o.offline ? "Offline" + (has ? " • " + (n || "") + " baaki" : "") : has ? (n || "") + " baaki — online save ho rahe hain" : "Sab online save hai";
    var sub = $("ssp-data-sub"); if (sub) sub.textContent = syncSub();
  }

  function openPage(key) {
    var f = pages[key]; if (!f) return;
    giveBack();
    var pg = $("ssp-page");
    if (!pg) { pg = document.createElement("div"); pg.id = "ssp-page"; document.body.appendChild(pg); }
    pg.style.display = "block"; pg.innerHTML = '<div class="ssp-top"><button type="button" data-sgo="back">' + ico("back") + '</button><div><b>…</b><small></small></div></div><div class="ssp-body"></div>';
    f(function (title, sub, html) {
      if (pg.style.display === "none") return;
      pg.querySelector(".ssp-top b").textContent = title; pg.querySelector(".ssp-top small").textContent = sub || ""; pg.querySelector(".ssp-body").innerHTML = html;
      Array.prototype.forEach.call(pg.querySelectorAll("[data-borrow]"), borrow);
      if (key === "notif" && window.MutationObserver) { var bt = $("push-notify-toggle-btn"); if (bt) { pnObs = new MutationObserver(function () { var on = pnOn(), t = $("ssp-pn-t"), p = $("ssp-pn-p"); if (t) t.textContent = on ? "Notifications ON hain" : "Notifications OFF hain"; if (p) { p.className = "ssp-pill" + (on ? "" : " r"); p.innerHTML = "<i></i>" + (on ? "Chalu hai" : "Band hai"); } var s = $("ssp-pn-sub"); if (s) s.textContent = "Naye test ka alert • " + (on ? "ON" : "OFF"); }); pnObs.observe(bt, { childList: true, characterData: true, subtree: true }); } }
    });
  }
  function closePage() { var pg = $("ssp-page"); if (pg) pg.style.display = "none"; giveBack(); }
  window.SnapStudentSettings = { close: closePage, open: openPage };

  function webCheck() {
    if (!navigator.serviceWorker) return toast("Is device par update check available nahi hai.");
    navigator.serviceWorker.getRegistration().then(function (r) {
      if (!r) return toast("✅ Aap latest version par hain");
      return r.update().then(function () {
        if (r.installing || r.waiting) { toast("⬆️ Naya version mil gaya — reload ho raha hai"); setTimeout(function () { location.reload(); }, 1200); }
        else toast("✅ Aap latest version par hain");
      });
    }).catch(function () { toast("Update check nahi ho paya — internet check karein."); });
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest ? ev.target.closest("[data-ssp],[data-sgo],[data-sts]") : null; if (!t) return;
    var k = t.getAttribute("data-ssp"), g = t.getAttribute("data-sgo"), sz = t.getAttribute("data-sts");
    if (sz) { try { localStorage.setItem("sn_textsize", sz); } catch (e) {} document.documentElement.style.fontSize = sz + "%"; Array.prototype.forEach.call(document.querySelectorAll("#ssp-ts button"), function (x) { x.classList.toggle("on", x === t); }); return; }
    if (k) {
      ev.preventDefault();
      if (k === "about") { openPage("about"); return; }
      if (k === "help") { if (typeof window.snShowPage === "function") window.snShowPage(k, "settings"); else toast("Page available nahi"); return; }
      openPage(k); return;
    }
    if (g === "back") { ev.preventDefault(); closePage(); }
    else if (g === "sync") { if (window.OfflineSync) OfflineSync.syncNow(); else toast("Sync available nahi"); }
    else if (g === "apkdl") { if (window.SnapAppUpdate) SnapAppUpdate.show(); }
    else if (g === "update") {
      toast("⏳ Update check ho raha hai...");
      if (window.SnapAppUpdate && SnapAppUpdate.check) SnapAppUpdate.check({ manual: true }).then(function (st) { if (st && st.available) toast("📲 Naya APK mila — download karein", 5000); else webCheck(); }, webCheck); else webCheck();
    }
    else if (g === "cache") {
      if (!confirm("Cache saaf karke app refresh karein? Aapka login bana rahega.")) return;
      toast("⏳ Saaf ho raha hai...");
      (window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (x) { return caches.delete(x); })); }) : Promise.resolve()).then(function () { location.reload(); }, function () { location.reload(); });
    }
  });
  document.addEventListener("submit", function (ev) {
    var f = ev.target; if (!f || f.id !== "ssp-delete-form") return;
    ev.preventDefault();
    var s = typeof window.getStudentSession === "function" ? window.getStudentSession() : null;
    var mobile = String(s && s.mobile || ""), typed = String($("ssp-delete-confirm") && $("ssp-delete-confirm").value || "").replace(/\D/g, ""), password = String($("ssp-delete-password") && $("ssp-delete-password").value || "");
    if (!/^\d{10}$/.test(mobile) || typed !== mobile || !password) { toast("Mobile number aur password dobara check karein."); return; }
    if (!confirm("Aapka account aur linked data permanently delete hoga. Ye undo nahi ho sakta. Kya aap continue karna chahte hain?")) return;
    var b = f.querySelector('button[type="submit"]'); if (b) { b.disabled = true; b.textContent = "⏳ Account aur data delete ho raha hai..."; }
    Promise.resolve().then(function () {
      if (!window.SnapAuth || !SnapAuth.deleteMyAccount) throw new Error("Secure deletion service load nahi hua.");
      return SnapAuth.deleteMyAccount(mobile, typed, password);
    }).then(function () {
      try {
        var saved = JSON.parse(localStorage.getItem("savya_records") || "[]");
        if (Array.isArray(saved)) localStorage.setItem("savya_records", JSON.stringify(saved.filter(function (r) { return String(r.mobile || "").replace(/\D/g, "").slice(-10) !== mobile; })));
      } catch (e) {}
      [localStorage, sessionStorage].forEach(function (store) { try { for (var i = store.length - 1; i >= 0; i--) { var key = store.key(i); if (key && key.indexOf(mobile) >= 0) store.removeItem(key); } } catch (e) {} });
      try { if (typeof window.clearStudentSession === "function") window.clearStudentSession(); } catch (e) {}
      alert("✅ Aapka account aur linked data delete ho gaya hai.");
      location.reload();
    }).catch(function (e) {
      toast("Delete nahi hua: " + (e && e.message || e), 5000);
      if (b) { b.disabled = false; b.textContent = "Account aur data permanently delete karein"; }
    });
  });
  document.addEventListener("change", function (ev) { if (ev.target && ev.target.id === "ssp-wake") { try { localStorage.setItem("sn_wake", ev.target.checked ? "1" : "0"); } catch (e) {} } });

  /* ---------- Menu ---------- */
  function heroInfo() {
    var nm = txt("student-welcome-name") || txt("student-dp-name") || "Student", cl = txt("idcard-class"), inst = txt("idcard-inst-name");
    var sb = $("student-streak-badge"), streak = sb && sb.style.display !== "none" ? String(sb.textContent || "").trim() : "";
    return { nm: nm, sub: [cl && cl !== "-" ? "Class " + cl : "", inst && inst !== "Loading..." ? inst : ""].filter(Boolean).join(" • ") || "Student", streak: streak };
  }
  function paintHero() {
    var h = heroInfo(), a = $("ssp-hero-av"), n = $("ssp-hero-nm"), s = $("ssp-hero-sub"), st = $("ssp-hero-st");
    if (!a) return;
    a.textContent = initials(h.nm); n.textContent = h.nm; s.textContent = h.sub;
    st.style.display = h.streak ? "" : "none"; st.innerHTML = "<i></i>" + esc(h.streak);
    var ps = $("ssp-pn-sub"); if (ps) ps.textContent = "Naye test ka alert • " + (pnOn() ? "ON" : "OFF");
    var ds = $("ssp-data-sub"); if (ds) ds.textContent = syncSub();
  }
  function mount() {
    var card = $("student-settings-card"); if (!card || $("ssp-menu")) return;
    css();
    var m = document.createElement("div"); m.id = "ssp-menu"; m.className = "ssp-wrap";
    m.innerHTML = '<div class="ssp-hero"><div class="ssp-av" id="ssp-hero-av">S</div><div style="position:relative;min-width:0"><b id="ssp-hero-nm">Student</b><small id="ssp-hero-sub">Student</small><span class="ssp-pill" id="ssp-hero-st" style="background:#ffedd5;color:#c2410c;display:none"><i></i></span></div></div>' +
      '<div class="ssp-sec">ACCOUNT</div><div class="ssp-grp">' + row("user", "ind", "Profile & ID Card", "ID Card, photo, class, session", "profile") + "</div>" +
      '<div class="ssp-sec">PREFERENCES</div><div class="ssp-grp">' + row("bell", "amb", "Notifications", "Naye test ka alert • " + (pnOn() ? "ON" : "OFF"), "notif", "ssp-pn-sub") + row("palette", "pur", "Display & Exam", "Text size, screen on", "display") + "</div>" +
      '<div class="ssp-sec">DATA</div><div class="ssp-grp">' + row("phone", "idg", "App & Data", syncSub(), "data", "ssp-data-sub") + row("shield", "blu", "Privacy & Legal", "Privacy Policy aur Terms", "privacy") + row("trash", "red", "Delete Account & Data", "Account aur linked data permanently delete karein", "delete") + "</div>" +
      '<div class="ssp-sec">SUPPORT</div><div class="ssp-grp">' + row("help", "blu", "Help & Support", "Call / WhatsApp / Email, FAQ", "help") + row("info", "gry", "About App", "Version " + esc((C().version || "1.0") + (C().build ? " (build " + C().build + ")" : "")), "about") + "</div>" +
      '<button type="button" class="ssp-row ssp-logout" id="ssp-logout"><span class="ssp-ic" style="background:' + TILE.red + '">' + ico("out") + '</span><span class="ssp-tx"><b style="color:#b91c1c">Logout</b><small>Is device se logout karein</small></span></button>';
    var h3 = card.querySelector("h3.section-title"); if (h3) h3.after(m); else card.insertBefore(m, card.firstChild);
    $("ssp-logout").addEventListener("click", function () { var b = $("student-logout-btn"); b ? b.click() : toast("Logout button nahi mila"); });
    paintHero();
    if (window.MutationObserver) {
      var mo = new MutationObserver(function () { paintHero(); });
      ["student-welcome-name", "student-dp-name", "idcard-class", "idcard-inst-name", "student-streak-badge"].forEach(function (id) { var e = $(id); e && mo.observe(e, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["style"] }); });
    }
    var n = 0, iv = setInterval(function () { paintHero(); if (++n > 20) clearInterval(iv); }, 1000);
    window.addEventListener("snap-sync-state", function () { paintSync(); var ds = $("ssp-data-sub"); if (ds) ds.textContent = syncSub(); });
    window.addEventListener("snap-apk-update", function () { var ds = $("ssp-data-sub"); if (ds) ds.textContent = apkState() ? "Naya APK aaya hai — update karein" : syncSub(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  setTimeout(mount, 1500);
})();
