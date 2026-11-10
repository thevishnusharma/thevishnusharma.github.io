/* Owner App UI v181 — Design A (Fresh Light + bottom tabs).
   owner-panel.js ka saara kaam (Firestore, Worker, modals) jyon ka tyon; ye file sirf dikhne wali cheezein badalti hai.
   Fast rakha hai: sirf chhota innerHTML, koi timer/animation/extra network nahi (sirf login ke baad 1 baar alerts). */
(function () {
  "use strict";
  var IC = {"home": "<path d=\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><polyline points=\"9 22 9 12 15 12 15 22\"/>", "bld": "<rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"/><path d=\"M9 21v-4h6v4M8 7h2M14 7h2M8 11h2M14 11h2\"/>", "bell": "<path d=\"M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9\"/><path d=\"M13.7 21a2 2 0 0 1-3.4 0\"/>", "cog": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z\"/>", "user": "<path d=\"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\"/><circle cx=\"12\" cy=\"7\" r=\"4\"/>", "plus": "<line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/>", "ref": "<polyline points=\"23 4 23 10 17 10\"/><path d=\"M20.5 15a9 9 0 1 1-2.1-9.4L23 10\"/>", "dl": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/>", "phone": "<rect x=\"6\" y=\"2\" width=\"12\" height=\"20\" rx=\"2\"/><line x1=\"12\" y1=\"18\" x2=\"12\" y2=\"18\"/>", "chk": "<path d=\"M22 11.1V12a10 10 0 1 1-5.9-9.1\"/><polyline points=\"22 4 12 14 9 11\"/>", "clock": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><polyline points=\"12 6 12 12 16 14\"/>", "warn": "<path d=\"M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z\"/><line x1=\"12\" y1=\"9\" x2=\"12\" y2=\"13\"/>", "users": "<path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8\"/>", "db": "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\"/><path d=\"M21 12c0 1.7-4 3-9 3s-9-1.3-9-3M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5\"/>", "srch": "<circle cx=\"11\" cy=\"11\" r=\"8\"/><line x1=\"21\" y1=\"21\" x2=\"16.7\" y2=\"16.7\"/>", "edit": "<path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z\"/>", "drop": "<path d=\"M12 2.7l5.7 5.7a8 8 0 1 1-11.4 0z\"/>", "pause": "<rect x=\"6\" y=\"4\" width=\"4\" height=\"16\"/><rect x=\"14\" y=\"4\" width=\"4\" height=\"16\"/>", "trash": "<polyline points=\"3 6 5 6 21 6\"/><path d=\"M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4h4v2\"/>", "out": "<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"/><polyline points=\"16 17 21 12 16 7\"/><line x1=\"21\" y1=\"12\" x2=\"9\" y2=\"12\"/>", "x": "<line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>", "link": "<path d=\"M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7\"/><path d=\"M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7\"/>", "key": "<circle cx=\"8\" cy=\"15\" r=\"4\"/><line x1=\"10.8\" y1=\"12.2\" x2=\"21\" y2=\"2\"/><line x1=\"17\" y1=\"6\" x2=\"20\" y2=\"9\"/>"};
  function ic(n, s, c) { return '<svg width="' + (s || 20) + '" height="' + (s || 20) + '" viewBox="0 0 24 24" fill="none" stroke="' + (c || "currentColor") + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (IC[n] || "") + "</svg>"; }
  function $(i) { return document.getElementById(i); }
  function esc(x) { return ownerEsc(x); }
  function fmtMB(mb) { return mb >= 1024 ? (mb / 1024).toFixed(2) + " GB" : mb + " MB"; }
  function toast(m) {
    var o = document.querySelector(".oa-toast"); if (o) o.remove();
    var t = document.createElement("div"); t.className = "oa-toast"; t.textContent = m; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  /* ---------- tabs ---------- */
  var cur = "home";
  window.ouiTab = function (t) {
    cur = t;
    ["home", "inst", "alerts", "reads", "set"].forEach(function (k) { var v = $("oa-v-" + k); if (v) v.classList.toggle("hidden", k !== t); });
    document.querySelectorAll(".oa-tab button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-t") === t); });
    var f = $("oa-fab"); if (f) f.classList.toggle("hidden", !(t === "home" || t === "inst"));
    if (t === "set") { var e = $("oa-set-email"), em = $("owner-logged-in-as"); if (e && em) e.textContent = em.textContent; }
    if (t === "reads" && window.ouiReadsOpen) window.ouiReadsOpen();
    window.scrollTo(0, 0);
  };
  window.ouiShowFilter = function (f) { _ownerDashFilter = f; window.ouiTab("inst"); markFilters(); ownerDashApplyFilter(); };

  /* ---------- naya institute sheet ---------- */
  window.ouiOpenSheet = function () { if ((window.SNAP_CONFIG || {}).onboarding !== false && window.ownerWizardOpen) { window.ownerWizardOpen(); return; } try { ownerRenderNewInstituteClassCheckboxes(); } catch (e) {} var s = $("oa-sheet"); if (s) s.classList.remove("hidden"); };
  window.ouiCloseSheet = function () { var s = $("oa-sheet"); if (s) s.classList.add("hidden"); };
  window.ouiAddInst = function (e) {
    e.preventDefault();
    Promise.resolve(ownerAddInstituteSubmit(e)).then(function () {
      var n = $("owner-new-institute-name");
      if (n && !n.value) { window.ouiCloseSheet(); window.ouiTab("inst"); toast("Institute add ho gaya"); }
    });
    return false;
  };

  /* ---------- APK picker ---------- */
  window.ouiApkPick = function () {
    var L = Object.values(_ownerInstitutesCache).sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
    if (!L.length) { toast("Pehle koi institute add karein"); return; }
    if (L.length === 1) { ownerApkInfo(L[0].id); return; }
    var old = $("oa-pick"); if (old) old.remove();
    var m = document.createElement("div"); m.id = "oa-pick"; m.className = "oa-sheet";
    m.innerHTML = '<div class="oa-sheet-box"><div class="oa-grab"></div><h3>Kis institute ka APK?</h3>' +
      L.map(function (a) { return '<button type="button" class="oa-pk" data-id="' + esc(a.id) + '"><span class="oa-lg" style="width:34px;height:34px;font-size:.8rem">' + esc((a.name || "?").charAt(0).toUpperCase()) + "</span>" + esc(a.name || a.id) + "</button>"; }).join("") + "</div>";
    m.onclick = function (e) {
      if (e.target === m) { m.remove(); return; }
      var b = e.target.closest("[data-id]"); if (b) { var id = b.getAttribute("data-id"); m.remove(); ownerApkInfo(id); }
    };
    document.body.appendChild(m);
  };

  /* ---------- helpers ---------- */
  function expTxt(a) {
    var s = ownerExpState(a); if (s.k === "none") return { t: "Bina expiry", c: "#64748b" };
    var d = Math.ceil((+a.planExpiresAt - Date.now()) / 864e5);
    if (s.k === "expired") return { t: "Expired (" + (-d) + " din pehle)", c: "#dc2626" };
    if (s.k === "soon") return { t: d + " din bache", c: "#d97706" };
    return { t: "Expiry " + ownerFmtDate(+a.planExpiresAt), c: "#16a34a" };
  }
  function sorted() { return Object.values(_ownerInstitutesCache).sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); }); }

  /* v219: Branding / Drive / YouTube status (institute doc me jo pehle se hai wahi; koi naya read nahi) */
  function statusChips(a) {
    var chip = function (ok, t) { return '<span style="display:inline-block;font-size:.72rem;margin:0 6px 4px 0;padding:2px 8px;border-radius:99px;background:' + (ok ? "#dcfce7;color:#166534" : "#fee2e2;color:#991b1b") + '">' + (ok ? "✅ " : "❌ ") + t + "</span>"; };
    var br = !!(a.logoDataUrl || a.tagline || a.brandColor);
    return '<div class="oa-chips" style="margin:2px 0 6px">' + chip(br, "Branding") + chip(a.driveConnected === true, "Drive") + chip(!!a.youtubeChannelUrl, "YouTube") + "</div>";
  }

  /* ---------- institute card ---------- */
  function card(a, adm) {
    var id = a.id, nm = a.name || "(naam nahi)", sc = +a.studentCount || 0, sl = +a.studentLimit || 0;
    var used = Math.round((a.storageUsedBytes || 0) / 1048576), lim = +a.storageLimitMB || 0, ex = expTxt(a);
    var full = sl && sc >= sl, over = lim && used >= lim, off = a.active === false;
    var col = /^#[0-9a-f]{6}$/i.test(a.brandColor || "") ? ' style="background:' + a.brandColor + '"' : "";
    var A = function (fn, icn, label, cls) { return '<button type="button"' + (cls ? ' class="' + cls + '"' : "") + ' onclick="' + fn + '">' + ic(icn, 16) + label + "</button>"; };
    var an = ownerEscAttr(nm), on = ownerEscAttr(a.ownerName || "");
    return '<div class="owner-inst-card oa-card" data-iid="' + id + '" data-name="' + esc(nm.toLowerCase()) + '">' +
      '<div class="oa-ib"><div class="oa-lg"' + col + ">" + esc(nm.charAt(0).toUpperCase()) + "</div><div><h4>" + esc(nm) + (a.isDemo ? ' <span style="font-size:.62rem;background:#fef3c7;color:#92400e;border-radius:6px;padding:1px 6px;vertical-align:middle">DEMO</span>' : "") + "</h4><p>" +
      (a.ownerName ? "Owner: " + esc(a.ownerName) : '<span style="color:#c2410c">Owner ka naam set nahi hai</span>') + "</p></div>" +
      '<span class="owner-badge ' + (off ? "owner-badge-off" : "owner-badge-on") + '">' + (off ? "Inactive" : "Active") + "</span></div>" +
      '<div class="oa-bars"><div class="oa-rw"><span>Students</span><b' + (full ? ' style="color:#dc2626"' : "") + ">" + sc + (sl ? " / " + sl : "") + (full ? " (limit poori)" : "") + "</b></div>" +
      (sl ? '<div class="oa-bar"><i class="' + (full ? "r" : "") + '" style="width:' + Math.min(100, sc / sl * 100) + '%"></i></div>' : '<div style="height:8px"></div>') +
      '<div class="oa-rw"><span>Storage</span><b' + (over ? ' style="color:#dc2626"' : "") + ">" + fmtMB(used) + (lim ? " / " + fmtMB(lim) : "") + "</b></div>" +
      (lim ? '<div class="oa-bar"><i class="' + (over ? "r" : "") + '" style="width:' + Math.min(100, used / lim * 100) + '%"></i></div>' : '<div style="height:8px"></div>') +
      '<div class="oa-rw"><span>' + esc(a.plan || "Free") + ' plan</span><b style="color:' + ex.c + '">' + ex.t + "</b></div></div>" +
      statusChips(a) +
      '<div class="owner-inst-classes">' + ownerClassChipsHtml(a) + "</div>" +
      '<div class="oa-ac">' +
      A("ownerRenameInstitute('" + id + "','" + an + "')", "edit", "Rename") +
      A("ownerBrandingEdit('" + id + "')", "drop", "Branding &amp; Plan") +
      A("ownerApkInfo('" + id + "')", "phone", "APK Link") +
      A("ownerSetInstituteOwnerName('" + id + "','" + on + "')", "user", "Owner Naam") +
      A("ownerToggleInstitute('" + id + "'," + off + ")", off ? "chk" : "pause", off ? "Activate" : "Deactivate") +
      A("ownerDeleteInstitute('" + id + "')", "trash", "Remove", "d") + "</div>" +
      '<details class="oa-adm" data-iid="' + id + '"><summary><span>' + (adm.length ? "Admin: " + esc(adm[0].email) : "Abhi koi admin nahi") + "</span><b>" + (adm.length ? adm.length + " admin" : "+ Add") + "</b></summary>" +
      '<div class="oa-adm-body">' + adm.map(ownerAdminRowHtml).join("") +
      '<form class="owner-add-admin-form" onsubmit="return ownerAddAdminSubmit(event, \'' + id + "', '" + an + '\')"><input type="email" placeholder="Naye admin ka email" required><button type="submit" class="owner-mini-btn owner-mini-primary">+ Admin Add Karein</button></form></div></details></div>';
  }

  window.ownerRenderList = function () {
    var el = $("owner-institutes-list"); if (!el) return;
    var open = {}; el.querySelectorAll("details[open][data-iid]").forEach(function (d) { open[d.getAttribute("data-iid")] = 1; });
    var L = sorted(), byI = {}, orphan = [];
    Object.values(_ownerAdminsCache).forEach(function (a) {
      if (a.instituteId && _ownerInstitutesCache[a.instituteId]) (byI[a.instituteId] = byI[a.instituteId] || []).push(a); else orphan.push(a);
    });
    var h = "";
    if (!L.length && !orphan.length) h = '<div class="oa-card" style="color:#64748b;font-size:.82rem">Abhi koi institute add nahi hua. Neeche + button se pehla institute banayein.</div>';
    L.forEach(function (a) { h += card(a, byI[a.id] || []); });
    if (orphan.length) h += '<div class="owner-inst-card owner-inst-card-orphan oa-card"><h3>' + ic("warn", 18, "#b45309") + ' Bina institute ke admins</h3><div style="margin-top:8px">' + orphan.map(ownerOrphanAdminBlockHtml).join("") + "</div></div>";
    el.innerHTML = h;
    Object.keys(open).forEach(function (k) { var d = el.querySelector('details[data-iid="' + k + '"]'); if (d) d.open = true; });
    try { ownerRenderDashboard(); } catch (e) { console.warn("[owner ui]", e); }
  };

  /* ---------- dashboard (Home) + filters ---------- */
  var FILTERS = [["all", "Sab"], ["soon", "Jaldi expire"], ["expired", "Expired"], ["off", "Inactive"], ["full", "Limit poori"]];
  function markFilters() { var f = $("oa-filters"); if (f) f.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-f") === _ownerDashFilter); }); }
  window.ownerDashApplyFilter = function () {
    var q = (($("oa-search") || {}).value || "").trim().toLowerCase();
    document.querySelectorAll("#owner-institutes-list .owner-inst-card[data-iid]").forEach(function (c) {
      var a = _ownerInstitutesCache[c.getAttribute("data-iid")] || {}, e = ownerExpState(a), f = _ownerDashFilter;
      var ok = f === "all" || (f === "soon" && e.k === "soon") || (f === "expired" && e.k === "expired") || (f === "off" && a.active === false) || (f === "full" && +a.studentLimit > 0 && (+a.studentCount || 0) >= +a.studentLimit);
      if (ok && q) ok = (c.getAttribute("data-name") || "").indexOf(q) >= 0;
      c.style.display = ok ? "" : "none";
    });
  };
  window.ownerRenderDashboard = function () {
    var L = Object.values(_ownerInstitutesCache).filter(function (a) { return !a.isDemo; }), act = 0, off = 0, soon = 0, exp = 0, stu = 0, bytes = 0, full = 0, soonL = [];   /* v220: demo stats me nahi */
    L.forEach(function (a) {
      a.active === false ? off++ : act++;
      var e = ownerExpState(a); if (e.k === "soon") { soon++; soonL.push(a); } if (e.k === "expired") { exp++; soonL.push(a); }
      stu += +a.studentCount || 0; bytes += +a.storageUsedBytes || 0;
      if (+a.studentLimit > 0 && (+a.studentCount || 0) >= +a.studentLimit) full++;
    });
    var admins = Object.keys(_ownerAdminsCache).length, pct = L.length ? Math.round(act / L.length * 100) : 0, hero = $("oa-hero");
    if (hero) hero.innerHTML = "<div><small>Total Institutes</small><b>" + L.length + "</b><small>" + (L.length && !off ? (L.length === 1 ? "Active" : "Sab active") : act + " active, " + off + " inactive") + " • " + stu + " students</small></div>" +
      '<div class="oa-ring" style="background:conic-gradient(#fff 0 ' + pct + "%,rgba(255,255,255,.25) 0)\"><i>" + pct + "%</i></div>";
    var k = function (v, l, c) { return '<div class="oa-k"><b' + (c ? ' style="color:' + c + '"' : "") + ">" + v + "</b><span>" + l + "</span></div>"; };
    var g = $("oa-kpis");
    if (g) g.innerHTML = k(act, "Active", "#16a34a") + k(off, "Inactive", off ? "#dc2626" : "") + k(soon, "7 din me expire", soon ? "#d97706" : "") + k(exp, "Expired", exp ? "#dc2626" : "") +
      k(stu, "Total Students") + k(full, "Limit poori", full ? "#dc2626" : "") + k((bytes / 1073741824).toFixed(2) + " GB", "Drive use") + k(admins, "Admins");
    var s = $("oa-soon");
    if (s) s.innerHTML = soonL.length ? soonL.map(function (a) { var e = expTxt(a); return '<div style="padding:4px 0">' + esc(a.name || a.id) + ' — <b style="color:' + e.c + '">' + e.t + "</b> (" + esc(a.plan || "Free") + ")</div>"; }).join("") : "Koi institute jaldi expire nahi ho raha.";
    var f = $("oa-filters");
    if (f && !f.firstChild) { f.innerHTML = FILTERS.map(function (x) { return '<button type="button" data-f="' + x[0] + '">' + x[1] + "</button>"; }).join(""); }
    var c = $("oa-inst-count"); if (c) c.textContent = L.length + " total • " + act + " active";
    markFilters(); ownerDashApplyFilter();
  };
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#oa-filters [data-f]");
    if (b) { _ownerDashFilter = b.getAttribute("data-f"); markFilters(); ownerDashApplyFilter(); }
  });

  /* ---------- alerts summary (Home card + tab dot) ---------- */
  function alertSummary() {
    var box = $("owner-alerts-list"), s = $("oa-alert-sum"), dot = $("oa-dot"); if (!box || !s) return;
    var t = box.textContent || "", n = box.children.length;
    if (/Alerts nahi mile/.test(t)) { s.className = "oa-sum bad"; s.innerHTML = ic("warn", 16) + "<span>" + esc(t.slice(0, 200)) + "</span>"; if (dot) dot.classList.add("hidden"); }
    else if (/Koi alert nahi/.test(t)) { s.className = "oa-sum ok"; s.innerHTML = ic("chk", 16) + "<span>Koi alert nahi — sab theek chal raha hai</span>"; if (dot) dot.classList.add("hidden"); }
    else if (n) { s.className = "oa-sum warn"; s.innerHTML = ic("warn", 16) + "<span>" + n + ' alert aaye hain — <a href="#" onclick="ouiTab(\'alerts\');return false" style="color:inherit;font-weight:700">dekhein</a></span>'; if (dot) dot.classList.remove("hidden"); }
  }
  var _la = window.ownerLoadAlerts;
  if (_la) window.ownerLoadAlerts = async function () {
    var s = $("oa-alert-sum"); if (s) { s.className = "oa-sum idle"; s.textContent = "Load ho raha hai..."; }
    try { await _la.apply(this, arguments); } catch (e) {}
    alertSummary();
  };

  /* ---------- panel show: email text, ek baar alerts auto-load ---------- */
  var _sp = window.ownerShowPanel, loaded = false;
  window.ownerShowPanel = function () {
    var r = _sp.apply(this, arguments);
    try {
      var u = ownerGetAuth().currentUser, n = $("owner-logged-in-as"); if (n && u && u.email) n.textContent = u.email;
      window.ouiTab(cur);
      if (!loaded) { loaded = true; setTimeout(function () { try { window.ownerLoadAlerts(); } catch (e) {} }, 700); }
    } catch (e) { console.warn("[owner ui]", e); }
    return r;
  };
})();
