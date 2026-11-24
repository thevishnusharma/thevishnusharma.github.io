/* v325 — Multi-institute student identity (SnapKey)
   Ek hi mobile number alag-alag institute me ALAG identity (alag naam/class/password/PIN/result) rakh sake.
   Idea: student ki "key" (jo pehle seedha mobile hota tha) ab opaque hai:
     - purane students  : key = mobile            (kuch nahi badla, kabhi migrate nahi hote)
     - naye registration: key = <instituteId>__<mobile>   (sirf jab SNAP_CONFIG.multiInstitute === true)
   Rules/Worker/Firestore ke liye key sirf ek string hai, isliye students/{key}, studentSecrets/{key}, results.mobile == key sab pehle jaise.
   Switch OFF (default) ho to ye file kuch nahi badalti: login/register bilkul purane tareeke se. Kabhi throw nahi karti. */
(function () {
  "use strict";
  var KEY_RE = /^[A-Za-z0-9_-]{1,64}__\d{10}$/, LAST = "snap_last_inst";
  function cfg() { return window.SNAP_CONFIG || {}; }
  function on() { return cfg().multiInstitute === true; }
  function isKey(k) { return typeof k === "string" && KEY_RE.test(k); }
  function phone(k) { k = String(k == null ? "" : k); return isKey(k) ? k.slice(-10) : k; }           /* display ke liye asli mobile */
  function compose(inst, ph) { return inst + "__" + ph; }
  function validInst(i) { return typeof i === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(i); }
  function remember(i) { try { if (validInst(i)) localStorage.setItem(LAST, i); } catch (e) {} }
  /* institute ka apna link/app: ?inst=<id> (ya ?institute=<id>) ya app-config.js me instituteId. Wahi "auto" mode hai. */
  function preset() {
    try {
      var q = new URLSearchParams(window.location.search), v = q.get("inst") || q.get("institute") || cfg().instituteId || "";
      if (validInst(v)) { try { sessionStorage.setItem("snap_preset_inst", v); } catch (e) {} return v; }
      var s = ""; try { s = sessionStorage.getItem("snap_preset_inst") || ""; } catch (e) {}
      return validInst(s) ? s : "";
    } catch (e) { return ""; }
  }
  /* login/forgot form me kaunsa institute: preset ho to wahi, warna dropdown, warna "" (purana single-institute tareeka) */
  function selected(scope) {
    if (!on()) return "";
    var p = preset(); if (p) return p;
    var el = document.getElementById(scope === "forgot" ? "forgot-institute" : "login-institute");
    var v = el && el.value || ""; return validInst(v) ? v : "";
  }
  function denied(e) { return !!(e && (e.code === "permission-denied" || /permission/i.test(String(e.message || "")))); }
  async function getDoc(db, col, id) { try { var d = await db.collection(col).doc(id).get(); return d.exists ? d.data() : null; } catch (e) { if (denied(e)) return undefined; throw e; } }

  /* LEGACY (client-side) login: institute ke hisaab se key. Pehle composite, phir purani key (sirf jab uska institute wahi ho).
     Worker mode (serverAuth) me ye kaam Worker karta hai (admin reads), isliye wahan ye call nahi hota. */
  async function loginKey(db, ph, inst) {
    if (!on() || !validInst(inst)) return ph;
    var ck = compose(inst, ph), c = await getDoc(db, "students", ck);
    if (c) return ck;
    var l = await getDoc(db, "students", ph);
    if (l && (!l.instituteId || l.instituteId === inst)) return ph;
    return ck;                                    /* kuch nahi mila -> aage "not registered" message apne aap */
  }
  /* REGISTER: naya student hamesha (switch ON ho to) composite key par. exists = us institute me pehle se registered.
     permission-denied (profileLockdown) me existence chhupi rehti hai -> exists=false, duplicate ka faisla Worker karta hai. */
  async function registerKey(db, inst, ph) {
    if (!on() || !validInst(inst)) { var d0 = await getDoc(db, "students", ph); return { key: ph, exists: !!d0 }; }
    var ck = compose(inst, ph), c = await getDoc(db, "students", ck);
    if (c) return { key: ck, exists: true };
    var l = await getDoc(db, "students", ph);
    return { key: ck, exists: !!(l && l.instituteId === inst) };
  }

  /* institute dropdown (login + forgot): preset ho to chhupa do; warna active institutes ki list */
  var listP = null;
  function loadList(db) {
    if (listP) return listP;
    listP = Promise.resolve(window.vishnuFirebase && window.vishnuFirebase.authReady).catch(function () {}).then(function () {
      return db.collection("institutes").where("active", "==", true).get();
    }).then(function (s) { return s.docs.map(function (d) { var x = d.data() || {}; return { id: d.id, name: x.name || d.id }; }); }).catch(function () { listP = null; return []; });
    return listP;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  async function mountPickers() {
    try {
      if (!on()) return;
      var db = typeof window.getDB === "function" ? window.getDB() : (window.vishnuFirebase && window.vishnuFirebase.db);
      ["login", "forgot"].forEach(function (s) { var row = document.getElementById(s + "-institute-row"); if (row) row.classList.add("hidden"); });
      if (preset() || !db) return;                                                  /* link/app se institute tay: dropdown ki zaroorat nahi */
      var list = await loadList(db), last = ""; try { last = localStorage.getItem(LAST) || ""; } catch (e) {}
      if (!list.length) return;
      ["login", "forgot"].forEach(function (s) {
        var sel = document.getElementById(s + "-institute"), row = document.getElementById(s + "-institute-row"); if (!sel || !row) return;
        sel.innerHTML = '<option value="">— Institute chunein —</option>' + list.map(function (i) { return '<option value="' + esc(i.id) + '">' + esc(i.name) + "</option>"; }).join("");
        if (last && list.some(function (i) { return i.id === last; })) sel.value = last;
        row.classList.remove("hidden");
      });
    } catch (e) {}
  }
  window.SnapKey = { on: on, isKey: isKey, phone: phone, compose: compose, preset: preset, selected: selected, remember: remember, loginKey: loginKey, registerKey: registerKey, mountPickers: mountPickers };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mountPickers, 600); });
  else setTimeout(mountPickers, 600);
  /* auth panel dobara dikhne par (logout ke baad) phir se bhar do */
  document.addEventListener("click", function (e) { var t = e.target; if (t && t.id && /student-(login|register)-mode-btn/.test(t.id)) setTimeout(mountPickers, 50); }, true);
})();
