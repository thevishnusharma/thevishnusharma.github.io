/* Admin Settings (proper app jaisa): Profile, Notifications, Help & Support, About, App & Data, Privacy, Logout.
   Purane Settings cards (ID Card, Join Code, Password...) jaise the waise rehte hain — ye unke UPAR judta hai. */
(function () {
  "use strict";
  var C = function () { return window.SNAP_CONFIG || {}; };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function bi() { var S = window.SnapBrand; return S && S.ident ? S.ident({ name: "The Vishnu Sharma" }) : { brand: false, name: "The Vishnu Sharma", sub: "", powered: false }; }
  function bl(sz) { var S = window.SnapBrand; return S && S.logoHtml ? S.logoHtml(sz) : '<img src="icon-512-maskable.png" alt="" style="width:' + sz + 'px;height:' + sz + 'px">'; }
  var digits = function (s) { return String(s || "").replace(/\D/g, "").slice(-10); };

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
    idc: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17c.8-2 5.2-2 6 0M14 9h4M14 13h4"/>'
  };
  var ico = function (n) { return '<svg class="asp-i" viewBox="0 0 24 24">' + (IC[n] || "") + "</svg>"; };
  var TILE = { pur: "linear-gradient(135deg,#c084fc,#7e22ce)", orc: "linear-gradient(135deg,#fb923c,#c2410c)", idg: "linear-gradient(135deg,#818cf8,#3730a3)", ind: "linear-gradient(135deg,#6366f1,#4338ca)", amb: "linear-gradient(135deg,#fbbf24,#ea580c)", tea: "linear-gradient(135deg,#2dd4bf,#0f766e)", blu: "linear-gradient(135deg,#60a5fa,#1d4ed8)", gry: "linear-gradient(135deg,#94a3b8,#475569)", pnk: "linear-gradient(135deg,#f472b6,#be185d)", red: "linear-gradient(135deg,#f87171,#b91c1c)" };

  function css() {
    if ($("asp-css")) return;
    var st = document.createElement("style"); st.id = "asp-css";
    st.textContent =
      ".asp-wrap{margin-bottom:14px}.asp-i{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}" +
      ".asp-hero{background:linear-gradient(135deg,#1e1b4b,#3730a3 60%,#4f46e5);border-radius:20px;padding:16px;color:#fff;display:flex;gap:14px;align-items:center;box-shadow:0 10px 22px rgba(49,46,129,.3);position:relative;overflow:hidden;margin-bottom:4px}" +
      ".asp-hero:after{content:'';position:absolute;right:-30px;top:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.07)}" +
      ".asp-av{width:60px;height:60px;border-radius:50%;border:3px solid #fbbf24;background:#fff;display:flex;align-items:center;justify-content:center;color:#312e81;font-weight:800;font-size:1.3rem;flex:none}" +
      ".asp-hero b{font-size:1.05rem;display:block;position:relative}.asp-hero small{font-size:.76rem;opacity:.85;display:block;margin-top:2px;position:relative}" +
      ".asp-pill{display:inline-flex;align-items:center;gap:5px;font-size:.7rem;font-weight:700;padding:3px 9px;border-radius:99px;margin-top:7px;background:#dcfce7;color:#15803d;position:relative}.asp-pill.r{background:#fee2e2;color:#b91c1c}.asp-pill i{width:7px;height:7px;border-radius:50%;background:currentColor;display:block}" +
      ".asp-sec{font-size:.68rem;font-weight:800;color:#94a3b8;letter-spacing:.09em;margin:16px 4px 7px}" +
      ".asp-grp{background:#fff;border-radius:18px;box-shadow:0 2px 10px rgba(15,23,42,.07);overflow:hidden}" +
      ".asp-row{display:flex;align-items:center;gap:13px;width:100%;background:#fff;border:0;border-bottom:1px solid #f1f5f9;border-radius:0;padding:12px 14px;margin:0;text-align:left;cursor:pointer;font:inherit;color:#0f172a}.asp-row:last-child{border-bottom:0}" +
      ".asp-row:active{background:#f8fafc}.asp-ic{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex:none;color:#fff}" +
      ".asp-tx{flex:1;min-width:0}.asp-tx b{display:block;font-size:.93rem}.asp-tx small{display:block;color:#64748b;font-size:.76rem;margin-top:2px}.asp-ch{color:#cbd5e1;display:flex}.asp-ch .asp-i{width:18px;height:18px}" +
      ".asp-logout{margin-top:16px;border:1px solid #fecaca!important;border-radius:16px!important}" +
      "#asp-page{position:fixed;inset:0;z-index:99990;background:#f4f6fc;overflow:auto;display:none;-webkit-overflow-scrolling:touch}" +
      "#asp-page .asp-top{position:sticky;top:0;background:linear-gradient(135deg,#1e1b4b,#312e81);color:#fff;display:flex;align-items:center;gap:12px;padding:14px;z-index:2}" +
      "#asp-page .asp-top button{border:0;background:rgba(255,255,255,.15);color:#fff;border-radius:11px;width:38px;height:38px;cursor:pointer;display:flex;align-items:center;justify-content:center}" +
      "#asp-page .asp-top b{font-size:1.05rem;display:block}#asp-page .asp-top small{display:block;font-size:.7rem;opacity:.7;margin-top:1px}" +
      "#asp-page .asp-body{padding:14px;max-width:640px;margin:0 auto}.asp-card{background:#fff;border-radius:18px;box-shadow:0 2px 10px rgba(15,23,42,.07);padding:15px;margin-bottom:12px}" +
      ".asp-card p{margin:6px 0 0;color:#64748b;font-size:.84rem;line-height:1.5}.asp-card h4{margin:0;font-size:.92rem;font-weight:800;display:flex;align-items:center;gap:8px}.asp-ctr{text-align:center}" +
      ".asp-kv{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #f1f5f9}.asp-kv:last-child{border:0;padding-bottom:0}.asp-kv.f{padding-top:10px}" +
      ".asp-kvi{width:34px;height:34px;border-radius:10px;background:#eef2ff;color:#4338ca;display:flex;align-items:center;justify-content:center;flex:none}.asp-kvi .asp-i{width:17px;height:17px}" +
      ".asp-kv>div>span:first-child{display:block;font-size:.72rem;color:#94a3b8;font-weight:600}.asp-kv b{display:block;font-size:.88rem;margin-top:1px;word-break:break-all}" +
      ".asp-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.asp-btn{flex:1;min-width:120px;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;border:0;border-radius:13px;padding:12px;font-weight:700;font-size:.9rem;cursor:pointer;background:linear-gradient(135deg,#f97316,#c2410c);color:#fff;box-shadow:0 6px 14px rgba(234,88,12,.3)}.asp-btn .asp-i{width:18px;height:18px}" +
      ".asp-btn.g{background:linear-gradient(135deg,#22c55e,#15803d);box-shadow:0 6px 14px rgba(22,163,74,.28)}.asp-btn.o{background:#eef2ff;color:#3730a3;box-shadow:none}.asp-btn.r{background:#fee2e2;color:#b91c1c;box-shadow:none}" +
      ".asp-ok{color:#15803d;font-weight:700}.asp-bad{color:#b91c1c;font-weight:700}.asp-h{font-weight:800;font-size:1.05rem;margin:2px 0 8px;color:var(--text,#0f172a)}" +
      ".asp-bell{width:74px;height:74px;border-radius:50%;margin:4px auto 14px;background:linear-gradient(135deg,#fbbf24,#ea580c);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 0 0 8px #ffedd5,0 0 0 16px #fff7ed}.asp-bell .asp-i{width:34px;height:34px}" +
      ".asp-stat{display:flex;align-items:center;justify-content:space-between;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:13px;padding:11px 13px;margin-top:12px;font-size:.85rem;font-weight:700}.asp-stat .l{display:flex;align-items:center;gap:10px}.asp-stat .asp-pill{margin:0}" +
      ".asp-ping{width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 5px rgba(34,197,94,.25)}.asp-stat.bad{background:#fef2f2;border-color:#fecaca}.asp-stat.bad .asp-ping{background:#ef4444;box-shadow:0 0 0 5px rgba(239,68,68,.2)}.asp-stat.wait{background:#f8fafc;border-color:#e2e8f0}.asp-stat.wait .asp-ping{background:#94a3b8;box-shadow:0 0 0 5px rgba(148,163,184,.2)}" +
      ".asp-note{display:flex;gap:10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:13px;padding:11px 12px;margin-top:12px;font-size:.78rem;color:#9a3412;line-height:1.5}.asp-note .asp-i{width:18px;height:18px;margin-top:1px}" +
      ".asp-ver{display:flex;align-items:center;gap:14px}.asp-ver img{width:54px;height:54px;border-radius:15px}.asp-sep{height:1px;background:#f1f5f9;margin:14px 0}" +
      ".asp-line{display:flex;align-items:flex-start;gap:12px}.asp-line .asp-tx p{margin-top:3px}.asp-mini{font-size:.76rem;font-weight:700;padding:9px 14px;border-radius:10px;white-space:nowrap;align-self:center;border:0;cursor:pointer;background:#eef2ff;color:#3730a3}.asp-mini.g{background:#16a34a;color:#fff}" +
      ".asp-tag{font-size:.66rem;font-weight:700;color:#64748b;background:#f1f5f9;padding:2px 8px;border-radius:6px;margin-top:6px;display:inline-block}" +
      "#settings-box>*:not(#asp-menu){display:none!important}" +
      ".asp-big{width:62px;height:62px;border-radius:50%;margin:0 auto 8px;background:linear-gradient(135deg,#4ade80,#15803d);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 7px #dcfce7,0 0 0 14px #f0fdf4}.asp-big.off{background:linear-gradient(135deg,#94a3b8,#475569);box-shadow:0 0 0 7px #f1f5f9,0 0 0 14px #f8fafc}.asp-big .asp-i{width:28px;height:28px}" +
      ".asp-code{display:inline-block;background:#f1f5f9;border:1.5px dashed #94a3b8;border-radius:10px;padding:7px 16px;font-weight:800;letter-spacing:.18em;font-size:1rem;margin-top:6px;color:#1e1b4b}" +
      ".asp-lbl{font-size:.68rem;font-weight:800;color:#c2410c;letter-spacing:.06em;margin:14px 0 6px}" +
      "#asp-page #institute-joincode-input{width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:12px 13px;font-size:.95rem;letter-spacing:.05em;text-transform:uppercase;color:#0f172a;margin:0}" +
      "#asp-page #seed-questions-btn{display:flex;align-items:center;justify-content:center;width:100%;margin:12px 0 0;border:0;border-radius:13px;padding:12px;font-weight:700;font-size:.88rem;color:#fff;cursor:pointer;background:linear-gradient(135deg,#3b82f6,#1d4ed8)!important;box-shadow:0 6px 14px rgba(37,99,235,.3)}" +
      "#asp-page #admin-idcard-outer{margin:0}#asp-page #admin-institute-logo-status{margin:8px 0 0;font-size:.78rem;color:#64748b}" +
      "body.dark-mode .asp-row,body.dark-mode .asp-card,body.dark-mode .asp-grp,[data-theme=dark] .asp-row,[data-theme=dark] .asp-card,[data-theme=dark] .asp-grp{background:#1e293b;color:#e2e8f0;border-color:#334155}" +
      "body.dark-mode .asp-card p,[data-theme=dark] .asp-card p{color:#94a3b8}body.dark-mode .asp-kvi,[data-theme=dark] .asp-kvi{background:#334155;color:#a5b4fc}body.dark-mode .asp-btn.o,[data-theme=dark] .asp-btn.o,body.dark-mode .asp-mini,[data-theme=dark] .asp-mini{background:#334155;color:#c7d2fe}" +
      "body.dark-mode #asp-page,[data-theme=dark] #asp-page{background:#0f172a;color:#e2e8f0}";
    document.head.appendChild(st);
  }

  function toast(m) { try { var b = document.createElement("div"); b.textContent = m; b.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 16px;border-radius:12px;font-size:.85rem;z-index:2147483647;max-width:88vw;text-align:center"; document.body.appendChild(b); setTimeout(function () { b.remove(); }, 2600); } catch (e) {} }

  function user() { try { return (typeof getAuth === "function" && getAuth() && getAuth().currentUser) || null; } catch (e) { return null; } }
  function instId() { try { return typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null; } catch (e) { return null; } }
  var instCache = null;
  function loadInst() {
    if (instCache) return Promise.resolve(instCache);
    var id = instId(), db = typeof getDB === "function" ? getDB() : null;
    if (!id || !db) return Promise.resolve({});
    return db.collection("institutes").doc(id).get().then(function (d) { instCache = d.exists ? d.data() : {}; return instCache; }).catch(function () { return {}; });
  }

  /* ---------- pages ---------- */
  var pages = {
    profile: function (done) {
      var u = user() || {}, id = instId();
      loadInst().then(function (i) {
        var nm = esc(i.name || "—"), act = i.active === false;
        done("Profile & Institute", "Aapki aur institute ki details",
          '<div class="asp-card asp-ctr" style="padding:20px 15px"><div class="asp-av" style="margin:0 auto;width:78px;height:78px;font-size:1.7rem">' + esc(initials(i.name || u.email)) + '</div>' +
          '<div style="font-size:1.1rem;font-weight:800;margin-top:10px">' + nm + '</div><div style="font-size:.78rem;color:#64748b;margin-top:2px">Admin' + (u.email ? " • " + esc(u.email) : "") + '</div>' +
          '<span class="asp-pill' + (act ? " r" : "") + '"><i></i>' + (act ? "Deactivated" : "Active") + '</span></div>' +
          '<div class="asp-card" style="padding:13px"><h4>' + ico("idc") + ' Aapka ID Card</h4><p style="margin:5px 0 11px">Logo par click karke institute ka logo lagayein (ID Card par bhi dikhega). Photo aur Naam par click/✏️ karke details set karein.</p><div data-borrow="admin-idcard-outer,admin-institute-logo-status"></div></div>' +
          '<div class="asp-card"><h4>' + ico("user") + ' Account Details</h4>' + kv("Admin Email", esc(u.email || "—"), "mail", 1) + kv("Email verified", u.emailVerified ? '<span class="asp-ok">Haan, verified</span>' : '<span class="asp-bad">Nahi</span>', "shield") + '</div>' +
          '<div class="asp-card"><h4>' + ico("build") + ' Institute Details</h4>' + kv("Institute", nm, "build", 1) + kv("Institute ID", esc(id || "—"), "hash") + kv("Status", act ? '<span class="asp-bad">Deactivated</span>' : '<span class="asp-ok">Active</span>', "pulse") + '</div>' +
          '');
      });
    },
    notif: function (done) {
      var url = "https://cool-thunder-a280.vishnu1234stm.workers.dev";
      done("Notifications", "Students ko push bhejein",
        '<div class="asp-card asp-ctr" style="padding:20px 15px"><div class="asp-bell">' + ico("bell") + '</div><div style="font-size:1rem;font-weight:800">Students ko notification</div><p>App band ho tab bhi students ke phone par aati hai.</p>' +
        '<div class="asp-act"><button type="button" class="asp-btn" data-go="sendnotif">' + ico("send") + ' Notification bhejein</button></div></div>' +
        '<div class="asp-card"><h4>' + ico("pulse") + ' Push service status</h4><div class="asp-stat wait" id="asp-push-box"><div class="l"><span class="asp-ping"></span>Server</div><span id="asp-push-st" style="font-size:.78rem;color:#64748b">Check ho raha hai…</span></div>' +
        '<div class="asp-note">' + ico("alert") + '<div>Status ❌ ho to Owner se contact karein. Notification ke liye students ko naya app install karke ek baar login karna aur permission Allow karni hogi.</div></div></div>');
      var setSt = function (ok, txt) { var b = $("asp-push-box"), e = $("asp-push-st"); if (!b || !e) return; b.className = "asp-stat" + (ok ? "" : " bad"); e.className = "asp-pill" + (ok ? "" : " r"); e.removeAttribute("style"); e.innerHTML = "<i></i>" + txt; };
      fetch(url, { method: "GET" }).then(function (r) { return r.json(); }).then(function (j) { setSt(j && j.ok, j && j.ok ? "Chalu hai" : "Jawab galat"); }).catch(function () { setSt(false, "Connect nahi hua"); });
    },
    help: function (done) {
      var c = C(), ph = digits(c.supportPhone), wa = digits(c.supportWhatsapp || c.supportPhone), em = c.supportEmail || "";
      var acts = "";
      if (ph) acts += '<a class="asp-btn" href="tel:+91' + ph + '">📞 Call</a>';
      if (wa) acts += '<a class="asp-btn g" target="_blank" rel="noopener" href="https://wa.me/91' + wa + '?text=' + encodeURIComponent("Namaste, The Vishnu Sharma Admin se madad chahiye.") + '">💬 WhatsApp</a>';
      if (em) acts += '<a class="asp-btn o" href="mailto:' + esc(em) + '?subject=' + encodeURIComponent("The Vishnu Sharma Admin Support") + '">✉️ Email</a>';
      var faqs = (c.adminFaqs || []).map(function (f) { return '<div class="asp-card"><b>' + esc(f[0]) + '</b><p>' + esc(f[1]) + '</p></div>'; }).join("");
      done("Help & Support", "Humse sampark karein",
        '<div class="asp-card"><b>Koi problem hai?</b><p>Owner / Developer se seedha contact karein.' + (c.supportHours ? "<br>🕒 " + esc(c.supportHours) : "") + '</p>' +
        (acts ? '<div class="asp-act">' + acts + '</div>' : "") + '</div>' + (faqs ? '<div class="asp-h" style="margin-top:14px">Aam sawaal</div>' + faqs : ""));
    },
    about: function (done) {
      var c = C();
      done("About App", "App ki jaankari",
        '<div class="asp-card" style="text-align:center"><div style="display:flex;justify-content:center">' + bl(76) + '</div><div style="font-weight:800;font-size:1.2rem;margin-top:8px">' + esc(bi().name) + '</div><p>' + esc(bi().brand ? bi().sub : (c.tagline || "")) + '</p></div>' +
        '<div class="asp-card">' + kv("Version", esc((c.version || "") + (c.build ? " (build " + esc(c.build) + ")" : ""))) + (c.ownerName ? kv("Developer / Owner", esc(c.ownerName)) : "") + (c.website ? kv("Website", esc(c.website)) : "") + '</div>' +
        legal());
    },
    data: function (done) {
      var c = C();
      done("App & Data", "Update, cache aur question bank",
        apkCard() +
        '<div class="asp-card"><div class="asp-ver">' + bl(52) + '<div><b style="font-size:1rem">' + esc(bi().name) + '</b><div style="font-size:.76rem;color:#64748b;margin-top:2px">' + esc(bi().brand ? bi().sub : (c.tagline || "")) + '</div><span class="asp-pill"><i></i>Version ' + esc((c.version || "") + (c.build ? " (" + c.build + ")" : "")) + '</span></div></div></div>' +
        '<div class="asp-card"><div class="asp-line"><div class="asp-ic" style="background:' + TILE.ind + '">' + ico("dl") + '</div><div class="asp-tx"><b>Update check</b><p>Latest version laga hai ya nahi dekhein.</p></div></div><div class="asp-act"><button type="button" class="asp-btn" data-go="update">' + ico("refresh") + ' Update check karein</button></div>' +
        '<div class="asp-sep"></div><div class="asp-line"><div class="asp-ic" style="background:' + TILE.tea + '">' + ico("trash") + '</div><div class="asp-tx"><b>Cache saaf karke refresh</b><p>Kuch purana ya adhura dikhe to ye karein. Aapka login bana rahega.</p></div></div><div class="asp-act"><button type="button" class="asp-btn o" data-go="cache">' + ico("trash") + ' Cache saaf karein</button></div></div>' +
        '<div class="asp-card"><h4>' + ico("db") + ' Question Bank</h4>' +
        '<div class="asp-line" style="margin-top:12px"><div class="asp-tx"><b>Bank dobara load karein</b><p>Doosre admin ne questions jode hon aur yahan na dikhein to dabayein.</p><span class="asp-tag">Reads lagenge</span></div><button type="button" class="asp-mini" data-go="bank">Refresh</button></div>' +
        '<div class="asp-sep"></div><div class="asp-line"><div class="asp-tx"><b>Bank students ke liye publish</b><p>Students ko bank alag server se milta hai (reads 0). Ye apne aap hota hai; kabhi na ho to yahan dabayein.</p><span class="asp-tag">Reads: 0</span></div><button type="button" class="asp-mini g" data-go="pub">Publish</button></div>' +
        '<div class="asp-sep"></div><div class="asp-line"><div class="asp-tx"><b>Bank backup (export)</b><p>Poora question bank backup file mein download hoga.</p><span class="asp-tag">Reads: 0</span></div><button type="button" class="asp-mini" data-go="bankexp">Export</button></div>' +
        '<div class="asp-sep"></div><div><b style="font-size:.88rem">Seed All Questions</b><p>Pehli baar click karein — sabhi subjects (Math &amp; History) ke questions save/update ho jaayenge.</p><span class="asp-tag">Sirf pehli baar</span><div data-borrow="seed-questions-btn"></div></div></div>');
    },
    joincode: function (done) {
      if (typeof window.loadInstituteJoinCodeStatus === "function") { try { window.loadInstituteJoinCodeStatus(); } catch (e) {} }
      done("Institute Join Code", "Student registration ki suraksha",
        '<div class="asp-card asp-ctr" style="padding:20px 15px"><div class="asp-big" id="asp-jc-ic">' + ico("shield") + '</div><div id="asp-jc-t" style="font-size:1rem;font-weight:800;margin-top:12px">Check ho raha hai…</div><p id="asp-jc-p" style="display:none">Abhi ka code</p><span class="asp-code" id="asp-jc-code" style="display:none"></span></div>' +
        '<div class="asp-card"><h4>' + ico("key") + ' Naya code set / badlein</h4><div class="asp-lbl">NAYA CODE</div><div data-borrow="institute-joincode-input"></div>' +
        '<div class="asp-act" style="flex-direction:column"><button type="button" class="asp-btn" data-go="jcsave">' + ico("db") + ' Code Save Karein</button><button type="button" class="asp-btn r" data-go="jcoff">' + ico("alert") + ' Protection Hatayein</button></div></div>' +
        '<div class="asp-note">' + ico("alert") + '<div>Naye students ko registration ke waqt ye code dena hoga — bina code ke koi aapke institute mein register nahi kar paayega. Code sirf apne students ko dein.</div></div>' +
        '<div style="display:none" data-borrow="institute-joincode-status" data-after="jc"></div>');
    },
    pwd: function (done) {
      done("Admin Password", "Password aur recovery",
        '<div class="asp-card asp-ctr" style="padding:20px 15px"><div class="asp-bell" style="background:linear-gradient(135deg,#fb923c,#c2410c);box-shadow:0 0 0 8px #ffedd5,0 0 0 16px #fff7ed">' + ico("lock") + '</div><div style="font-size:1rem;font-weight:800">Aapka password surakshit hai</div><p>Password online save hota hai, isliye har device par same rahega.</p></div>' +
        '<div class="asp-grp">' + row2("refresh", "orc", "Change Password", "Naya password set karein", "pw") + row2("info", "blu", "Recovery Info", "Password bhool jaayein to kaise milega", "rec") + '</div>' +
        '<button type="button" class="asp-row asp-logout" data-go="lo" style="margin-top:14px"><span class="asp-ic" style="background:' + TILE.red + '">' + ico("out") + '</span><span class="asp-tx"><b style="color:#b91c1c">Admin Logout</b><small>Is device se admin logout</small></span></button>');
    },
    privacy: function (done) { done("Privacy & Terms", "Aapke data ke baare me", legal(true)); }
  };
  function apkState() { var u = window.SnapAppUpdate; return u && u.state && u.state.available ? u.state : null; }
  function apkCard() {
    var st = apkState(); if (!st) return "";
    return '<div class="asp-card" style="border:1.5px solid #fdba74;background:linear-gradient(135deg,#fff7ed,#fff)"><div class="asp-line"><div class="asp-ic" style="background:' + TILE.amb + '">' + ico("dl") + '</div><div class="asp-tx"><b>Naya APK aaya hai' + (st.name ? " (" + esc(st.name) + ")" : "") + '</b><p>' + esc(st.notes || "App ka naya version taiyaar hai.") + '</p></div></div><div class="asp-act"><button type="button" class="asp-btn" data-go="apkdl">' + ico("dl") + ' Download &amp; Update karein</button></div></div>';
  }
  function row2(ic, bg, t, sub, go) { return '<button type="button" class="asp-row" data-go="' + go + '"><span class="asp-ic" style="background:' + TILE[bg] + '">' + ico(ic) + '</span><span class="asp-tx"><b>' + t + '</b><small>' + sub + '</small></span><span class="asp-ch">' + ico("chev") + '</span></button>'; }
  /* purane elements (ID Card, join-code box, seed button) ko naye page me "udhaar" lete hain — original id/handlers waise hi rehte hain */
  var borrowed = [];
  function borrow(host) {
    String(host.getAttribute("data-borrow")).split(",").forEach(function (id) {
      var n = $(id); if (!n || n.parentNode === host) return;
      borrowed.push({ n: n, p: n.parentNode, nx: n.nextSibling }); host.appendChild(n);
    });
  }
  function giveBack() {
    while (borrowed.length) { var b = borrowed.pop(); try { if (b.nx && b.nx.parentNode === b.p) b.p.insertBefore(b.n, b.nx); else b.p.appendChild(b.n); } catch (e) {} }
    if (jcObs) { jcObs.disconnect(); jcObs = null; }
  }
  var jcObs = null;
  function jcInfo(el) { var t = (el && el.textContent) || "", on = /ON/i.test(t) && !/OFF|band|nahi/i.test(t), m = t.match(/code\s*:\s*([A-Za-z0-9_-]+)/i); return { on: on, code: m ? m[1].toUpperCase() : "", loading: /loading/i.test(t) || !t.trim() }; }
  function jcPaint() {
    var el = $("institute-joincode-status"), i = jcInfo(el), ic = $("asp-jc-ic"), t = $("asp-jc-t"), p = $("asp-jc-p"), c = $("asp-jc-code"); if (!ic || !t) return;
    if (i.loading) { t.textContent = "Check ho raha hai…"; return; }
    ic.className = "asp-big" + (i.on ? "" : " off"); t.textContent = i.on ? "Protection ON" : "Protection OFF";
    p.style.display = c.style.display = i.on && i.code ? "" : "none"; c.textContent = i.code;
  }
  function jcMenuSub() { var e = $("asp-jc-sub"); if (!e) return; var i = jcInfo($("institute-joincode-status")); e.textContent = i.loading ? "Student registration ki suraksha" : (i.on ? "Protection ON" + (i.code ? " • " + i.code : "") : "Protection OFF"); }
  function legal(only) {
    var c = C(), a = "";
    if (c.privacyUrl) a += '<a class="asp-btn o" target="_blank" rel="noopener" href="' + esc(c.privacyUrl) + '">🔒 Privacy Policy</a>';
    if (c.termsUrl) a += '<a class="asp-btn o" target="_blank" rel="noopener" href="' + esc(c.termsUrl) + '">📄 Terms</a>';
    var txt = '<div class="asp-card"><b>Aapka data</b><p>Active institute admin apne institute ke student profiles aur exam data dekh sakte hain. Service ko chalane, secure karne ya support dene ke liye app owner aur configured providers bhi data process kar sakte hain. Details Privacy Policy mein hain.</p>' + (a ? '<div class="asp-act">' + a + '</div>' : "") + '</div>';
    return only || a ? txt : "";
  }
  function kv(k, v, ic, first) { return '<div class="asp-kv' + (first ? " f" : "") + '">' + (ic ? '<div class="asp-kvi">' + ico(ic) + "</div>" : "") + '<div style="flex:1;min-width:0"><span>' + k + '</span><b>' + v + "</b></div></div>"; }
  function initials(n) { var p = String(n || "A").replace(/@.*/, "").trim().split(/\s+/); return ((p[0] || "A")[0] + (p[1] ? p[1][0] : "")).toUpperCase(); }

  /* ---------- page shell ---------- */
  function openPage(key) {
    if (key === "recfix") { (async function () { try { var r = await window.SnapRecordsBackfill({ dry: true }); if (!r.recordsToFix) { toast("Sab results pehle se theek hain ✅ (" + r.students + " students check hue)"); return; } if (confirm(r.recordsToFix + " purane results me institute tag lagana hai (" + r.students + " students). Karein?")) { var a = await window.SnapRecordsBackfill({ dry: false }); toast("Done ✅ " + a.recordsToFix + " results fix hue"); } } catch (e) { toast("Fix nahi hua: " + (e.message || e)); } })(); return; }
    if (key === "owner") { try { if (typeof window.__openOwnerPanelSafe === "function") window.__openOwnerPanelSafe(); else toast("Owner Panel available nahi"); } catch (e) {} return; }
    var f = pages[key]; if (!f) return;
    giveBack();
    var pg = $("asp-page");
    if (!pg) { pg = document.createElement("div"); pg.id = "asp-page"; document.body.appendChild(pg); }
    pg.style.display = "block"; pg.innerHTML = '<div class="asp-top"><button type="button" data-go="back">' + ico("back") + '</button><div><b>…</b><small></small></div></div><div class="asp-body"></div>';
    f(function (title, sub, html) { if (pg.style.display === "none") return; pg.querySelector(".asp-top b").textContent = title; pg.querySelector(".asp-top small").textContent = sub || ""; pg.querySelector(".asp-body").innerHTML = html;
      Array.prototype.forEach.call(pg.querySelectorAll("[data-borrow]"), function (h) { borrow(h); if (h.getAttribute("data-after") === "jc") { var el = $("institute-joincode-status"); jcPaint(); if (el && window.MutationObserver) { jcObs = new MutationObserver(function () { jcPaint(); jcMenuSub(); }); jcObs.observe(el, { childList: true, characterData: true, subtree: true }); } } }); });
  }
  function closePage() { var pg = $("asp-page"); if (pg) pg.style.display = "none"; giveBack(); }

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest ? ev.target.closest("[data-asp],[data-go]") : null; if (!t) return;
    var k = t.getAttribute("data-asp"), g = t.getAttribute("data-go");
    if (k) { ev.preventDefault(); openPage(k); return; }
    if (g === "back") { ev.preventDefault(); closePage(); return; }
    ev.preventDefault();
    if (g === "idcard") { closePage(); var el = $("admin-idcard-outer"); el && el.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (g === "sendnotif") { closePage(); var card = document.querySelector('[onclick*="an-open"],[data-an],#an-open-btn') || document.querySelector('[id^="an-"]'); if (typeof goAdmin === "function") { try { backToAdminDashboard(); } catch (e) {} } toast("Dashboard par '🔔 Notification' card dabayein"); }
    else if (g === "jcsave") { if (typeof window.saveInstituteJoinCode === "function") window.saveInstituteJoinCode(); else toast("Available nahi"); }
    else if (g === "jcoff") { if (typeof window.disableInstituteJoinCode === "function") window.disableInstituteJoinCode(); else toast("Available nahi"); }
    else if (g === "pw") { var b1 = $("change-admin-password-btn"); b1 ? b1.click() : toast("Button nahi mila"); }
    else if (g === "rec") { var b2 = $("set-recovery-btn"); b2 ? b2.click() : toast("Button nahi mila"); }
    else if (g === "lo") { var b3 = $("admin-logout-btn"); b3 ? b3.click() : toast("Logout button nahi mila"); }
    else if (g === "update") { toast("⏳ Update check ho raha hai...");
      var webCheck = function () { if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(function (r) { if (!r) return toast("✅ Aap latest version par hain"); return r.update().then(function () { if (r.installing || r.waiting) { toast("⬆️ Naya version mil gaya — reload ho raha hai"); setTimeout(function () { location.reload(); }, 1200); } else toast("✅ Aap latest version par hain"); }); }).catch(function () { toast("Update check nahi ho paya"); }); else toast("✅ Aap latest version par hain"); };
      if (window.SnapAppUpdate && SnapAppUpdate.check) SnapAppUpdate.check({ manual: true }).then(function (st) { if (st && st.available) toast("📲 Naya APK mila — download karein", 5000); else webCheck(); }, webCheck); else webCheck(); }
    else if (g === "apkdl") { if (window.SnapAppUpdate) SnapAppUpdate.show(); }
    else if (g === "cache") { toast("⏳ Cache saaf ho raha hai..."); var keep = {}; try { Object.keys(localStorage).forEach(function (k2) { if (/session|auth|firebase|savya_student|admin/i.test(k2)) keep[k2] = localStorage.getItem(k2); }); } catch (e) {}
      Promise.resolve(window.caches && caches.keys ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k2) { return caches.delete(k2); })); }) : 0).then(function () { return navigator.serviceWorker && navigator.serviceWorker.getRegistrations ? navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.update(); })); }) : 0; }).catch(function () {}).then(function () { try { localStorage.removeItem("savya_bank_cache"); localStorage.removeItem("snap_bank_sync_ts"); } catch (e) {} setTimeout(function () { location.reload(); }, 600); }); }
    else if (g === "pub") { toast("⏳ Publish ho raha hai..."); if (window.publishBankManual) window.publishBankManual().then(function (m) { toast(m); }); else toast("Available nahi"); }
    else if (g === "bankexp") { if (window.exportBankJson) window.exportBankJson(); else toast("Export available nahi"); }
    else if (g === "bank") { if (window.refreshBankNow) { window.refreshBankNow(); toast("🔄 Bank refresh chalu ho gaya"); } else toast("Bank refresh available nahi"); }
  });

  /* ---------- menu inject ---------- */
  function row(ic, bg, t, s, k) { return '<button type="button" class="asp-row" data-asp="' + k + '"><span class="asp-ic" style="background:' + TILE[bg] + '">' + ico(ic) + '</span><span class="asp-tx"><b>' + t + '</b><small>' + s + '</small></span><span class="asp-ch">' + ico("chev") + '</span></button>'; }
  function mount() {
    try {
      var box = $("settings-box"); if (!box) return; css();
      var m = $("asp-menu");
      if (!m) {
        m = document.createElement("div"); m.id = "asp-menu"; m.className = "asp-wrap";
        m.innerHTML = '<div class="asp-hero"><div class="asp-av" id="asp-hero-av">' + esc(initials((user() || {}).email)) + '</div><div><b id="asp-hero-nm">Admin</b><small id="asp-hero-sub">' + esc((user() || {}).email || "Admin") + '</small><span class="asp-pill" id="asp-hero-st"><i></i>Institute Active</span></div></div>' +
          '<div class="asp-sec">ACCOUNT</div><div class="asp-grp">' + row("user", "ind", "Profile & Institute", "ID Card, email, institute, status", "profile") + row("lock", "orc", "Admin Password", "Change password, recovery info", "pwd") + '</div>' +
          '<div class="asp-sec">STUDENTS</div><div class="asp-grp">' + row("key", "tea", "Institute Join Code", "Student registration ki suraksha", "joincode").replace("<small>", '<small id="asp-jc-sub">') + row("bell", "amb", "Notifications", "Students ko push bhejna, status", "notif") + '</div>' +
          '<div class="asp-sec">DATA</div><div class="asp-grp">' + row("phone", "idg", "App & Data", apkState() ? "Naya APK aaya hai — update karein" : "Update, cache, bank, seed", "data").replace("<small>", '<small id="asp-data-sub">') + row("shield", "blu", "Result Privacy Fix", "Purane results me institute tag lagayein", "recfix") + row("shield", "pnk", "Privacy & Terms", "Aapke data ke baare me", "privacy") + '</div>' +
          '<div class="asp-sec">SUPPORT</div><div class="asp-grp">' + row("help", "blu", "Help & Support", "Call / WhatsApp / Email, FAQ", "help") + row("info", "gry", "About App", "Version " + esc((C().version || "") + (C().build ? " (" + C().build + ")" : "")), "about") + '</div>' +
          '<div class="asp-sec">OWNER</div><div class="asp-grp">' + row("crown", "ind", "Owner Panel", "Har institute ka admin manage karein", "owner") + '</div>' +
          '<button type="button" class="asp-row asp-logout" id="asp-logout"><span class="asp-ic" style="background:' + TILE.red + '">' + ico("out") + '</span><span class="asp-tx"><b style="color:#b91c1c">Admin Logout</b><small>Is device se admin logout</small></span></button>';
        var first = box.querySelector(".card"); if (first && first.nextSibling) box.insertBefore(m, first.nextSibling); else box.insertBefore(m, box.firstChild);
        try { window.addEventListener("snap-apk-update", function () { var e = $("asp-data-sub"); if (e) e.textContent = apkState() ? "Naya APK aaya hai — update karein" : "Update, cache, bank, seed"; }); } catch (e) {}
        try { var jcEl = $("institute-joincode-status"); if (jcEl && window.MutationObserver) new MutationObserver(jcMenuSub).observe(jcEl, { childList: true, characterData: true, subtree: true }); jcMenuSub(); } catch (e) {}
        loadInst().then(function (i) { var n = $("asp-hero-nm"); if (!n || !i) return; if (i.name) { n.textContent = i.name; $("asp-hero-av").textContent = initials(i.name); } var st = $("asp-hero-st"); if (st && i.active === false) { st.className = "asp-pill r"; st.innerHTML = "<i></i>Deactivated"; } });
        $("asp-logout").addEventListener("click", function () { var b = $("admin-logout-btn"); if (b) b.click(); else toast("Logout button nahi mila"); });
      }
    } catch (e) { console.warn("[asp] mount fail", e); }
  }
  window.SnapAdminSettings = { mount: mount, open: openPage };
  function hook() {
    var o = window.renderAdminSettingsEmail;
    if (typeof o === "function" && !o.__asp) { var w = function () { var r = o.apply(this, arguments); mount(); return r; }; w.__asp = 1; window.renderAdminSettingsEmail = w; }
    var box = $("settings-box"); if (box && !box.classList.contains("hidden")) mount();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hook); else hook();
  setTimeout(hook, 800); setTimeout(hook, 2500);
})();
