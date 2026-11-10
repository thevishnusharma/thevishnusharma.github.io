/* v231 — Exam Registration (SnapReg): test banne se PEHLE students register + roll shuffle + admit card publish.
   Flow:  📝 Registration banao -> students jodo (roll abhi NAHI bante) -> jab chaho "Publish":
          sabke Roll No RANDOM shuffle hokar bante hain (institute-wise cluster nahi) + Admit Card student app me + PDF.
          Baad me Exam banao -> "Registration se jodein" -> wahi roll/students exam roster me aa jaate hain (exam-roster.js linkRegistration).
   Admit card par SET nahi chhapta (set sirf scan-verification ke liye roll se nikalta hai).
   v232: Students ka app par registered hona ZAROORI NAHI. Admin khud naam/mobile/father/class/DOB/school + photo bharta hai
         (ya Excel/Sheet se paste) ya auto-generated Google Form se students khud register hote hain (Apps Script web-app se pull).
   Data:  examRegistrations/{id}               = { name,date,time,reportTime,venue,notes,rollDigits,published,count,instituteId,instituteName, formEndpoint,formToken,formId,formUrl,formEditUrl }
          examRegistrations/{id}/roster/main   = { list:[{name,mobile,father,cls,dob,group,hasPhoto,roll?}], retired:[roll,...] }
          examRegistrations/{id}/photos/{mobile} = { photo: dataURL (240x300 jpeg) }
          studentAdmitCards/{regId}_{mobile}   = student ko dikhne wala card (publish par bantा hai)
   Kill-switch: SNAP_CONFIG.registration=false (ya roster=false) -> panel nahi khulta. */
