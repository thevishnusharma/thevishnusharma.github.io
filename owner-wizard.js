/* v219 Phase 3A — Naya Institute Wizard (Owner Panel).
   Maujooda cheezein hi use karta hai: institutes collection ka .add(), branding/plan ke wahi fields
   (brandColor, tagline, logoDataUrl, plan, studentLimit, storageLimitMB, youtubeChannelUrl) aur ownerApkInfo().
   Koi naya data model nahi. Kill-switch: SNAP_CONFIG.onboarding = false  -> purana single form.
   Billing / invoice / renewal ka kuch nahi. */
(function () {
  "use strict";
  if (window.ownerWizardOpen) return;
  var PLANS = ["Free", "Basic", "Pro", "Premium", "Custom"];
  var STEPS = ["Basics", "Branding", "Fair-use", "YouTube", "Drive", "Summary"];
  var YT_RE = /^https:\/\/(www\.|m\.)?youtube\.com\/[^\s]{1,150}$/i;
  var S = null, step = 0, box = null, busy = false, created = null;

  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function cfg() { return window.SNAP_CONFIG || {}; }
  function presets(p) { var o = (cfg().plans || {})[p] || {}; return { slim: o.studentLimit != null ? +o.studentLimit : 0, lim: +o.storageLimitMB || 0 }; }
  function classOpts() {
    try { if (typeof SAVYA_CLASS_OPTIONS !== "undefined" && SAVYA_CLASS_OPTIONS.length) return SAVYA_CLASS_OPTIONS; } catch (e) {}
    return [{ id: "class_9", label: "Class 9" }, { id: "class_10", label: "Class 10" }, { id: "class_11", label: "Class 11" }, { id: "class_12", label: "Class 12" }];
  }
  function fresh() { var p = presets("Free"); return { name: "", owner: "", classes: ["class_10"], color: "#4f46e5", tagline: "", logo: "", plan: "Free", slim: p.slim, lim: p.lim, yt: "" }; }
  function validColor(c) { return /^#[0-9a-f]{6}$/i.test(c || ""); }

  /* har step ki jaanch: galti ho to text, theek ho to "" */
  function check(i) {
    if (i === 0) {
      if (!S.name.trim()) return "Institute ka naam likhein.";
      if (!S.owner.trim()) return "Institute ke Owner ka naam likhein (ID Card ki signature mein yahi dikhega).";
      if (!S.classes.length) return "Kam se kam ek Class select karein.";
    }
    if (i === 1) { if (!validColor(S.color)) return "Rang sahi nahi hai."; if (S.tagline.length > 60) return "Tagline 60 akshar se chhoti rakhein."; }
    if (i === 2) { if (!(S.slim >= 0) || !(S.lim >= 0)) return "Limit 0 ya usse zyada honi chahiye."; }
    if (i === 3) { if (S.yt && !YT_RE.test(S.yt)) return "Sirf https://youtube.com/… link daalein (ya khaali chhodein)."; }
    return "";
  }

  /* data jo institute doc me jaayega (test me bhi yahi use hota hai) */
  function buildDoc() {
    var d = { name: S.name.trim(), ownerName: S.owner.trim(), active: true, allowedClasses: S.classes.slice(),
      brandColor: validColor(S.color) ? S.color : "#4f46e5", plan: S.plan, studentLimit: Math.max(0, Math.floor(+S.slim || 0)), storageLimitMB: Math.max(0, Math.floor(+S.lim || 0)) };
    if (S.tagline.trim()) d.tagline = S.tagline.trim();
    if (S.logo) d.logoDataUrl = S.logo;
    if (S.yt) d.youtubeChannelUrl = S.yt;
    return d;
  }

  function head() {
    var dots = STEPS.map(function (n, i) { return '<span style="flex:1;height:5px;border-radius:3px;background:' + (i <= step ? "#4f46e5" : "#e2e8f0") + '"></span>'; }).join("");
    return '<div style="display:flex;gap:4px;margin:2px 0 8px">' + dots + '</div><div style="font-size:.74rem;color:#64748b">Step ' + (step + 1) + " / " + STEPS.length + " — " + STEPS[step] + "</div>";
  }
  var L = 'font-size:.8rem;font-weight:600;display:block;margin-top:10px', I = "width:100%;padding:9px;margin:4px 0;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px";

  function body() {
    if (created) {
      var link = (cfg().webUrl || "https://thevishnusharma.github.io/").replace(/\/?$/, "/") + "?inst=" + encodeURIComponent(created);
      return '<h3 style="margin:6px 0">✅ Institute ban gaya</h3><div style="font-size:.84rem;line-height:1.55">Ab ye karein:<br>1. Institute card me <b>Admin Add</b> se uske admin ka email jodein.<br>2. Admin pehli baar login karke <b>Institute Settings → Mera Storage</b> me apna Drive jode.<br>3. Neeche ka link ya APK students/admin ko dein.</div>' +
        '<div style="margin:10px 0"><div style="font-size:.74rem;color:#666">App link</div><div style="display:flex;gap:6px"><input readonly value="' + esc(link) + '" style="flex:1;padding:7px;font-size:.78rem;min-width:0"><button type="button" class="owner-mini-btn" data-w="copy" data-v="' + esc(link) + '">Copy</button></div></div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="owner-mini-btn" data-w="apk">📱 APK / App Link</button><button type="button" class="owner-mini-btn" data-w="close" style="background:#4f46e5;color:#fff">Done</button></div>';
    }
    var h = head();
    if (step === 0) {
      h += '<label style="' + L + '">Institute ka naam</label><input data-f="name" style="' + I + '" maxlength="80" value="' + esc(S.name) + '" placeholder="Institute ka naam" autocomplete="off">' +
        '<label style="' + L + '">Institute ke Owner ka naam</label><input data-f="owner" style="' + I + '" maxlength="80" value="' + esc(S.owner) + '" placeholder="Owner ka naam" autocomplete="off">' +
        '<label style="' + L + '">Kin Classes ke liye eligible?</label><div style="display:flex;gap:10px;flex-wrap:wrap;margin:6px 0">' +
        classOpts().map(function (c) { return '<label style="font-size:.84rem"><input type="checkbox" data-c="' + esc(c.id) + '"' + (S.classes.indexOf(c.id) >= 0 ? " checked" : "") + "> " + esc(c.label) + "</label>"; }).join("") + "</div>";
    } else if (step === 1) {
      h += '<label style="' + L + '">App ka rang</label><input type="color" data-f="color" value="' + esc(S.color) + '" style="width:100%;height:42px;margin:4px 0">' +
        '<label style="' + L + '">Tagline (optional)</label><input data-f="tagline" style="' + I + '" maxlength="60" value="' + esc(S.tagline) + '" placeholder="jaise: Success Starts Here">' +
        '<label style="' + L + '">Logo (square, chhota)</label><input type="file" accept="image/*" data-w="logo" style="margin:4px 0">' +
        '<div style="font-size:.74rem;color:#64748b;margin-top:8px">Preview</div><div id="ow-prev" style="display:flex;gap:10px;align-items:center;border-radius:12px;padding:10px;color:#fff;background:' + esc(S.color) + '">' +
        '<img id="ow-logo" alt="" src="' + esc(S.logo) + '" style="width:40px;height:40px;object-fit:contain;border-radius:8px;background:#fff;' + (S.logo ? "" : "display:none") + '"><div><b id="ow-n">' + esc(S.name || "Institute") + '</b><div id="ow-t" style="font-size:.74rem;opacity:.9">' + esc(S.tagline) + "</div></div></div>";
    } else if (step === 2) {
      h += '<label style="' + L + '">Fair-use tier</label><select data-f="plan" style="' + I + '">' + PLANS.map(function (p) { return "<option" + (p === S.plan ? " selected" : "") + ">" + p + "</option>"; }).join("") + "</select>" +
        '<label style="' + L + '">Student limit (0 = bina limit)</label><input type="number" min="0" data-f="slim" style="' + I + '" value="' + (+S.slim || 0) + '">' +
        '<label style="' + L + '">Drive storage limit MB (0 = bina limit)</label><input type="number" min="0" data-f="lim" style="' + I + '" value="' + (+S.lim || 0) + '">' +
        '<div style="font-size:.74rem;color:#64748b">Ye sirf fair-use limit hai. App free hai — koi billing / invoice / renewal nahi. Expiry baad me "Branding & Plan" se lag sakti hai.</div>';
    } else if (step === 3) {
      h += '<label style="' + L + '">Institute ka YouTube channel link (optional)</label><input type="url" data-f="yt" style="' + I + '" value="' + esc(S.yt) + '" placeholder="https://www.youtube.com/@aapkachannel"><div style="font-size:.74rem;color:#64748b">Student ko batch page par "Channel dekho" dikhega. Baad me bhi badal sakte hain.</div>';
    } else if (step === 4) {
      h += '<div style="font-size:.86rem;line-height:1.6;margin-top:8px;background:#f4f4ff;border-radius:10px;padding:10px"><b>Apna Google Drive (admin khud jodega)</b><br>Institute ka admin pehli baar login par <b>Institute Settings → Mera Storage</b> me Drive jodta hai — Google ka login Owner uski taraf se nahi kar sakta.<br><br><b>Sujhaav:</b> institute ke naam ka <u>alag Google account</u> banayein (jaise <i>institutename.coaching@gmail.com</i>), personal account se mat jodein — taaki admin chhode to files uske saath na jaayein.<br><br>' +
        (cfg().googleClientId ? "Google Client ID set hai." : "⚠️ Abhi <code>googleClientId</code> khaali hai, isliye Drive jodna tab tak chalu nahi hoga. Guide: <code>docs/setup/DRIVE_SETUP_HINDI.md</code>. Links/YouTube tab bhi chalte rahenge.") + "</div>";
    } else {
      var d = buildDoc();
      h += '<div style="font-size:.86rem;line-height:1.7;margin-top:8px"><b>' + esc(d.name) + "</b> — Owner: " + esc(d.ownerName) + "<br>Classes: " + esc(d.allowedClasses.join(", ")) + '<br>Rang: <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:' + esc(d.brandColor) + ';vertical-align:middle"></span> • Tagline: ' + esc(d.tagline || "—") + " • Logo: " + (d.logoDataUrl ? "✅" : "—") +
        "<br>Tier: <b>" + esc(d.plan) + "</b> • Students " + (d.studentLimit || "∞") + " • Storage " + (d.storageLimitMB ? d.storageLimitMB + " MB" : "∞") + "<br>YouTube: " + (d.youtubeChannelUrl ? "✅" : "—") + " • Drive: admin baad me jodega</div>";
    }
    h += '<div id="ow-err" style="color:#dc2626;font-size:.8rem;min-height:18px;margin-top:6px"></div>' +
      '<div style="display:flex;gap:8px;justify-content:space-between"><button type="button" class="owner-mini-btn" data-w="' + (step ? "back" : "close") + '">' + (step ? "← Peeche" : "Cancel") + '</button>' +
      '<button type="button" class="owner-mini-btn" data-w="next" style="background:#4f46e5;color:#fff"' + (busy ? " disabled" : "") + ">" + (step === STEPS.length - 1 ? (busy ? "Ban raha hai…" : "Institute banao") : "Aage →") + "</button></div>";
    return h;
  }

  function render() { if (box) box.firstChild.innerHTML = body(); }
  function err(t) { var e = box && box.querySelector("#ow-err"); if (e) e.textContent = t || ""; }
  function close() { if (box) box.remove(); box = null; S = null; created = null; busy = false; }

  function readLogo(f) {
    var im = new Image(), u = URL.createObjectURL(f);
    im.onload = function () {
      var c = document.createElement("canvas"), sc = Math.min(1, 256 / Math.max(im.width, im.height));
      c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      var l = c.toDataURL("image/png"); if (l.length > 150000) l = c.toDataURL("image/jpeg", .85);
      S.logo = l; URL.revokeObjectURL(u); var p = box && box.querySelector("#ow-logo"); if (p) { p.src = l; p.style.display = ""; }
    };
    im.onerror = function () { err("Image nahi khuli"); }; im.src = u;
  }

  function create() {
    var db = (typeof ownerGetDb === "function") ? ownerGetDb() : null;
    if (!db) { err("Owner login chahiye."); return; }
    busy = true; render();
    var d = buildDoc(); d.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    db.collection("institutes").add(d).then(function (ref) { created = ref.id; busy = false; render(); }, function (e) { busy = false; render(); err("Institute nahi bana: " + (e && (e.message || e.code) || e)); });
  }

  function onClick(e) {
    var b = e.target.closest("[data-w]"); if (!b || !S && !created) return; var w = b.getAttribute("data-w");
    if (w === "close") return close();
    if (w === "copy") { var v = b.getAttribute("data-v"); (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { b.textContent = "Copied"; }, function () { prompt("Copy karein:", v); }); return; }
    if (w === "apk") { var id = created; close(); try { ownerApkInfo(id); } catch (x) {} return; }
    if (w === "back") { step = Math.max(0, step - 1); return render(); }
    if (w === "next") {
      var m = check(step); if (m) return err(m);
      if (step < STEPS.length - 1) { step++; return render(); }
      if (!busy) create();
    }
  }
  function onInput(e) {
    var t = e.target; if (!S) return;
    var f = t.getAttribute("data-f"), c = t.getAttribute("data-c"), w = t.getAttribute("data-w");
    if (c) { var i = S.classes.indexOf(c); if (t.checked && i < 0) S.classes.push(c); if (!t.checked && i >= 0) S.classes.splice(i, 1); return; }
    if (w === "logo") { if (t.files && t.files[0]) readLogo(t.files[0]); return; }
    if (!f) return;
    if (f === "slim" || f === "lim") S[f] = Math.max(0, +t.value || 0); else S[f] = t.value;
    if (f === "plan") { var p = presets(S.plan); if (S.plan !== "Custom") { S.slim = p.slim; S.lim = p.lim; } render(); return; }
    if (f === "color" || f === "tagline") { var pv = box.querySelector("#ow-prev"); if (pv) pv.style.background = S.color; var tt = box.querySelector("#ow-t"); if (tt) tt.textContent = S.tagline; }
  }

  window.ownerWizardOpen = function () {
    close(); S = fresh(); step = 0; created = null;
    box = document.createElement("div"); box.id = "owner-wizard";
    box.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px;";
    box.innerHTML = '<div style="background:#fff;color:#111;border-radius:14px;max-width:440px;width:100%;max-height:92vh;overflow:auto;padding:16px;box-sizing:border-box"></div>';
    box.addEventListener("click", onClick); box.addEventListener("input", onInput); box.addEventListener("change", onInput);
    document.body.appendChild(box); render();
  };
  window.__ownerWizardTest = { check: check, buildDoc: buildDoc, set: function (s) { S = Object.assign(fresh(), s); }, YT_RE: YT_RE };
})();
