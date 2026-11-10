/* SnapLock (v175) — "har institute ka apna app".
   1) LOCK: app ek institute se bandh ho sakti hai. Lock id in 3 jagah se aati hai (is order me):
        - lock-config.js  ->  window.SNAP_LOCK_INSTITUTE   (institute-APK build me GitHub Action ye file banata hai)
        - link me  ?inst=<instituteId>                      (institute ka apna web link; phone/browser me yaad rakha jaata hai)
        - pichli baar ka yaad rakha hua (localStorage)
      Link kholne wala lock hatane ke liye:  ?inst=off
      Lock hone par: Registration me institute apne aap chun jaata hai (dropdown chhup jaata hai), aur doosre institute ke
      Student/Admin us app me login karein to "ye app is institute ka nahi hai" screen aati hai.
   2) SUSPEND: Owner Panel me institute Deactivate hote hi us institute ke Admin + Students (aur lock wale app me har koi)
      ko "App abhi band hai" screen aati hai. Activate karte hi wapas chalu. Owner par koi asar nahi.
   Kill-switch: SNAP_CONFIG.appLock = false. Kabhi throw nahi karta. */
(function () {
  "use strict";
  if (window.SnapLock) return;
  var LK = "snap_lock_inst", OWNER_KEY = "snaptestpro_owner_logged_in", forced = false, shownFor = "";

  function on() { return !(window.SNAP_CONFIG && window.SNAP_CONFIG.appLock === false); }

  function lockId() {
    try {
      var p = new URL(location.href).searchParams.get("inst");
      if (p === "off") localStorage.removeItem(LK);
      else if (p && /^[A-Za-z0-9_-]{1,100}$/.test(p)) localStorage.setItem(LK, p);
    } catch (e) {}
    var id = "";
    try { id = window.SNAP_LOCK_INSTITUTE || localStorage.getItem(LK) || ""; } catch (e) { id = window.SNAP_LOCK_INSTITUTE || ""; }
    return id || null;
  }
  function isOwner() { try { return !!localStorage.getItem(OWNER_KEY) && localStorage.getItem(OWNER_KEY) !== "0" && localStorage.getItem(OWNER_KEY) !== "false"; } catch (e) { return false; } }
  function sessId() {
    var a = null, s = null;
    try { if (typeof getCurrentAdminInstituteId === "function") a = getCurrentAdminInstituteId(); } catch (e) {}
    try { var x = typeof getStudentSession === "function" ? getStudentSession() : null; s = x && x.instituteId; } catch (e) {}
    return { admin: a || null, student: s || null };
  }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- registration: locked institute apne aap chun lo, dropdown chhupa do ---------- */
  function lockRegister(lock) {
    var sel = document.getElementById("register-institute"); if (!sel || !lock) return;
    var has = false; for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === lock) has = true;
    if (!has) {
      /* list load ho chuki hai par locked institute usme nahi => registration abhi band (limit/plan/band) */
      if (sel.options.length > 1 && sel.dataset.snapNote !== "1" && !document.getElementById("snap-lock-regnote") && sel.parentNode) {
        var nt = document.createElement("div"); nt.id = "snap-lock-regnote"; nt.style.cssText = "background:#fff4e5;color:#92400e;border-radius:8px;padding:8px 10px;font-size:.82rem;margin:6px 0;";
        nt.textContent = "Is institute me abhi naye registration band hain (limit poori / plan khatam / app band). Apne institute se sampark karein.";
        sel.parentNode.insertBefore(nt, sel); sel.dataset.snapNote = "1";
      }
      return;
    }
    var ex = document.getElementById("snap-lock-regnote"); if (ex) ex.remove();
    if (sel.value !== lock) { sel.value = lock; try { sel.dispatchEvent(new Event("change")); } catch (e) {} }
    var row = sel.closest ? sel.closest(".field-row") : null; if (row && row.style.display !== "none") row.style.display = "none";
  }

  /* ---------- full screen overlay ---------- */
  function overlay(kind, b, extra) {
    var key = kind + "|" + (b && b.name || "") + "|" + (extra || "");
    var old = document.getElementById("snap-lock-overlay");
    if (old && shownFor === key) return;
    old && old.remove(); shownFor = key;
    var o = document.createElement("div"); o.id = "snap-lock-overlay";
    o.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#0b0a1f;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:system-ui,sans-serif;";
    var logo = b && b.logoDataUrl ? '<img src="' + esc(b.logoDataUrl) + '" style="width:84px;height:84px;object-fit:contain;border-radius:18px;background:#fff;padding:6px;margin-bottom:14px;">' : "";
    var nm = esc(b && b.name || "Institute");
    var title, msg, btns;
    if (kind === "expired") {
      title = nm + " ka plan khatam ho gaya";
      msg = "Is institute ka subscription expire ho gaya hai. Renew ke liye apne institute (owner) se sampark karein. Renew hote hi app apne aap khul jaayega.";
      btns = '<button id="snap-lock-retry" style="margin-top:18px;padding:11px 22px;border:0;border-radius:10px;background:#4f46e5;color:#fff;font-size:1rem;">🔄 Dobara check karein</button>';
    } else if (kind === "suspended") {
      title = nm + " ka app abhi band hai";
      msg = "Is institute ka access abhi roka gaya hai. Kripya apne institute se sampark karein. Chalu hote hi app apne aap khul jaayega.";
      btns = '<button id="snap-lock-retry" style="margin-top:18px;padding:11px 22px;border:0;border-radius:10px;background:#4f46e5;color:#fff;font-size:1rem;">🔄 Dobara check karein</button>';
    } else {
      title = "Ye app sirf " + nm + " ke liye hai";
      msg = "Aap kisi doosre institute ke account se login hain. Is app me sirf " + nm + " ke Student/Admin chal sakte hain.";
      btns = '<button id="snap-lock-logout" style="margin-top:18px;padding:11px 22px;border:0;border-radius:10px;background:#dc2626;color:#fff;font-size:1rem;">Logout karein</button>';
    }
    o.innerHTML = '<div style="max-width:340px;">' + logo + '<h2 style="margin:0 0 10px;font-size:1.25rem;">' + title + '</h2><p style="margin:0;opacity:.8;line-height:1.5;font-size:.95rem;">' + msg + '</p>' + btns + "</div>";
    document.body.appendChild(o);
    var r = o.querySelector("#snap-lock-retry"); if (r) r.onclick = function () { r.textContent = "Check ho raha hai…"; (window.SnapBrand ? window.SnapBrand.load(extra, true) : Promise.resolve()).then(function () { location.reload(); }, function () { location.reload(); }); };
    var l = o.querySelector("#snap-lock-logout"); if (l) l.onclick = function () {
      try { if (typeof logoutStudent === "function") logoutStudent(); } catch (e) {}
      try { if (typeof logoutAdmin === "function") logoutAdmin(); } catch (e) {}
      setTimeout(function () { location.reload(); }, 300);
    };
  }
  function clearOverlay() { var o = document.getElementById("snap-lock-overlay"); if (o) { o.remove(); shownFor = ""; } }

  /* ---------- admin ke liye "plan jaldi khatam hoga" patti (sirf 7 din bache ho ya grace chal raha ho) ---------- */
  function banner(exp, grace) {
    var el = document.getElementById("snap-lock-banner");
    if (!exp) { if (el) el.remove(); return; }
    var left = Math.ceil((exp - Date.now()) / 86400000);
    if (left > 7) { if (el) el.remove(); return; }
    var txt = left > 0 ? "⚠️ Aapka plan " + left + " din me khatam hoga — renew ke liye Owner se sampark karein." :
      "⚠️ Plan khatam ho chuka hai — " + Math.max(0, Math.ceil((exp + grace - Date.now()) / 86400000)) + " din me app band ho jaayega. Abhi renew karwayein.";
    if (!el) { el = document.createElement("div"); el.id = "snap-lock-banner"; el.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:2147482000;background:#b45309;color:#fff;text-align:center;padding:8px 12px;font:600 .82rem system-ui,sans-serif;"; document.body.appendChild(el); }
    el.textContent = txt;
  }

  /* ---------- main check ---------- */
  function check() {
    if (!on() || !document.body) return;
    var lock = lockId(); if (lock) lockRegister(lock);
    if (isOwner()) { clearOverlay(); return; }
    var s = sessId(), id = lock || s.admin || s.student; if (!id) { clearOverlay(); return; }
    /* login kisi doosre institute ka hai -> lock wali app me nahi chalega */
    var other = (s.admin && s.admin !== id) || (s.student && s.student !== id);
    if (lock && other) { var bb = window.SnapBrand && window.SnapBrand.cached ? window.SnapBrand.cached(lock) : null; overlay("mismatch", bb || {}, lock); return; }
    if (!window.SnapBrand) return;
    var first = !forced; forced = true;
    window.SnapBrand.load(id, first).then(function (b) {
      if (!b) return;
      var exp = b.planExpiresAt || 0, grace = ((window.SNAP_CONFIG && window.SNAP_CONFIG.graceDays) != null ? window.SNAP_CONFIG.graceDays : 3) * 86400000;
      if (b.active === false) { banner(null); overlay("suspended", b, id); }
      else if (exp > 0 && Date.now() > exp + grace) { banner(null); overlay("expired", b, id); }
      else { clearOverlay(); banner(exp > 0 && s.admin ? exp : 0, grace); }
    });
  }

  window.SnapLock = { id: lockId, check: check };
  var n = 0, iv = setInterval(function () { check(); if (++n > 60) clearInterval(iv); }, 800);
  setInterval(check, 20000);
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) check(); });
  if (document.readyState !== "loading") check(); else document.addEventListener("DOMContentLoaded", check);
})();