(function (root) {
  "use strict";
  var REGS = "examRegistrations", CARDS = "studentAdmitCards", MAX = 3000;

  /* ======================= PURE LOGIC (tests me bhi chalta hai) ======================= */
  function pad(n, d) { return String(n).padStart(d, "0"); }
  function cleanMobile(m) { return String(m || "").replace(/\D/g, "").slice(-10); }
  function digitsOf(v) { return Math.max(1, Math.min(5, Number(v) || 3)); }
  /* crypto se random (predictable nahi); tests me rng inject hota hai */
  function makeRng() {
    var c = typeof globalThis !== "undefined" && globalThis.crypto;
    if (c && c.getRandomValues) return function () { var a = new Uint32Array(1); c.getRandomValues(a); return a[0] / 4294967296; };
    return Math.random;
  }
  function byName(a, b) { return String(a.name || "").localeCompare(String(b.name || ""), "en", { sensitivity: "base" }); }
  function byRoll(a, b) { return (parseInt(a.roll, 10) || 0) - (parseInt(b.roll, 10) || 0); }

  /* students ko draft me jodo (roll NAHI milta). people:[{name,mobile,classId,cls,group}] -> {list,added,skipped,error} */
  function addDraft(existing, people) {
    var list = (existing || []).slice(), have = {}, skipped = 0, fresh = [];
    list.forEach(function (e) { have[e.mobile] = 1; });
    (people || []).forEach(function (p) {
      var m = cleanMobile(p.mobile);
      if (m.length !== 10 || have[m]) { skipped++; return; }
      have[m] = 1;
      fresh.push({ name: String(p.name || "").trim().slice(0, 60) || "Student", mobile: m, father: String(p.father || "").trim().slice(0, 60), cls: String(p.cls || "").trim().slice(0, 40), dob: normDate(p.dob), group: String(p.group || "").trim().slice(0, 60), hasPhoto: !!p.hasPhoto });
    });
    if (list.length + fresh.length > MAX) return { list: list, added: 0, skipped: skipped, error: { code: "TOO_MANY", max: MAX } };
    fresh.sort(byName);
    return { list: list.concat(fresh), added: fresh.length, skipped: skipped, error: null };
  }

  /* Jinke paas roll nahi hai unhe roll do.
     - PEHLI baar (kisi ke paas roll nahi): 1..N ka poora shuffle (permutation) — sab institute mix, koi pattern nahi.
       Roll 1..N compact rehte hain, isliye roll-order me baithne par sets (A,B,C...) baari-baari aate hain.
     - BAAD me (publish ke baad naya student): bache hue numbers me se RANDOM; hataye gaye (retired) roll dobara nahi milte.
     opts:{rollDigits, rng, retired:[...]}  -> {list,assigned,error}; list roll se sorted jab sabko roll mil jaye */
  function assignRolls(list, opts) {
    opts = opts || {};
    var rng = opts.rng || makeRng(), digits = digitsOf(opts.rollDigits), cap = Math.pow(10, digits) - 1;
    var used = {}, retired = {}, need = [], out = (list || []).map(function (e) { var c = {}; for (var k in e) c[k] = e[k]; return c; });
    (opts.retired || []).forEach(function (r) { retired[parseInt(r, 10)] = 1; });
    var haveAny = false;
    out.forEach(function (e, i) { if (e.roll) { used[parseInt(e.roll, 10)] = 1; haveAny = true; } else need.push(i); });
    if (!need.length) return { list: out.sort(byRoll), assigned: 0, error: null };
    var pool = [], n, first = !haveAny;
    if (first) { if (need.length > cap) return { list: list, assigned: 0, error: { code: "DIGITS_FULL", need: String(need.length).length } }; for (n = 1; n <= need.length; n++) pool.push(n); }
    else { for (n = 1; n <= cap; n++) if (!used[n] && !retired[n]) pool.push(n); if (pool.length < need.length) return { list: list, assigned: 0, error: { code: "DIGITS_FULL", need: digits + 1 } }; }
    for (var i = 0; i < need.length; i++) {
      var j = i + Math.floor(rng() * (pool.length - i)), t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      out[need[i]].roll = pad(pool[i], digits);
    }
    return { list: out.sort(byRoll), assigned: need.length, error: null };
  }
  function groupsOf(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (e) { var g = e.group || ""; if (g && !seen[g]) { seen[g] = 1; out.push(g); } });
    return out.sort();
  }
  /* date ko ISO (YYYY-MM-DD) banao: 2008-03-12 / 12/03/2008 / 12-3-2008 / 12.03.2008 (DD/MM/YYYY maana jata hai). Galat => "" */
  function normDate(v) {
    var t = String(v || "").trim(), y, mo, d, m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(t))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else return "";
    if (y < 1950 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return "";
    return y + "-" + pad(mo, 2) + "-" + pad(d, 2);
  }
  /* Excel / Sheet se paste: har line me tab ya comma se alag columns.
     Order: Naam, [Mobile kahin bhi], Father, Class, DOB, School/Institute  (mobile ka column khud pehchana jata hai; header line chhod di jati hai)
     -> {people:[{name,mobile,father,cls,dob,group}], bad:[line]} */
  function parseRows(text) {
    var people = [], bad = [];
    String(text || "").split(/\r?\n/).forEach(function (line, idx) {
      if (!line.trim()) return;
      var f = line.split(/\t|,|;|\|/).map(function (x) { return x.trim(); }), mi = -1, i;
      for (i = 0; i < f.length; i++) if (f[i].replace(/[\s+\-()]/g, "").replace(/\D/g, "").length >= 10 && f[i].replace(/\D/g, "").length >= 10) { mi = i; break; }
      if (mi < 0) { if (!(idx === 0 && /name|naam/i.test(line))) bad.push(line.slice(0, 40)); return; }
      var mobile = f[mi].replace(/\D/g, "").slice(-10), lead = f[mi].replace(/[\d+()\-]/g, " ").replace(/\s+/g, " ").trim(), rest = f.filter(function (_, k) { return k !== mi; });
      if (lead) rest.unshift(lead);
      if (!rest[0]) { bad.push(line.slice(0, 40)); return; }
      people.push({ name: rest[0], mobile: mobile, father: rest[1] || "", cls: rest[2] || "", dob: normDate(rest[3]), group: rest[4] || "" });
    });
    return { people: people, bad: bad };
  }
  /* Google Form ke sawaal (script aur import dono yahi titles use karte hain) */
  var FORM_Q = { name: "Student ka Naam", mobile: "Mobile Number (10 digit)", father: "Father / Guardian ka Naam", cls: "Class", dob: "Date of Birth", school: "School / Institute ka Naam" };
  function rowsToPeople(rows) {
    var out = [];
    (rows || []).forEach(function (r) {
      var m = cleanMobile(r[FORM_Q.mobile]), nm = String(r[FORM_Q.name] || "").trim(); if (m.length !== 10 || !nm) return;
      out.push({ name: nm, mobile: m, father: r[FORM_Q.father] || "", cls: r[FORM_Q.cls] || "", dob: normDate(r[FORM_Q.dob]), group: r[FORM_Q.school] || "" });
    });
    return out;
  }
  /* Apps Script (ek baar paste + deploy). Web-app GET: ping / create (naya Google Form) / responses / close. Token se surakshit. */
  function buildScript(token) {
    var L = [
      "// The Vishnu Sharma — Registration Google Form helper (ek baar deploy karein)",
      "var TOKEN = " + JSON.stringify(String(token)) + ";",
      "var Q = " + JSON.stringify(FORM_Q) + ";",
      "function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }",
      "function doGet(e) {",
      "  var p = (e && e.parameter) || {};",
      "  try {",
      "    if (p.token !== TOKEN) return out({ ok: false, error: 'Token galat hai' });",
      "    if (p.action === 'ping') return out({ ok: true });",
      "    if (p.action === 'create') return out(createForm(p.title, p.desc));",
      "    if (p.action === 'responses') return out(getResponses(p.formId));",
      "    if (p.action === 'close') { FormApp.openById(p.formId).setAcceptingResponses(false); return out({ ok: true }); }",
      "    return out({ ok: false, error: 'Unknown action' });",
      "  } catch (err) { return out({ ok: false, error: String(err) }); }",
      "}",
      "function createForm(title, desc) {",
      "  var f = FormApp.create(title || 'Exam Registration');",
      "  f.setDescription(desc || 'Test ke liye registration. Sahi jaankari bharein — isi se Admit Card banega.');",
      "  f.setConfirmationMessage('Aapka registration ho gaya. Admit Card test se pehle aapke institute se milega.');",
      "  f.setCollectEmail(false);",
      "  f.addTextItem().setTitle(Q.name).setRequired(true);",
      "  var m = f.addTextItem().setTitle(Q.mobile).setRequired(true);",
      "  m.setValidation(FormApp.createTextValidation().setHelpText('10 digit ka mobile number likhein').requireTextMatchesPattern('[6-9][0-9]{9}').build());",
      "  f.addTextItem().setTitle(Q.father).setRequired(false);",
      "  f.addTextItem().setTitle(Q.cls).setRequired(false);",
      "  f.addDateItem().setTitle(Q.dob).setRequired(false);",
      "  f.addTextItem().setTitle(Q.school).setRequired(true);",
      "  return { ok: true, formId: f.getId(), url: f.getPublishedUrl(), editUrl: f.getEditUrl() };",
      "}",
      "function getResponses(id) {",
      "  var f = FormApp.openById(id), rows = [];",
      "  f.getResponses().forEach(function (r) {",
      "    var o = { ts: r.getTimestamp().getTime() };",
      "    r.getItemResponses().forEach(function (ir) { o[ir.getItem().getTitle()] = ir.getResponse(); });",
      "    rows.push(o);",
      "  });",
      "  return { ok: true, rows: rows, accepting: f.isAcceptingResponses() };",
      "}"
    ];
    return L.join("\n");
  }
  function csvCell(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
  var pure = { pad: pad, cleanMobile: cleanMobile, addDraft: addDraft, assignRolls: assignRolls, groupsOf: groupsOf, parseRows: parseRows, normDate: normDate, rowsToPeople: rowsToPeople, buildScript: buildScript, FORM_Q: FORM_Q, makeRng: makeRng, csvCell: csvCell, MAX: MAX };
  if (typeof module !== "undefined" && module.exports) module.exports = { pure: pure };
  if (typeof document === "undefined") return;

  /* ======================= BROWSER PART ======================= */
  var S = { regs: [], reg: null, R: null, tq: "", pdfGroup: "", photos: {}, edit: null, photo: null, setup: false }, OV = null, EP_KEY = "snap_reg_gs";
  function on() { return !(root.SNAP_CONFIG && (root.SNAP_CONFIG.registration === false || root.SNAP_CONFIG.roster === false)); }
  function DB() { return typeof root.getDB === "function" ? root.getDB() : null; }
  function FV() { return root.firebase.firestore.FieldValue; }
  function iidNow() { try { return typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null; } catch (e) { return null; } }
  function h(t, a, c) {
    var e = document.createElement(t);
    if (a) for (var k in a) { if (k === "class") e.className = a[k]; else if (k === "text") e.textContent = a[k]; else if (k.slice(0, 2) === "on") e[k] = a[k]; else e.setAttribute(k, a[k]); }
    (c || []).forEach(function (x) { if (x != null) e.appendChild(typeof x === "string" ? document.createTextNode(x) : x); });
    return e;
  }
  function $(id) { return document.getElementById(id); }
  function val(id) { var e = $(id); return e ? (e.value || "").trim() : ""; }
  function note(msg) { var n = $("reg-notice"); if (!n) return; n.textContent = msg || ""; n.hidden = !msg; }
  function prettyDate(d) { return root.SnapAdmit && root.SnapAdmit.prettyDate ? root.SnapAdmit.prettyDate(d) : String(d || ""); }
  function safeName(s) { return String(s || "registration").replace(/[^\w-]+/g, "-").slice(0, 50); }

  /* ---------- Firestore ---------- */
  function loadRegs() {
    var d = DB(); if (!d) return Promise.resolve([]);
    var iid = iidNow(), q = iid ? d.collection(REGS).where("instituteId", "==", iid) : d.collection(REGS);
    return q.get().then(function (snap) {
      S.regs = snap.docs.map(function (x) { var v = x.data(); v.id = x.id; return v; }).sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
      return S.regs;
    }).catch(function (e) { note("❌ Registrations load nahi hue: " + (e.code || e.message || e)); return []; });
  }
  function loadReg(id) {
    var d = DB(), ref = d.collection(REGS).doc(id);
    return Promise.all([ref.get(), ref.collection("roster").doc("main").get()]).then(function (r) {
      if (!r[0].exists) throw new Error("Registration nahi mili.");
      S.reg = r[0].data(); S.reg.id = id; S.photos = {};
      var v = r[1].exists ? r[1].data() : {}; S.R = { list: v.list || [], retired: v.retired || [] };
    });
  }
  function saveRoster() {
    var d = DB(), reg = S.reg; if (!d) { alert("Server se connect nahi ho paya — internet check karein."); return Promise.resolve(false); }
    var ref = d.collection(REGS).doc(reg.id);
    return ref.collection("roster").doc("main").set({ list: S.R.list, retired: S.R.retired, updatedAt: FV().serverTimestamp() })
      .then(function () { reg.count = S.R.list.length; return ref.update({ count: reg.count, updatedAt: FV().serverTimestamp() }); })
      .then(function () { return true; }).catch(function (e) { alert("Save nahi ho paya: " + (e.message || e)); return false; });
  }
  function patchReg(p) {
    var d = DB(); if (!d) return Promise.resolve(false);
    var o = {}; for (var k in p) o[k] = p[k]; o.updatedAt = FV().serverTimestamp();
    return d.collection(REGS).doc(S.reg.id).update(o).then(function () { for (var k in p) S.reg[k] = p[k]; return true; }).catch(function (e) { alert("Save nahi ho paya: " + (e.message || e)); return false; });
  }
  /* photos: alag subcollection (roster doc 1MB limit se bachne ke liye) */
  function savePhoto(m, data) { var d = DB(); S.photos[m] = data; return d.collection(REGS).doc(S.reg.id).collection("photos").doc(m).set({ photo: data, updatedAt: FV().serverTimestamp() }); }
  function ensurePhotos(list) {
    var d = DB(), need = list.filter(function (e) { return e.hasPhoto && !S.photos[e.mobile]; }), chain = Promise.resolve();
    if (!d) return chain;
    for (var i = 0; i < need.length; i += 25) (function (part) {
      chain = chain.then(function () {
        return Promise.all(part.map(function (e) { return d.collection(REGS).doc(S.reg.id).collection("photos").doc(e.mobile).get().then(function (s) { if (s.exists) S.photos[e.mobile] = s.data().photo; }).catch(function () {}); }));
      });
    })(need.slice(i, i + 25));
    return chain;
  }
  function resizePhoto(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = function () { rej(new Error("Photo padhi nahi gayi")); };
      fr.onload = function () {
        var im = new Image(); im.onerror = function () { rej(new Error("Ye photo khul nahi payi")); };
        im.onload = function () {
          var W = 240, H = 300, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
          var c = cv.getContext("2d"), r = Math.max(W / im.width, H / im.height), sw = W / r, sh = H / r;
          c.fillStyle = "#fff"; c.fillRect(0, 0, W, H); c.drawImage(im, (im.width - sw) / 2, (im.height - sh) * 0.2, sw, sh, 0, 0, W, H);
          res(cv.toDataURL("image/jpeg", 0.82));
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function instName(reg) {
    if (reg.instituteName) return Promise.resolve(reg.instituteName);
    var n = ""; try { n = typeof getCachedAdminInstituteName === "function" ? getCachedAdminInstituteName() : ""; } catch (e) {}
    if (n) return Promise.resolve(n);
    var d = DB(), iid = reg.instituteId || iidNow(); if (!d || !iid) return Promise.resolve("");
    return d.collection("institutes").doc(iid).get().then(function (s) { return s.exists && s.data().name || ""; }).catch(function () { return ""; });
  }
  /* student-app wale card doc me photo nahi jaati (studentAdmitCards sab signed-in users padh sakte hain); photo sirf PDF/preview me */
  function cardFor(reg, en, inst) {
    return { examId: reg.id, registrationId: reg.id, instituteName: inst || reg.instituteName || "", examName: reg.name || "", className: en.cls || "", school: en.group || "", fatherName: en.father || "", dob: en.dob || "", date: reg.date || "", time: reg.time || "", reportTime: reg.reportTime || "", venue: reg.venue || "", notes: reg.notes || "", name: en.name, roll: en.roll, mobile: en.mobile };
  }
  function writeCards(reg, list, inst) {
    var d = DB(), iid = reg.instituteId || iidNow(), failed = 0, chain = Promise.resolve();
    function docOf(en) { var c = cardFor(reg, en, inst); c.instituteId = iid || null; c.issuedAt = FV().serverTimestamp(); return [d.collection(CARDS).doc(reg.id + "_" + en.mobile), c]; }
    for (var i = 0; i < list.length; i += 400) (function (part) {
      chain = chain.then(function () {
        var b = d.batch(); part.forEach(function (en) { var x = docOf(en); b.set(x[0], x[1]); });
        return b.commit().catch(function () {
          var k = Promise.resolve();
          part.forEach(function (en) { k = k.then(function () { var x = docOf(en); return x[0].set(x[1]).catch(function () { failed++; }); }); });
          return k;
        });
      });
    })(list.slice(i, i + 400));
    return chain.then(function () { return failed; });
  }

  /* ---------- actions ---------- */
  function createReg() {
    var name = val("reg-new-name"), date = $("reg-new-date").value || "", d = DB();
    if (!name) { note("⚠️ Registration ka naam likhein."); return; }
    if (!d) { alert("Server se connect nahi ho paya — internet check karein."); return; }
    var iid = iidNow(), ref = d.collection(REGS).doc(), cn = ""; try { cn = typeof getCachedAdminInstituteName === "function" ? getCachedAdminInstituteName() : ""; } catch (e) {}
    var doc = { name: name, date: date, time: "", reportTime: "", venue: "", notes: "", rollDigits: digitsOf($("reg-new-digits").value), published: false, count: 0, instituteName: cn || "", createdAt: FV().serverTimestamp(), updatedAt: FV().serverTimestamp() };
    if (iid) doc.instituteId = iid;
    note("⏳ Ban rahi hai...");
    ref.set(doc).then(function () { $("reg-new-name").value = ""; return openReg(ref.id); }).catch(function (e) { note("❌ Registration nahi bani: " + (e.code || e.message || e)); });
  }
  function openReg(id) {
    note("⏳ Load ho raha hai...");
    return loadReg(id).then(function () { S.tq = ""; S.pdfGroup = ""; S.edit = null; S.photo = null; S.setup = false; showView("cur"); note(""); resetForm(true); renderCur(); }).catch(function (e) { note("❌ " + (e.message || e)); });
  }
  function deleteReg(r) {
    if (!confirm("\"" + (r.name || "Registration") + "\" delete karein?" + (r.published ? "\nStudents ke published Admit Card bhi hat jaayenge. (Is se jude exams ka roster waisa hi rahega.)" : ""))) return;
    var d = DB(); if (!d) return;
    note("⏳ Delete ho raha hai...");
    var ref = d.collection(REGS).doc(r.id);
    ref.collection("roster").doc("main").get().then(function (s) {
      var list = s.exists ? (s.data().list || []) : [], chain = Promise.resolve();
      for (var i = 0; i < list.length; i += 200) (function (part) { chain = chain.then(function () { var b = d.batch(); part.forEach(function (en) { if (r.published) b.delete(d.collection(CARDS).doc(r.id + "_" + en.mobile)); if (en.hasPhoto) b.delete(ref.collection("photos").doc(en.mobile)); }); return b.commit().catch(function () {}); }); })(list.slice(i, i + 200));
      return chain;
    }).then(function () { return ref.collection("roster").doc("main").delete().catch(function () {}); })
      .then(function () { return ref.delete(); })
      .then(function () { note("🗑️ Registration delete ho gayi."); return refreshList(); }).catch(function (e) { note("❌ Delete nahi hua: " + (e.code || e.message || e)); });
  }
  /* students jodo. photoMap={mobile:dataURL} optional. Publish ho chuka ho to naye students ko turant random roll + card */
  function addPeople(people, photoMap, prefix) {
    var reg = S.reg, R = S.R, before = {}; R.list.forEach(function (e) { before[e.mobile] = 1; });
    photoMap = photoMap || {}; people.forEach(function (p) { if (photoMap[cleanMobile(p.mobile)]) p.hasPhoto = true; });
    var res = addDraft(R.list, people);
    if (res.error) { note("⚠️ Ek registration me max " + res.error.max + " students."); return Promise.resolve(false); }
    var list = res.list;
    if (reg.published) {
      var a = assignRolls(list, { rollDigits: reg.rollDigits, retired: R.retired });
      if (a.error) { note("⚠️ Roll digits kam hain — itne students ke liye digits badhane padenge."); return Promise.resolve(false); }
      list = a.list;
    }
    R.list = list;
    return saveRoster().then(function (ok) {
      if (!ok) return false;
      var fresh = R.list.filter(function (e) { return !before[e.mobile]; });
      var photoJobs = fresh.filter(function (e) { return photoMap[e.mobile]; }).map(function (e) { return savePhoto(e.mobile, photoMap[e.mobile]).catch(function () { e.hasPhoto = false; }); });
      var msg = (prefix || "") + "✅ " + res.added + " student jude" + (res.skipped ? " (" + res.skipped + " pehle se the / galat mobile)" : "") + ".";
      return Promise.all(photoJobs).then(function () {
        if (reg.published && fresh.length) {
          return instName(reg).then(function (inst) { return writeCards(reg, fresh, inst); }).then(function (failed) {
            note(msg + " Naye students ko bache hue numbers me se random roll mil gaya aur card ban gaya" + (failed ? " (" + failed + " ke card app tak nahi pahunche — PDF/WhatsApp se dein)" : "") + ".");
          });
        }
        note(msg + (reg.published ? "" : " Roll No Publish karte waqt shuffle hokar milenge."));
      }).then(function () { renderCur(); return true; });
    });
  }
  function removeEntry(en) {
    var reg = S.reg, R = S.R;
    if (!confirm((en.roll ? "Roll " + en.roll + " — " : "") + en.name + " ko hata dein?" + (reg.published ? "\nIska admit card bhi delete hoga aur ye roll dobara kisi ko nahi milega." : ""))) return;
    R.list = R.list.filter(function (x) { return x.mobile !== en.mobile; });
    var d = DB();
    if (reg.published && en.roll) { R.retired = R.retired.concat([en.roll]); if (d) d.collection(CARDS).doc(reg.id + "_" + en.mobile).delete().catch(function () {}); }
    if (en.hasPhoto && d) d.collection(REGS).doc(reg.id).collection("photos").doc(en.mobile).delete().catch(function () {});
    delete S.photos[en.mobile];
    saveRoster().then(function (ok) { if (ok) { renderCur(); note("🗑️ " + en.name + " hata diya." + (reg.published ? " Is registration se jude exam me 'Sync' dabayein." : "")); } });
  }
  /* --- ek student ka form (naya / edit) --- */
  function resetForm(full) {
    S.edit = null; S.photo = null;
    ["name", "mobile", "father", "dob"].forEach(function (k) { var e = $("reg-m-" + k); if (e) e.value = ""; });
    if (full) { ["cls", "group"].forEach(function (k) { var e = $("reg-m-" + k); if (e) e.value = ""; }); }
    var m = $("reg-m-mobile"); if (m) m.disabled = false;
    var pv = $("reg-m-prev"); if (pv) { pv.removeAttribute("src"); pv.style.display = "none"; }
    var f = $("reg-m-file"); if (f) f.value = "";
    var b = $("reg-m-btn"); if (b) b.textContent = "➕ Student register karein";
    var c = $("reg-m-cancel"); if (c) c.style.display = "none";
  }
  function startEdit(en) {
    S.edit = en.mobile; S.photo = null;
    $("reg-m-name").value = en.name; $("reg-m-mobile").value = en.mobile; $("reg-m-mobile").disabled = true; $("reg-m-father").value = en.father || ""; $("reg-m-cls").value = en.cls || ""; $("reg-m-dob").value = en.dob || ""; $("reg-m-group").value = en.group || "";
    var pv = $("reg-m-prev"); pv.style.display = "none";
    if (en.hasPhoto) ensurePhotos([en]).then(function () { if (S.photos[en.mobile] && S.edit === en.mobile) { pv.src = S.photos[en.mobile]; pv.style.display = ""; } });
    $("reg-m-btn").textContent = "💾 Update karein"; $("reg-m-cancel").style.display = "";
    var sec = $("reg-sec-add"); if (sec) { sec.open = true; sec.scrollIntoView({ behavior: "smooth", block: "start" }); }
    note("✏️ " + en.name + " ka record badal rahe hain (mobile nahi badal sakta).");
  }
  function submitOne() {
    var p = { name: val("reg-m-name"), mobile: cleanMobile($("reg-m-mobile").value), father: val("reg-m-father"), cls: val("reg-m-cls"), dob: $("reg-m-dob").value || "", group: val("reg-m-group") };
    if (!p.name) { note("⚠️ Student ka naam likhein."); return; }
    if (p.mobile.length !== 10) { note("⚠️ Sahi 10-digit mobile number likhein."); return; }
    var pm = {}; if (S.photo) pm[p.mobile] = S.photo;
    if (S.edit) {
      var en = S.R.list.filter(function (x) { return x.mobile === S.edit; })[0]; if (!en) { resetForm(); return; }
      en.name = p.name; en.father = p.father; en.cls = p.cls; en.dob = normDate(p.dob); en.group = p.group; if (S.photo) en.hasPhoto = true;
      saveRoster().then(function (ok) {
        if (!ok) return;
        return (S.photo ? savePhoto(en.mobile, S.photo) : Promise.resolve()).then(function () {
          return S.reg.published && en.roll ? instName(S.reg).then(function (inst) { return writeCards(S.reg, [en], inst); }) : 0;
        }).then(function () { note("✅ " + en.name + " ka record update ho gaya."); resetForm(); renderCur(); });
      });
      return;
    }
    if (S.R.list.some(function (x) { return x.mobile === p.mobile; })) { note("⚠️ Ye mobile number pehle se registered hai."); return; }
    var keepCls = p.cls, keepGroup = p.group;
    addPeople([p], pm).then(function (ok) { if (ok) { resetForm(); $("reg-m-cls").value = keepCls; $("reg-m-group").value = keepGroup; } });
  }
  function pickPhotoFor(en) {
    var f = h("input", { type: "file", accept: "image/*" });
    f.onchange = function () {
      if (!f.files || !f.files[0]) return; note("⏳ Photo save ho rahi hai...");
      resizePhoto(f.files[0]).then(function (data) { en.hasPhoto = true; return savePhoto(en.mobile, data).then(saveRoster); }).then(function (ok) { if (ok) { note("📷 " + en.name + " ki photo save ho gayi."); renderCur(); } }).catch(function (e) { note("❌ " + (e.message || e)); });
    };
    f.click();
  }
  function addBulk() {
    var r = parseRows($("reg-paste").value), g = val("reg-bulk-group");
    if (!r.people.length) { note("⚠️ Koi sahi line nahi mili. Har line me Naam aur 10-digit Mobile zaroori hai."); return; }
    if (g) r.people.forEach(function (p) { if (!p.group) p.group = g; });
    $("reg-paste").value = "";
    addPeople(r.people, null, r.bad.length ? "⚠️ " + r.bad.length + " line chhodi (mobile/naam nahi tha). " : "");
  }
  function readDetails() { return { date: $("reg-f-date").value || "", time: val("reg-f-time"), reportTime: val("reg-f-reportTime"), venue: val("reg-f-venue"), notes: val("reg-f-notes") }; }
  function saveDetails() {
    var reg = S.reg, p = readDetails(); if (!reg.published) p.rollDigits = digitsOf($("reg-f-digits").value);
    patchReg(p).then(function (ok) { if (ok) { note("✅ Details save ho gaye." + (reg.published ? " Students ko naya card dikhane ke liye \"Update\" (Publish) dabayein." : "")); renderCur(); } });
  }
  function publish() {
    var reg = S.reg, R = S.R, d = DB();
    if (!R.list.length) { note("⚠️ Pehle students jodein."); return; }
    if (!d) { alert("Server se connect nahi ho paya."); return; }
    var p = readDetails(); if (!reg.published) p.rollDigits = digitsOf($("reg-f-digits").value);
    var pending = R.list.filter(function (e) { return !e.roll; }).length, first = !reg.published, nophoto = R.list.filter(function (e) { return !e.hasPhoto; }).length;
    var msg = (first ? R.list.length + " students ko RANDOM roll number mil jaayenge (sab institute/class mix) aur Admit Card ban jaayega.\n\nPublish ke baad roll kabhi nahi badlenge." : (pending ? pending + " bina-roll wale students ko roll dekar " : "") + R.list.length + " students ke Admit Card update honge.") + (nophoto ? "\n\n⚠️ " + nophoto + " students ki photo nahi hai (card par photo ka khaali box aayega)." : "") + "\n\nAage badhein?";
    if (!confirm(msg)) return;
    var a = assignRolls(R.list, { rollDigits: p.rollDigits || reg.rollDigits, retired: R.retired });
    if (a.error) { note("⚠️ Roll digits kam hain — " + a.error.need + " ya zyada digits chunein."); return; }
    note("⏳ Roll shuffle + Admit cards ban rahe hain...");
    var prevList = R.list; R.list = a.list;
    patchReg(p).then(function (ok) { if (!ok) throw new Error("details save nahi hue"); return saveRoster(); })
      .then(function (ok) { if (!ok) throw new Error("roster save nahi hua"); return instName(reg); })
      .then(function (inst) { return writeCards(reg, R.list, inst).then(function (failed) { return patchReg({ published: true, publishedAt: Date.now(), instituteName: inst || reg.instituteName || "" }).then(function () { return failed; }); }); })
      .then(function (failed) {
        note("🚀 " + R.list.length + " students ke Roll No shuffle hokar publish ho gaye." + (failed ? " ⚠️ " + failed + " cards app tak nahi pahunche — unhe PDF ya WhatsApp se dein." : " Jinke paas app hai unhe Admit Card app me dikhega.") + " Ab \"📄 PDF\" se print/WhatsApp kar sakte hain.");
        renderCur();
      }).catch(function (e) { R.list = prevList; note("❌ Publish nahi hua: " + (e.code || e.message || e)); renderCur(); });
  }
  function pdfList() { var g = S.pdfGroup; return S.R.list.filter(function (e) { return e.roll && (!g || e.group === g); }).sort(byRoll); }
  function printPdf() {
    var reg = S.reg, list = pdfList();
    if (!reg.published || !list.length) { note("⚠️ Pehle Publish karein (roll no tabhi bante hain)."); return; }
    var PER = 60, total = list.length, parts = Math.ceil(total / PER), tag = S.pdfGroup ? "-" + safeName(S.pdfGroup) : "";
    note("⏳ PDF ban rahi hai (jsPDF load ho raha hai)...");
    Promise.resolve(root.__ensureLib ? root.__ensureLib("jspdf") : null).catch(function () {}).then(function () { return instName(reg); }).then(function (inst) {
      if (!root.jspdf || !root.jspdf.jsPDF) throw new Error("PDF library load nahi hui — internet check karein.");
      var chain = Promise.resolve();
      for (var p = 0; p < parts; p++) (function (pi) {
        chain = chain.then(function () {
          var slice = list.slice(pi * PER, pi * PER + PER), pdf = new root.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait" }), k = ensurePhotos(slice);
          slice.forEach(function (en, i) {
            k = k.then(function () {
              return root.SnapAdmit.render(cardFor(reg, en, inst), S.photos[en.mobile] || null, 0.8).then(function (cv) {
                if (i > 0 && i % 2 === 0) pdf.addPage();
                pdf.addImage(cv.toDataURL("image/jpeg", 0.8), "JPEG", 0, (i % 2) * 148.5, 210, 148.5);
                if (i % 10 === 0) note("⏳ PDF " + (pi + 1) + "/" + parts + " — " + (pi * PER + i + 1) + "/" + total + " cards...");
                return new Promise(function (r) { setTimeout(r, 0); });
              });
            });
          });
          return k.then(function () { pdf.save(safeName(reg.name) + tag + "-admit-cards" + (parts > 1 ? "-part" + (pi + 1) : "") + ".pdf"); });
        });
      })(p);
      return chain;
    }).then(function () { note("✅ " + total + " admit cards ki PDF download ho gayi (A4 par 2 card, roll ke order me)."); }).catch(function (e) { note("❌ PDF nahi bani: " + (e.message || e)); });
  }
  function csvDownload() {
    var reg = S.reg, rows = [["Roll No", "Name", "Mobile", "Father", "Class", "DOB", "School/Institute", "Photo"]];
    S.R.list.slice().sort(function (a, b) { return a.roll ? (b.roll ? byRoll(a, b) : -1) : (b.roll ? 1 : byName(a, b)); }).forEach(function (e) { rows.push([e.roll || "", e.name, e.mobile, e.father || "", e.cls || "", e.dob || "", e.group || "", e.hasPhoto ? "Yes" : "No"]); });
    var blob = new Blob(["\ufeff" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = safeName(reg.name) + "-roll-list.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function waLink(en) {
    var reg = S.reg, t = "Namaste " + en.name + ", " + (reg.name || "exam") + (reg.date ? " (" + prettyDate(reg.date) + ")" : "") + " ke liye aapka Roll No: " + en.roll + ". Admit Card institute se milega.";
    return "https://wa.me/91" + en.mobile + "?text=" + encodeURIComponent(t);
  }

  /* ---------- Google Form (Apps Script web-app) ---------- */
  function newToken() { var a = new Uint8Array(12), cr = root.crypto || (typeof globalThis !== "undefined" && globalThis.crypto); if (cr && cr.getRandomValues) cr.getRandomValues(a); else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return Array.prototype.map.call(a, function (b) { return pad(b.toString(16), 2); }).join(""); }
  function lsGet() { try { var l = JSON.parse(localStorage.getItem(EP_KEY) || "null"); return l && l.url && l.token ? l : null; } catch (e) { return null; } }
  function cfg() {
    var r = S.reg || {}; if (r.formEndpoint && r.formToken) return { url: r.formEndpoint, token: r.formToken };
    var l = lsGet(); if (l) return l;
    var o = S.regs.filter(function (x) { return x.formEndpoint && x.formToken; })[0]; return o ? { url: o.formEndpoint, token: o.formToken } : null;
  }
  function setupToken() { var l = lsGet(); if (l) return l.token; var o = S.regs.filter(function (x) { return x.formToken; })[0]; if (o) return o.formToken; try { var t = JSON.parse(localStorage.getItem(EP_KEY + "_t") || "null"); if (t) return t; } catch (e) {} var n = newToken(); try { localStorage.setItem(EP_KEY + "_t", JSON.stringify(n)); } catch (e) {} return n; }
  function gs(action, extra) {
    var c = cfg(); if (!c) return Promise.reject(new Error("Pehle Google Form setup karein."));
    var qs = "action=" + encodeURIComponent(action) + "&token=" + encodeURIComponent(c.token); for (var k in (extra || {})) qs += "&" + k + "=" + encodeURIComponent(extra[k]);
    return fetch(c.url + (c.url.indexOf("?") < 0 ? "?" : "&") + qs).then(function (r) { return r.json(); }).then(function (j) { if (!j || !j.ok) throw new Error((j && j.error) || "Script ne jawab nahi diya"); return j; });
  }
  function saveSetup() {
    var url = val("reg-gs-url"), tok = setupToken();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^\s]+\/exec$/.test(url)) { note("⚠️ Web app ka URL 'https://script.google.com/macros/s/…/exec' jaisa hona chahiye (Deploy ke baad milta hai)."); return; }
    try { localStorage.setItem(EP_KEY, JSON.stringify({ url: url, token: tok })); } catch (e) {}
    note("⏳ Test ho raha hai...");
    gs("ping").then(function () { return patchReg({ formEndpoint: url, formToken: tok }); }).then(function (ok) { if (ok) { S.setup = false; note("✅ Google Form setup ho gaya. Ab \"📋 Google Form banayein\" dabayein."); renderForm(); } })
      .catch(function (e) { note("❌ Test fail: " + (e.message || e) + " — Deploy me 'Who has access: Anyone' aur sahi URL check karein."); });
  }
  function createForm() {
    var reg = S.reg, c = cfg(); note("⏳ Google Form ban raha hai...");
    gs("create", { title: (reg.name || "Exam") + " — Registration", desc: (reg.name || "Test") + (reg.date ? " (" + prettyDate(reg.date) + ")" : "") + " ke liye registration. Sahi jaankari bharein — isi se Admit Card banega." })
      .then(function (j) { return patchReg({ formEndpoint: c.url, formToken: c.token, formId: j.formId, formUrl: j.url, formEditUrl: j.editUrl }); })
      .then(function (ok) { if (ok) { note("✅ Google Form ban gaya. Link students/institutes ko bhejein; bharte hi yahan 🔄 se register ho jaayenge."); renderForm(); } })
      .catch(function (e) { note("❌ Form nahi bana: " + (e.message || e)); });
  }
  function pullResponses() {
    var reg = S.reg; if (!reg.formId) return; note("⏳ Responses la rahe hain...");
    gs("responses", { formId: reg.formId }).then(function (j) {
      var people = rowsToPeople(j.rows), known = {}; S.R.list.forEach(function (e) { known[e.mobile] = 1; });
      var fresh = people.filter(function (p) { return !known[p.mobile]; });
      if (!fresh.length) { note("ℹ️ " + (j.rows || []).length + " responses hain, naya koi nahi (sab pehle se registered)."); return; }
      return addPeople(fresh, null, "📥 Form se " + fresh.length + " naye students. ");
    }).catch(function (e) { note("❌ Responses nahi aaye: " + (e.message || e)); });
  }
  function closeForm() {
    var reg = S.reg; if (!reg.formId || !confirm("Form band karein? Naye students isse register nahi kar payenge.")) return;
    gs("close", { formId: reg.formId }).then(function () { note("⛔ Form band ho gaya."); }).catch(function (e) { note("❌ " + (e.message || e)); });
  }
  function copyText(t, ok) { try { navigator.clipboard.writeText(t).then(function () { note(ok); }, function () { note("⚠️ Copy nahi hua — text select karke copy karein."); }); } catch (e) { note("⚠️ Copy nahi hua — text select karke copy karein."); } }
  function renderForm() {
    var box = $("reg-form-box"); if (!box || !S.reg) return; box.textContent = "";
    var reg = S.reg, c = cfg();
    if (!c || S.setup) {
      box.appendChild(h("p", { class: "muted-text", text: c ? "Setup dobara:" : "Students ko khud register karne ke liye Google Form automatic banta hai. Bas ek baar (5 min) ye setup chahiye:" }));
      ["1) script.google.com kholein (jis Google account se form banana ho) → New project.", "2) Neeche ka code pura copy karke wahan paste karein (purana code hata dein) → Save.", "3) Deploy → New deployment → Type: Web app → Execute as: Me → Who has access: Anyone → Deploy → Allow (permission dein).", "4) Jo Web app URL (…/exec) mile use neeche paste karke Save dabayein."].forEach(function (t) { box.appendChild(h("div", { class: "muted-text", text: t })); });
      var code = h("textarea", { class: "reg-code", rows: "6", readonly: "" }); code.value = buildScript(setupToken()); box.appendChild(code);
      box.appendChild(h("div", { class: "ros-btnrow" }, [h("button", { type: "button", class: "btn-secondary", text: "📋 Code copy karein", onclick: function () { copyText(code.value, "📋 Code copy ho gaya — script.google.com par paste karein."); } })]));
      box.appendChild(h("label", { class: "ros-field" }, [h("span", { text: "Web app URL" }), h("input", { id: "reg-gs-url", placeholder: "https://script.google.com/macros/s/…/exec" })]));
      box.appendChild(h("button", { type: "button", class: "btn-primary", text: "💾 Save & test", onclick: saveSetup }));
      return;
    }
    if (!reg.formUrl) {
      box.appendChild(h("p", { class: "muted-text", text: "Setup ho chuka hai. Is registration ke liye Google Form banayein (naam, mobile, father, class, DOB, school)." }));
      box.appendChild(h("button", { type: "button", class: "btn-primary", text: "📋 Google Form banayein", onclick: createForm }));
    } else {
      var u = h("input", { class: "reg-formlink", readonly: "" }); u.value = reg.formUrl; box.appendChild(u);
      box.appendChild(h("div", { class: "ros-btnrow" }, [
        h("button", { type: "button", class: "btn-secondary", text: "📋 Link copy", onclick: function () { copyText(reg.formUrl, "📋 Form ka link copy ho gaya."); } }),
        h("a", { class: "btn-secondary reg-alink", text: "💬 WhatsApp", target: "_blank", rel: "noopener", href: "https://wa.me/?text=" + encodeURIComponent((reg.name || "Test") + " ke liye registration form bharein: " + reg.formUrl) }),
        h("a", { class: "btn-secondary reg-alink", text: "✏️ Form edit", target: "_blank", rel: "noopener", href: reg.formEditUrl || reg.formUrl })]));
      box.appendChild(h("div", { class: "ros-btnrow" }, [
        h("button", { type: "button", class: "btn-primary", text: "🔄 Responses laayein", onclick: pullResponses }),
        h("button", { type: "button", class: "btn-secondary", text: "⛔ Form band", onclick: closeForm })]));
      box.appendChild(h("p", { class: "muted-text", text: "Students form bharte hain → yahan 🔄 dabate hi register ho jate hain. Photo form me nahi aati — list me 📷 se ya student ke saath alag se add karein." }));
    }
    box.appendChild(h("button", { type: "button", class: "btn-link reg-setup-link", text: "⚙️ Setup / script dobara dekhein", onclick: function () { S.setup = true; renderForm(); } }));
  }

  /* ---------- render ---------- */
  function stat(label, val, cls) { return h("div", { class: "ros-stat " + (cls || "") }, [h("strong", { text: String(val) }), h("span", { text: label })]); }
  function refreshList() { return loadRegs().then(renderList); }
  function renderList() {
    var box = $("reg-list"); if (!box) return; box.textContent = "";
    if (!S.regs.length) { box.appendChild(h("div", { class: "examgr-empty", text: "Abhi koi Registration nahi hai. Upar naam likhkar banayein — phir students jodein." })); return; }
    S.regs.forEach(function (r) {
      box.appendChild(h("div", { class: "examgr-report-row ros-row reg-row" }, [
        h("div", { class: "ros-rn reg-main", role: "button", tabindex: "0", onclick: function () { openReg(r.id); } }, [
          h("strong", { text: r.name || "Registration" }),
          h("small", { text: (r.date ? prettyDate(r.date) + " • " : "") + (Number(r.count) || 0) + " students • " + digitsOf(r.rollDigits) + " digit roll" })]),
        h("span", { class: "ros-pill " + (r.published ? "ok" : ""), text: r.published ? "✅ Published" : "Draft" }),
        h("button", { type: "button", class: "ros-ic", title: "Delete", onclick: function () { deleteReg(r); } }, ["🗑️"])
      ]));
    });
  }
  function renderTable() {
    var box = $("reg-table"); if (!box || !S.R) return; box.textContent = "";
    var reg = S.reg, q = S.tq.trim().toLowerCase(), list = S.R.list.slice().sort(function (a, b) { return a.roll && b.roll ? byRoll(a, b) : byName(a, b); });
    if (!list.length) { box.appendChild(h("div", { class: "examgr-empty", text: "Abhi koi student register nahi hua. Upar form bharein, paste karein ya Google Form se aane dein." })); return; }
    var rows = list.filter(function (e) { return !q || e.name.toLowerCase().indexOf(q) >= 0 || String(e.roll || "").indexOf(q) >= 0 || e.mobile.indexOf(q) >= 0 || String(e.group || "").toLowerCase().indexOf(q) >= 0; });
    rows.slice(0, 300).forEach(function (e) {
      box.appendChild(h("div", { class: "examgr-report-row ros-row" }, [
        h("span", { class: "ros-roll", text: e.roll || "—" }),
        h("div", { class: "ros-rn" }, [h("strong", { text: e.name }), h("small", { text: e.mobile + (e.cls ? " • " + e.cls : "") + (e.group ? " • " + e.group : "") })]),
        h("button", { type: "button", class: "ros-ic", title: e.hasPhoto ? "Photo badlein" : "Photo lagayein", onclick: function () { pickPhotoFor(e); } }, [e.hasPhoto ? "📷" : "➕📷"]),
        reg.published && e.roll ? h("button", { type: "button", class: "ros-ic", title: "Admit card dekhein", onclick: function () { Promise.all([instName(reg), ensurePhotos([e])]).then(function (r) { root.SnapAdmit.preview(cardFor(reg, e, r[0]), S.photos[e.mobile] || null); }); } }, ["🎫"]) : null,
        reg.published && e.roll ? h("a", { class: "ros-ic", title: "WhatsApp", href: waLink(e), target: "_blank", rel: "noopener" }, ["💬"]) : null,
        h("button", { type: "button", class: "ros-ic", title: "Edit", onclick: function () { startEdit(e); } }, ["✏️"]),
        h("button", { type: "button", class: "ros-ic", title: "Hatayein", onclick: function () { removeEntry(e); } }, ["🗑️"])
      ]));
    });
    if (rows.length > 300) box.appendChild(h("div", { class: "muted-text", text: "Pehle 300 dikh rahe hain — search use karein." }));
  }
  function renderCur() {
    var reg = S.reg, R = S.R; if (!reg || !R) return;
    $("reg-sub").textContent = (reg.name || "Registration") + (reg.date ? " • " + prettyDate(reg.date) : "") + " • " + (reg.published ? "✅ Published" : "Draft (roll abhi nahi bane)");
    var box = $("reg-stats"); box.textContent = "";
    var pend = R.list.filter(function (e) { return !e.roll; }).length, gs2 = groupsOf(R.list), ph = R.list.filter(function (e) { return e.hasPhoto; }).length;
    box.appendChild(stat("Registered", R.list.length)); box.appendChild(stat("Roll mila", R.list.length - pend, reg.published ? "ok" : "")); box.appendChild(stat("Photo", ph + "/" + R.list.length)); box.appendChild(stat("Institutes", gs2.length));
    ["time", "reportTime", "venue", "notes"].forEach(function (k) { var el = $("reg-f-" + k); if (el && document.activeElement !== el) el.value = reg[k] || ""; });
    var de = $("reg-f-date"); if (de && document.activeElement !== de) de.value = reg.date || "";
    var dg = $("reg-f-digits"); if (dg) { dg.value = String(digitsOf(reg.rollDigits)); dg.disabled = !!reg.published; }
    var pb = $("reg-publish-btn"); if (pb) pb.textContent = reg.published ? "🔄 Update (naye cards bhejein)" : "🎲 Roll shuffle karke Publish";
    var pg = $("reg-pdf-group"); if (pg) { pg.textContent = ""; pg.appendChild(h("option", { value: "", text: "Sab students" })); gs2.forEach(function (g) { pg.appendChild(h("option", { value: g, text: "Institute: " + g })); }); pg.value = S.pdfGroup; }
    var phn = $("reg-pub-hint"); if (phn) phn.textContent = reg.published ? "Roll lock ho chuke hain. Naya student jodoge to use bache hue numbers me se random roll milega." : "Abhi roll nahi bane. Test se 1–2 din pehle jab chahein tab Publish dabayein.";
    var cb = $("reg-pdf-btn"); if (cb) cb.disabled = !reg.published;
    var dl = $("reg-m-groups"); if (dl) { dl.textContent = ""; gs2.forEach(function (g) { dl.appendChild(h("option", { value: g })); }); }
    renderForm(); renderTable();
  }
  function showView(v) { $("reg-view-list").style.display = v === "list" ? "" : "none"; $("reg-view-cur").style.display = v === "cur" ? "" : "none"; }

  /* ---------- build ---------- */
  function build() {
    if (OV) return;
    function sec(title, kids, open, id) { var d = h("details", open ? { open: "" } : {}, [h("summary", { text: title })].concat(kids)); d.className = "ros-sec"; if (id) d.id = id; return d; }
    function fld(id, label, attrs) { var i = h(attrs && attrs.tag || "input", { id: id, placeholder: attrs && attrs.ph || "" }); if (attrs && attrs.type) i.type = attrs.type; if (attrs && attrs.list) i.setAttribute("list", attrs.list); if (attrs && attrs.tag === "textarea") i.rows = 3; return h("label", { class: "ros-field" }, [h("span", { text: label }), i]); }
    var dig = h("select", { id: "reg-f-digits" }); [1, 2, 3, 4, 5].forEach(function (n) { dig.appendChild(h("option", { value: String(n), text: n + " digit" + (n > 1 ? "s" : "") })); });
    var ndig = h("select", { id: "reg-new-digits" }); [2, 3, 4, 5].forEach(function (n) { ndig.appendChild(h("option", Object.assign({ value: String(n), text: n + " digit roll" }, n === 3 ? { selected: "" } : {}))); });
    var pdfg = h("select", { id: "reg-pdf-group", onchange: function () { S.pdfGroup = this.value; } });
    var file = h("input", { type: "file", accept: "image/*", id: "reg-m-file" });
    file.onchange = function () {
      if (!file.files || !file.files[0]) return;
      resizePhoto(file.files[0]).then(function (d) { S.photo = d; var pv = $("reg-m-prev"); pv.src = d; pv.style.display = ""; }).catch(function (e) { note("❌ " + (e.message || e)); });
    };
    var listView = h("div", { id: "reg-view-list" }, [
      h("p", { class: "muted-text", text: "Test se pehle yahin students register karein — app par registered hona zaroori nahi (naam, mobile, photo khud bharein, paste karein, ya Google Form se). Roll No aur Admit Card tab bante hain jab aap Publish dabate hain." }),
      h("div", { class: "ros-sec reg-new" }, [
        h("label", { class: "ros-field" }, [h("span", { text: "Naya Registration (test ka naam)" }), h("input", { id: "reg-new-name", placeholder: "jaise: Mock Test Nov 2026" })]),
        h("div", { class: "ros-ctl" }, [h("input", { id: "reg-new-date", type: "date" }), ndig]),
        h("button", { type: "button", class: "btn-primary", text: "➕ Registration banayein", onclick: createReg })
      ]),
      h("div", { id: "reg-list" })
    ]);
    var curView = h("div", { id: "reg-view-cur", style: "display:none" }, [
      h("button", { type: "button", class: "btn-secondary reg-back", text: "← Saari Registrations", onclick: function () { showView("list"); note(""); refreshList(); } }),
      h("div", { class: "test-analysis-meta", id: "reg-sub" }),
      h("div", { class: "ros-stats", id: "reg-stats" }),
      sec("👤 1. Student register karein (form)", [
        fld("reg-m-name", "Student ka Naam *"), fld("reg-m-mobile", "Mobile Number * (10 digit)", { type: "tel" }),
        fld("reg-m-father", "Father / Guardian ka Naam"),
        h("div", { class: "ros-ctl" }, [fld("reg-m-cls", "Class", { ph: "jaise 10" }), fld("reg-m-dob", "Date of Birth", { type: "date" })]),
        fld("reg-m-group", "School / Institute ka Naam (agle student par yaad rehta hai)", { ph: "jaise: ABC Public School", list: "reg-m-groups" }),
        h("datalist", { id: "reg-m-groups" }),
        h("label", { class: "ros-field" }, [h("span", { text: "Photo (camera ya gallery)" }), file]),
        h("img", { id: "reg-m-prev", class: "reg-prev", alt: "photo", style: "display:none" }),
        h("div", { class: "ros-btnrow" }, [
          h("button", { type: "button", class: "btn-primary", id: "reg-m-btn", text: "➕ Student register karein", onclick: submitOne }),
          h("button", { type: "button", class: "btn-secondary", id: "reg-m-cancel", text: "✖ Edit cancel", style: "display:none", onclick: function () { resetForm(); note(""); } })])
      ], true, "reg-sec-add"),
      sec("📥 Ek saath bahut (Excel / Sheet se paste)", [
        h("p", { class: "muted-text", text: "Har line me columns (tab ya comma se alag): Naam, Mobile, Father, Class, DOB, School. Mobile kisi bhi column me ho sakta hai. DOB 12/03/2008 ya 2008-03-12. Photo baad me list se ➕📷 se lagayein." }),
        fld("reg-bulk-group", "Jin lines me School/Institute nahi hai unke liye (optional)", { ph: "jaise: ABC Public School" }),
        h("textarea", { id: "reg-paste", rows: "6", placeholder: "Aarav Sharma, 9876543210, Ram Sharma, 10, 12/03/2008, ABC School" }),
        h("button", { type: "button", class: "btn-secondary", text: "➕ Paste kiye hue add karein", onclick: addBulk })
      ]),
      sec("📋 2. Google Form (students khud register karein)", [h("div", { id: "reg-form-box" })]),
      sec("🧾 Registered students", [h("input", { type: "search", placeholder: "Naam / roll / mobile / institute", oninput: function () { S.tq = this.value; renderTable(); } }), h("div", { id: "reg-table" })], true),
      sec("🎫 3. Admit Card details & Publish", [
        fld("reg-f-date", "Exam ki Date", { type: "date" }), fld("reg-f-time", "Exam Time", { ph: "jaise 10:00 AM – 1:00 PM" }), fld("reg-f-reportTime", "Reporting Time", { ph: "jaise 9:30 AM" }), fld("reg-f-venue", "Venue / Center", { ph: "Hall / Room / Address" }),
        fld("reg-f-notes", "Instructions (khaali = default)", { tag: "textarea" }),
        h("label", { class: "ros-field" }, [h("span", { text: "Roll No kitne digit ka (Publish ke baad badal nahi sakta)" }), dig]),
        h("p", { class: "muted-text", id: "reg-pub-hint" }),
        h("div", { class: "ros-btnrow" }, [
          h("button", { type: "button", class: "btn-secondary", text: "💾 Details save", onclick: saveDetails }),
          h("button", { type: "button", class: "btn-primary", id: "reg-publish-btn", text: "🎲 Publish", onclick: publish })]),
        h("label", { class: "ros-field" }, [h("span", { text: "PDF kiske liye (institute-wise bhi — har institute ko uske students ke card)" }), pdfg]),
        h("div", { class: "ros-btnrow" }, [
          h("button", { type: "button", class: "btn-secondary", id: "reg-pdf-btn", text: "📄 Admit Card PDF", onclick: printPdf }),
          h("button", { type: "button", class: "btn-secondary", text: "⬇️ Roll list CSV", onclick: csvDownload })])
      ])
    ]);
    var sheet = h("div", { class: "test-analysis-sheet ros-sheet" }, [
      h("button", { type: "button", class: "test-analysis-close", text: "✕", "aria-label": "Band karein", onclick: close }),
      h("div", { class: "test-analysis-title", text: "📝 Exam Registration" }),
      h("p", { class: "examgr-notice", id: "reg-notice", hidden: "" }),
      listView, curView
    ]);
    OV = h("div", { id: "reg-overlay", class: "test-analysis-overlay examgr-overlay-full hidden" }, [sheet]);
    OV.addEventListener("click", function (e) { if (e.target === OV) close(); });
    document.body.appendChild(OV);
  }
  function close() { if (OV) OV.classList.add("hidden"); }
  function open() {
    if (!on()) { alert("Registration feature band hai."); return; }
    build(); OV.classList.remove("hidden"); showView("list"); note("");
    if (!$("reg-new-date").value) $("reg-new-date").value = new Date().toISOString().slice(0, 10);
    $("reg-list").textContent = "⏳ Load ho raha hai..."; refreshList();
  }
  root.SnapReg = { pure: pure, open: open };
})(typeof window !== "undefined" ? window : globalThis);
