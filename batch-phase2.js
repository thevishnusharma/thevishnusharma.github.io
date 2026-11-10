/* The Vishnu Sharma — Batch Management Phase 2 (v168)
   batch-system.js ke andar plug hota hai (SnapBatch.ext). Naya kya:
   Admin  : Subjects & Chapters | Doubt Solving | Tests & Assignments | Reports & Attendance | Teachers | Institute Settings (Strict Security Mode)
   Student: Subjects (batch dashboard -> subject -> chapter -> content) | Doubts | Assignments | Progress | live attendance
   Data   : institutes/{i}/batches/{b}/{subjects/{s}/chapters/{c}, doubts, assignments/{a}/submissions/{mobile}, attendance, progress, testLinks}
            institutes/{i}/teachers/{t}, institutes/{i}/batchSettings/security
   Private features (doubts, submissions) tabhi chalte hain jab institute ka Strict Mode ON ho (firestore.rules me student identity verify hoti hai). */
(function () {
  "use strict";
  var SB = window.SnapBatch;
  if (!SB || !SB.ext) { console.warn("[batch-phase2] batch-system.js pehle load hona chahiye"); return; }
  var EXT = SB.ext, X = { struct: {}, prog: {}, strict: {}, sv: {} };
  function C() { return SB.ctx(); }
  function norm(t) { return String(t == null ? "" : t).trim().toLowerCase(); }
  function byOrder(a, b) { return (a.order || 0) - (b.order || 0) || (a.number || 0) - (b.number || 0) || (a.createdMs || 0) - (b.createdMs || 0); }
  function plain(d, c) { var o = Object.assign({ id: d.id }, d.data()); o.createdMs = c.ms(o.createdAt); return o; }
  function sref(c, inst, b, sid) { var r = c.bref(inst, b).collection("subjects"); return sid ? r.doc(sid) : r; }
  function cref(c, inst, b, sid, cid) { var r = sref(c, inst, b, sid).collection("chapters"); return cid ? r.doc(cid) : r; }
  function sub(c, inst, b, name) { return c.bref(inst, b).collection(name); }
  function batchOf(c, id) { return (c.A.batches || []).filter(function (x) { return x.id === id; })[0]; }
  function secRef(c, inst) { return c.DB().collection("institutes").doc(inst).collection("batchSettings").doc("security"); }
  function opts(list, cur, ph) {
    var h = '<option value="">' + (ph || "— Select —") + "</option>", seen = false;
    list.forEach(function (n) { if (n === cur) seen = true; h += '<option value="' + c0(n) + '"' + (n === cur ? " selected" : "") + ">" + c0(n) + "</option>"; });
    if (cur && !seen) h += '<option value="' + c0(cur) + '" selected>' + c0(cur) + " (purana)</option>";
    return h;
  }
  function c0(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[x]; }); }

  /* ---------------- structure loading ---------------- */
  function loadStruct(c, inst, b, stu) {
    var q = sref(c, inst, b); if (stu) q = q.where("status", "==", "active");
    return q.get().then(function (s) {
      var subs = s.docs.map(function (d) { var o = plain(d, c); o.chapters = []; return o; }).sort(byOrder);
      return Promise.all(subs.map(function (sb) {
        var cq = cref(c, inst, b, sb.id); if (stu) cq = cq.where("status", "==", "active");
        return cq.get().then(function (cs) { sb.chapters = cs.docs.map(function (d) { return plain(d, c); }).sort(byOrder); }).catch(function () { sb.chapters = []; });
      })).then(function () { X.struct[b] = { subjects: subs, stu: !!stu, at: Date.now() }; return subs; });
    });
  }
  function ensure(c, inst, b, stu) { var s = X.struct[b]; return s && (stu || !s.stu) ? Promise.resolve(s.subjects) : loadStruct(c, inst, b, stu).catch(function () { X.struct[b] = { subjects: [], at: Date.now() }; return []; }); }
  /* entity list; entities na ho to purane batch.subjects strings se */
  function subjectsFor(c, b) {
    var s = X.struct[b]; if (s && s.subjects.length) return s.subjects;
    var bt = batchOf(c, b) || (c.S.batches || []).filter(function (x) { return x.id === b; })[0];
    return bt ? c.subjOf(bt).map(function (n) { return { id: "", name: n, chapters: [], legacy: true }; }) : [];
  }
  function findSubject(c, b, name) { var n = norm(name); return subjectsFor(c, b).filter(function (s) { return norm(s.name) === n; })[0]; }
  function itemIn(i, s, ch) {
    var okS = i.subjectId ? i.subjectId === s.id : norm(i.subject) === norm(s.name); if (!okS) return false;
    if (!ch) return true;
    return i.chapterId ? i.chapterId === ch.id : norm(i.chapter) === norm(ch.name);
  }

  /* ---------------- item form: parent-child dropdowns + validation ---------------- */
  EXT.hooks.form = function (md) {
    var bsel = md.querySelector("#bmf_batchId"), s0 = md.querySelector("#bmf_subject"), c0e = md.querySelector("#bmf_chapter");
    if (!bsel || !s0 || !c0e || s0.tagName === "SELECT") return;
    var c = C(), inst = c.A.inst, curS = s0.value, curC = c0e.value;
    function mk(el) { var s = document.createElement("select"); s.id = el.id; el.parentNode.replaceChild(s, el); return s; }
    var ssel = mk(s0), csel = mk(c0e);
    function fillC() { var sb = findSubject(c, bsel.value, ssel.value); csel.innerHTML = opts(sb ? sb.chapters.map(function (x) { return x.name; }) : [], curC); curC = csel.value; }
    function fillS() { ensure(c, inst, bsel.value).then(function () { ssel.innerHTML = opts(subjectsFor(c, bsel.value).map(function (x) { return x.name; }), curS); curS = ssel.value; fillC(); }); }
    bsel.addEventListener("change", function () { curS = ""; curC = ""; fillS(); });
    ssel.addEventListener("change", function () { curS = ssel.value; curC = ""; fillC(); });
    csel.addEventListener("change", function () { curC = csel.value; });
    fillS();
  };
  EXT.validateItem = function (o, kind) {
    if (kind === "announcement") return null;
    var c = C(), s = o.subject ? findSubject(c, o.batchId, o.subject) : null;
    if (o.subject && !s) return "Subject \"" + o.subject + "\" is batch me nahi hai";
    if (o.chapter && !o.subject) return "Chapter ke liye pehle Subject chunein";
    if (o.chapter && s && !s.legacy && !s.chapters.some(function (x) { return norm(x.name) === norm(o.chapter); })) return "Chapter \"" + o.chapter + "\" is subject me nahi hai";
    return null;
  };
  EXT.stampIds = function (data, o) {
    var c = C(), s = o.subject ? findSubject(c, o.batchId, o.subject) : null, ch = s && o.chapter ? s.chapters.filter(function (x) { return norm(x.name) === norm(o.chapter); })[0] : null;
    data.subjectId = s && s.id ? s.id : ""; data.chapterId = ch ? ch.id : "";
  };

  /* ---------------- helpers: batch select / sync ---------------- */
  function batchBar(c, m, redraw) {
    var bf = c.A.f.batch && batchOf(c, c.A.f.batch) ? c.A.f.batch : (c.A.batches[0] || {}).id; c.A.f.batch = bf;
    return '<div class="bm-tools"><select id="bx-bf">' + c.A.batches.map(function (b) { return '<option value="' + b.id + '"' + (bf === b.id ? " selected" : "") + ">" + c0(b.name) + "</option>"; }).join("") + "</select></div>";
  }
  function bindBatch(c, m, redraw) { var s = m.querySelector("#bx-bf"); s && (s.onchange = function () { c.A.f.batch = this.value; c.A.f.sid = ""; redraw(); }); }
  function noBatch(m) { m.innerHTML = '<div class="bm-card bm-empty">Pehle "Batch Management" me ek batch banayein.</div>'; }
  function syncBatchSubjects(c, b) {
    var names = (X.struct[b] ? X.struct[b].subjects : []).filter(function (s) { return s.status !== "inactive"; }).map(function (s) { return s.name; });
    var bt = batchOf(c, b); if (bt) bt.subjects = names;
    return c.bref(c.A.inst, b).update({ subjects: names, updatedAt: c.FV().serverTimestamp() }).catch(function () {});
  }
  function contentCount(c, b, s, ch) { return (c.A.items[b] || []).filter(function (i) { return i.kind !== "announcement" && itemIn(i, s, ch); }).length; }

  /* =================== ADMIN: Subjects & Chapters =================== */
  EXT.adminViews.struct = { icon: "📚", label: "Subjects & Chapters", render: function (m, c) {
    if (!c.A.batches.length) return noBatch(m);
    var bf = c.A.f.batch && batchOf(c, c.A.f.batch) ? c.A.f.batch : c.A.batches[0].id; c.A.f.batch = bf;
    m.innerHTML = '<div class="bm-empty">Loading…</div>';
    loadStruct(c, c.A.inst, bf, false).then(function () { drawStruct(m, c); }).catch(function (e) { m.innerHTML = '<div class="bm-empty">Load nahi hua (' + c0(e.code || e.message) + "). Firestore Rules publish kiye?</div>"; });
  } };
  function drawStruct(m, c) {
    var bf = c.A.f.batch, inst = c.A.inst, subs = X.struct[bf].subjects, bt = batchOf(c, bf);
    var sid = c.A.f.sid && subs.some(function (s) { return s.id === c.A.f.sid; }) ? c.A.f.sid : (subs[0] || {}).id; c.A.f.sid = sid;
    var cur = subs.filter(function (s) { return s.id === sid; })[0];
    c.topBtn("+ Add Subject", function () { subjectForm(c, null, m); });
    var legacy = !subs.length && c.subjOf(bt).length;
    var h = batchBar(c, m) + (legacy ? '<div class="bm-card"><b>' + c.subjOf(bt).length + ' purane subjects mile</b> (' + c0(c.subjOf(bt).join(", ")) + ')<div class="bm-note">Import se har subject ka alag ID banega; purane content ke Subject/Chapter naam se chapters apne aap ban jaayenge aur content jud jaayega. Kuch delete nahi hota.</div><button class="bm-btn" id="bx-imp">⬇ Import into new structure</button></div>' : "");
    h += '<div class="bm-grid2"><div class="bm-card"><h3>Subjects (' + subs.length + ")</h3>" + (subs.length ? subs.map(function (s, ix) {
      return '<div class="bm-row' + (s.id === sid ? " bx-on" : "") + '"><div class="g"><b>' + c0(s.name) + "</b><small>" + s.chapters.length + " chapters • " + contentCount(c, bf, s) + " content" + (s.teachers && s.teachers.length ? " • " + c0(s.teachers.join(", ")) : "") + "</small></div>" +
        '<span class="bm-badge ' + (s.status === "active" ? "" : "o") + '">' + (s.status === "active" ? "Active" : "Inactive") + '</span><div class="bm-act">' +
        '<button class="bm-btn sec sm" data-so="' + s.id + '">Open</button><button class="bm-btn sec sm" data-su="' + ix + '">↑</button><button class="bm-btn sec sm" data-sd="' + ix + '">↓</button>' +
        '<button class="bm-btn sec sm" data-se="' + s.id + '">Edit</button><button class="bm-btn sec sm" data-st="' + s.id + '">' + (s.status === "active" ? "Deactivate" : "Activate") + '</button><button class="bm-btn red sm" data-sx="' + s.id + '">Delete</button></div></div>';
    }).join("") : '<div class="bm-empty">Abhi koi subject nahi. "+ Add Subject" dabayein.</div>') + "</div>";
    h += '<div class="bm-card"><h3>' + (cur ? "Chapters — " + c0(cur.name) + " (" + cur.chapters.length + ")" : "Chapters") + "</h3>" + (cur ? '<button class="bm-btn sm" id="bx-ac" style="margin-bottom:8px">+ Add Chapter</button>' + (cur.chapters.length ? cur.chapters.map(function (ch, ix) {
      var n = function (k) { return (c.A.items[bf] || []).filter(function (i) { return itemIn(i, cur, ch) && (Array.isArray(k) ? k.indexOf(i.kind) > -1 : i.kind === k); }).length; };
      return '<div class="bm-row' + (ch.status === "active" ? "" : " bx-off") + '"><div class="g"><b>Ch ' + (ch.number || ix + 1) + ": " + c0(ch.name) + "</b><small>🔴 " + n("class") + " • 🎬 " + n("recording") + " • 📄 " + n(["note", "material"]) + " • 📊 " + n("ppt") + "</small></div>" +
        '<div class="bm-act"><button class="bm-btn sec sm" data-cu="' + ix + '">↑</button><button class="bm-btn sec sm" data-cd="' + ix + '">↓</button><button class="bm-btn sec sm" data-ce="' + ch.id + '">Edit</button>' +
        '<button class="bm-btn sec sm" data-ct="' + ch.id + '">' + (ch.status === "active" ? "Off" : "On") + '</button><button class="bm-btn sec sm" data-cp="' + ch.id + '">＋Content</button><button class="bm-btn sec sm" data-ctst="' + ch.id + '">📝 Test</button><button class="bm-btn red sm" data-cx="' + ch.id + '">Delete</button></div></div>';
    }).join("") : '<div class="bm-empty">Is subject me abhi koi chapter nahi.</div>') : '<div class="bm-empty">Pehle subject chunein / banayein.</div>') + "</div></div>";
    m.innerHTML = h; bindBatch(c, m, function () { EXT.adminViews.struct.render(m, c); });
    var q = function (s, f) { m.querySelectorAll(s).forEach(function (b) { b.onclick = function () { f(b); }; }); };
    var redraw = function () { return loadStruct(c, inst, bf, false).then(function () { drawStruct(m, c); }); };
    var imp = m.querySelector("#bx-imp"); imp && (imp.onclick = function () { imp.disabled = true; importLegacy(c, bf).then(redraw).catch(function (e) { c.toast("Import nahi hua: " + (e.code || e.message)); imp.disabled = false; }); });
    q("[data-so]", function (b) { c.A.f.sid = b.dataset.so; drawStruct(m, c); });
    q("[data-su]", function (b) { var i = +b.dataset.su; if (i < 1) return; normOrder(subs, i, i - 1, c, inst, bf).then(redraw); });
    q("[data-sd]", function (b) { var i = +b.dataset.sd; if (i >= subs.length - 1) return; normOrder(subs, i, i + 1, c, inst, bf).then(redraw); });
    q("[data-se]", function (b) { subjectForm(c, subs.filter(function (s) { return s.id === b.dataset.se; })[0], m); });
    q("[data-st]", function (b) { var s = subs.filter(function (x) { return x.id === b.dataset.st; })[0], on = s.status !== "active"; sref(c, inst, bf, s.id).update({ status: on ? "active" : "inactive", updatedAt: c.FV().serverTimestamp() }).then(function () { c.audit("subject." + (on ? "activate" : "deactivate"), s.id); return redraw(); }).then(function () { return syncBatchSubjects(c, bf); }).catch(function (e) { c.toast("Nahi hua: " + (e.code || e.message)); }); });
    q("[data-sx]", function (b) { delSubject(c, subs.filter(function (s) { return s.id === b.dataset.sx; })[0], redraw); });
    if (cur) {
      var ac = m.querySelector("#bx-ac"); ac && (ac.onclick = function () { chapterForm(c, cur, null, redraw); });
      q("[data-ce]", function (b) { chapterForm(c, cur, cur.chapters.filter(function (x) { return x.id === b.dataset.ce; })[0], redraw); });
      q("[data-ct]", function (b) { var ch = cur.chapters.filter(function (x) { return x.id === b.dataset.ct; })[0], on = ch.status !== "active"; cref(c, inst, bf, cur.id, ch.id).update({ status: on ? "active" : "inactive", updatedAt: c.FV().serverTimestamp() }).then(function () { c.audit("chapter.toggle", ch.id); return redraw(); }); });
      q("[data-cu]", function (b) { var i = +b.dataset.cu; if (i < 1) return; normOrder(cur.chapters, i, i - 1, c, inst, bf, cur.id).then(redraw); });
      q("[data-cd]", function (b) { var i = +b.dataset.cd; if (i >= cur.chapters.length - 1) return; normOrder(cur.chapters, i, i + 1, c, inst, bf, cur.id).then(redraw); });
      q("[data-cx]", function (b) { delChapter(c, cur, cur.chapters.filter(function (x) { return x.id === b.dataset.cx; })[0], redraw); });
      q("[data-cp]", function (b) { var ch = cur.chapters.filter(function (x) { return x.id === b.dataset.cp; })[0]; c.A.f = { batch: bf, subject: cur.name, chapter: ch.name }; c.adminGo("note"); c.toast("Ab '+ Add' dabayein — Subject/Chapter pehle se chuna hua hai"); });
      q("[data-ctst]", function (b) { var ch = cur.chapters.filter(function (x) { return x.id === b.dataset.ctst; })[0]; if (!ch) return; if (!window.SnapV169) return c.toast("Module load nahi hua — refresh karein"); window.SnapV169.chapterTest(c, bf, cur, ch, redraw); });
    }
  }
  /* order ko 1..n me normalize karke i<->j swap */
  function normOrder(list, i, j, c, inst, bf, sid) {
    var arr = list.slice(); var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    var bt = c.DB().batch();
    arr.forEach(function (x, ix) { bt.update(sid ? cref(c, inst, bf, sid, x.id) : sref(c, inst, bf, x.id), { order: ix + 1 }); });
    return bt.commit();
  }
  function subjectForm(c, s, m) {
    var bf = c.A.f.batch, inst = c.A.inst, list = X.struct[bf].subjects;
    c.form(s ? "Edit Subject" : "Add Subject", [
      { k: "name", l: "Subject Name", r: 1, p: "Mathematics" }, { k: "desc", l: "Subject Description", t: "textarea" },
      { k: "teachersTxt", l: "Assigned Teachers (comma se alag)", p: "Rohit Kumar" }, { k: "status", l: "Status", t: "select", o: [["active", "Active"], ["inactive", "Inactive"]] }
    ], s ? Object.assign({}, s, { teachersTxt: (s.teachers || []).join(", ") }) : { status: "active" }, function (o) {
      if (list.some(function (x) { return norm(x.name) === norm(o.name) && (!s || x.id !== s.id); })) { c.toast("Is batch me ye subject pehle se hai"); return false; }
      var d = { instituteId: inst, batchId: bf, name: o.name, desc: o.desc || "", teachers: o.teachersTxt.split(",").map(function (x) { return x.trim(); }).filter(Boolean), status: o.status, updatedAt: c.FV().serverTimestamp() };
      var p = s ? sref(c, inst, bf, s.id).update(d) : sref(c, inst, bf).add(Object.assign(d, { order: list.length + 1, createdAt: c.FV().serverTimestamp(), createdBy: c.adminEmail() }));
      return p.then(function () {
        c.audit(s ? "subject.update" : "subject.create", o.name);
        var rename = s && s.name !== o.name ? renameItems(c, bf, s, o.name) : Promise.resolve();
        return rename.then(function () { return loadStruct(c, inst, bf, false); }).then(function () { return syncBatchSubjects(c, bf); }).then(function () { return c.loadAll(); }).then(function () { c.toast("✅ Subject save ho gaya"); drawStruct(m, c); });
      });
    });
  }
  function renameItems(c, bf, s, newName) {   /* subject ka naam badla -> uske content ka text bhi sync */
    var its = (c.A.items[bf] || []).filter(function (i) { return itemIn(i, s); }); if (!its.length) return Promise.resolve();
    var bt = c.DB().batch(); its.slice(0, 400).forEach(function (i) { bt.update(c.bref(c.A.inst, bf).collection("items").doc(i.id), { subject: newName }); }); return bt.commit();
  }
  function chapterForm(c, s, ch, redraw) {
    var bf = c.A.f.batch, inst = c.A.inst;
    c.form(ch ? "Edit Chapter" : "Add Chapter (" + s.name + ")", [
      { k: "name", l: "Chapter Name", r: 1, p: "Real Numbers" }, { k: "number", l: "Chapter Number", t: "number", r: 1 },
      { k: "desc", l: "Description", t: "textarea" }, { k: "status", l: "Status", t: "select", o: [["active", "Active"], ["inactive", "Inactive"]] }
    ], ch || { status: "active", number: s.chapters.length + 1 }, function (o) {
      if (s.chapters.some(function (x) { return norm(x.name) === norm(o.name) && (!ch || x.id !== ch.id); })) { c.toast("Is subject me ye chapter pehle se hai"); return false; }
      var d = { instituteId: inst, batchId: bf, subjectId: s.id, name: o.name, number: +o.number || 0, desc: o.desc || "", status: o.status, updatedAt: c.FV().serverTimestamp() };
      var p = ch ? cref(c, inst, bf, s.id, ch.id).update(d) : cref(c, inst, bf, s.id).add(Object.assign(d, { order: s.chapters.length + 1, createdAt: c.FV().serverTimestamp(), createdBy: c.adminEmail() }));
      return p.then(function () {
        c.audit(ch ? "chapter.update" : "chapter.create", o.name);
        var its = ch && ch.name !== o.name ? (c.A.items[bf] || []).filter(function (i) { return itemIn(i, s, ch); }) : [];
        if (its.length) { var bt = c.DB().batch(); its.slice(0, 400).forEach(function (i) { bt.update(c.bref(inst, bf).collection("items").doc(i.id), { chapter: o.name }); }); return bt.commit().then(function () { return c.loadAll(); }); }
      }).then(function () { c.toast("✅ Chapter save ho gaya"); return redraw(); });
    });
  }
  function delSubject(c, s, redraw) {
    var bf = c.A.f.batch, n = contentCount(c, bf, s);
    if (s.chapters.length) return alert("Is subject me " + s.chapters.length + " chapters hain. Pehle chapters hatayein, ya subject ko Deactivate karein (data surakshit rahega).");
    if (n) return alert("Is subject me " + n + " content hai. Safe policy: content hatayein ya subject ko Deactivate karein.");
    if (!c.sure('Subject "' + s.name + '" permanently delete karein?')) return;
    sref(c, c.A.inst, bf, s.id).delete().then(function () { c.audit("subject.delete", s.id); return redraw(); }).then(function () { return syncBatchSubjects(c, bf); });
  }
  function delChapter(c, s, ch, redraw) {
    var bf = c.A.f.batch, n = contentCount(c, bf, s, ch);
    if (n) return alert("Is chapter me " + n + " content hai. Safe policy: pehle content hatayein ya chapter ko Off (Deactivate) karein.");
    if (!c.sure('Chapter "' + ch.name + '" delete karein?')) return;
    cref(c, c.A.inst, bf, s.id, ch.id).delete().then(function () { c.audit("chapter.delete", ch.id); return redraw(); });
  }
  function importLegacy(c, bf) {
    var inst = c.A.inst, bt = batchOf(c, bf), names = c.subjOf(bt), its = c.A.items[bf] || [], ids = {}, writes = Promise.resolve();
    return Promise.all(names.map(function (n, ix) {
      return sref(c, inst, bf).add({ instituteId: inst, batchId: bf, name: n, desc: "", teachers: [], status: "active", order: ix + 1, createdAt: c.FV().serverTimestamp(), createdBy: c.adminEmail() }).then(function (r) { ids[norm(n)] = { id: r.id, ch: {} }; });
    })).then(function () {
      var per = {}; its.forEach(function (i) { if (i.kind === "announcement") return; var s = ids[norm(i.subject)]; if (s && i.chapter) (per[norm(i.subject)] = per[norm(i.subject)] || {})[norm(i.chapter)] = i.chapter; });
      var jobs = []; Object.keys(per).forEach(function (sk) { Object.keys(per[sk]).forEach(function (ck, ix) { jobs.push(cref(c, inst, bf, ids[sk].id).add({ instituteId: inst, batchId: bf, subjectId: ids[sk].id, name: per[sk][ck], number: ix + 1, desc: "", status: "active", order: ix + 1, createdAt: c.FV().serverTimestamp(), createdBy: c.adminEmail() }).then(function (r) { ids[sk].ch[ck] = r.id; })); }); });
      return Promise.all(jobs);
    }).then(function () {
      var bt2 = c.DB().batch(), n = 0;
      its.forEach(function (i) { if (i.kind === "announcement" || n >= 450) return; var s = ids[norm(i.subject)]; if (!s) return; bt2.update(c.bref(inst, bf).collection("items").doc(i.id), { subjectId: s.id, chapterId: s.ch[norm(i.chapter)] || "" }); n++; });
      return n ? bt2.commit() : null;
    }).then(function () { c.audit("subjects.import", bf); return c.loadAll(); }).then(function () { c.toast("✅ Import ho gaya"); });
  }

  /* =================== ADMIN: Doubt Solving =================== */
  EXT.adminViews.doubt = { icon: "❓", label: "Doubt Solving", render: function (m, c) {
    if (!c.A.batches.length) return noBatch(m);
    m.innerHTML = '<div class="bm-empty">Loading doubts…</div>';
    Promise.all([secRef(c, c.A.inst).get().catch(function () { return null; }), Promise.all(c.A.batches.map(function (b) { return sub(c, c.A.inst, b.id, "doubts").get().then(function (q) { return q.docs.map(function (d) { var o = plain(d, c); o.batchId = b.id; return o; }); }).catch(function () { return []; }); }))]).then(function (r) {
      X.strict[c.A.inst] = !!(r[0] && r[0].exists && r[0].data().strict); X.doubts = [].concat.apply([], r[1]).sort(function (a, b) { return b.createdMs - a.createdMs; }); drawDoubts(m, c);
    });
  } };
  function drawDoubts(m, c) {
    var f = c.A.f, st = f.st || "open", bf = f.batch || "all", rows = X.doubts.filter(function (d) { return (st === "all" || d.status === st) && (bf === "all" || d.batchId === bf); });
    var cnt = function (s) { return X.doubts.filter(function (d) { return d.status === s; }).length; };
    m.innerHTML = (X.strict[c.A.inst] ? "" : '<div class="bm-card bx-warn"><b>⚠️ Strict Mode OFF hai</b><div class="bm-note">Doubts private data hain, isliye students tab tak doubt nahi bhej sakte jab tak Institute Settings me Strict Mode ON na ho.</div></div>') +
      '<div class="bm-tools"><select id="bx-bf"><option value="all">All Batches</option>' + c.A.batches.map(function (b) { return '<option value="' + b.id + '"' + (bf === b.id ? " selected" : "") + ">" + c0(b.name) + "</option>"; }).join("") + '</select><select id="bx-st">' +
      [["open", "Open (" + cnt("open") + ")"], ["answered", "Answered (" + cnt("answered") + ")"], ["resolved", "Resolved (" + cnt("resolved") + ")"], ["all", "All"]].map(function (o) { return '<option value="' + o[0] + '"' + (st === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></div>" +
      (rows.length ? rows.map(function (d, ix) { return '<div class="bm-card"><div class="bm-row"><div class="g"><b>' + c0(d.name || d.mobile) + "</b><small>" + c0(d.mobile) + " • " + c0(c.batchName(d.batchId)) + " • " + c0([d.subject, d.chapter].filter(Boolean).join(" › ") || "General") + " • " + c.fdate(d.createdAt) + '</small></div><span class="bm-badge ' + (d.status === "open" ? "o" : d.status === "answered" ? "b" : "") + '">' + c0(d.status) + "</span></div>" +
        '<p style="margin:6px 0;white-space:pre-wrap">' + c0(d.text) + "</p>" + (d.img ? '<img src="' + d.img + '" style="max-width:100%;max-height:220px;border-radius:8px">' : "") +
        (d.answer ? '<div class="bx-ans"><small>' + c0(d.answeredBy || "") + " • " + c.fdate(d.answeredAt) + "</small><div style=\"white-space:pre-wrap\">" + c0(d.answer) + "</div></div>" : "") +
        '<div class="bm-act" style="margin-top:8px"><button class="bm-btn sm" data-an="' + ix + '">' + (d.answer ? "Edit Answer" : "Answer") + '</button>' + (d.status !== "resolved" ? '<button class="bm-btn sec sm" data-rs="' + ix + '">Mark Resolved</button>' : '<button class="bm-btn sec sm" data-ro="' + ix + '">Reopen</button>') + '<button class="bm-btn red sm" data-dx="' + ix + '">Delete</button></div></div>'; }).join("") : '<div class="bm-card bm-empty">Is filter me koi doubt nahi.</div>');
    m.querySelector("#bx-bf").onchange = function () { c.A.f.batch = this.value; drawDoubts(m, c); }; m.querySelector("#bx-st").onchange = function () { c.A.f.st = this.value; drawDoubts(m, c); };
    var up = function (d, data) { data.updatedAt = c.FV().serverTimestamp(); return sub(c, c.A.inst, d.batchId, "doubts").doc(d.id).update(data).then(function () { return EXT.adminViews.doubt.render(m, c); }).catch(function (e) { c.toast("Nahi hua: " + (e.code || e.message)); }); };
    m.querySelectorAll("[data-an]").forEach(function (b) { b.onclick = function () { var d = rows[+b.dataset.an]; c.form("Doubt ka jawab", [{ k: "answer", l: "Answer", t: "textarea", r: 1 }], { answer: d.answer || "" }, function (o) { c.audit("doubt.answer", d.id); return up(d, { answer: o.answer, answeredBy: c.adminEmail(), answeredAt: c.FV().serverTimestamp(), status: d.status === "resolved" ? "resolved" : "answered" }); }); }; });
    m.querySelectorAll("[data-rs]").forEach(function (b) { b.onclick = function () { up(rows[+b.dataset.rs], { status: "resolved" }); }; });
    m.querySelectorAll("[data-ro]").forEach(function (b) { b.onclick = function () { var d = rows[+b.dataset.ro]; up(d, { status: d.answer ? "answered" : "open" }); }; });
    m.querySelectorAll("[data-dx]").forEach(function (b) { b.onclick = function () { var d = rows[+b.dataset.dx]; if (!c.sure("Ye doubt delete karein?")) return; sub(c, c.A.inst, d.batchId, "doubts").doc(d.id).delete().then(function () { c.audit("doubt.delete", d.id); EXT.adminViews.doubt.render(m, c); }); }; });
  }

  /* =================== ADMIN: Tests (linked) & Assignments =================== */
  EXT.adminViews.tests = { icon: "📝", label: "Tests & Assignments", render: function (m, c) {
    if (!c.A.batches.length) return noBatch(m);
    var bf = c.A.f.batch && batchOf(c, c.A.f.batch) ? c.A.f.batch : c.A.batches[0].id; c.A.f.batch = bf; var tab = c.A.f.tt || "assign";
    m.innerHTML = '<div class="bm-empty">Loading…</div>';
    Promise.all([sub(c, c.A.inst, bf, "assignments").get(), sub(c, c.A.inst, bf, "testLinks").get(), loadStruct(c, c.A.inst, bf, false).catch(function () {})]).then(function (r) {
      var asg = r[0].docs.map(function (d) { return plain(d, c); }).sort(function (a, b) { return b.createdMs - a.createdMs; }), links = r[1].docs.map(function (d) { return plain(d, c); });
      return Promise.all(asg.map(function (a) { return sub(c, c.A.inst, bf, "assignments").doc(a.id).collection("submissions").get().then(function (q) { a.subs = q.docs.map(function (d) { return Object.assign({ mobile: d.id }, d.data()); }); }).catch(function () { a.subs = []; }); })).then(function () { drawTests(m, c, bf, tab, asg, links); });
    }).catch(function (e) { m.innerHTML = '<div class="bm-empty">Load nahi hua (' + c0(e.code || e.message) + ")</div>"; });
  } };
  function drawTests(m, c, bf, tab, asg, links) {
    var inst = c.A.inst; try { window.SnapV169 && window.SnapV169.backfill(links, bf); } catch (e) {}
    c.topBtn(tab === "assign" ? "+ New Assignment" : "+ Link Test", function () { tab === "assign" ? asgForm(c, null, bf, m) : linkForm(c, bf, m); });
    var h = batchBar(c, m) + '<div class="bm-tabs"><button data-tt="assign"' + (tab === "assign" ? ' class="on"' : "") + '>Assignments (' + asg.length + ')</button><button data-tt="tests"' + (tab === "tests" ? ' class="on"' : "") + '>Batch Tests (' + links.length + ")</button></div>";
    if (tab === "tests") {
      h += '<div class="bm-note">Tests purane Tests section se hi chalte hain. Yahan sirf test ko batch/subject/chapter se jodte hain — students ko wo batch mein dikhta hai. Test banane/edit ke liye <a href="#" id="bx-ot">Existing Tests kholein</a>.</div>' +
        (links.length ? links.map(function (l, ix) { return '<div class="bm-row"><div class="g"><b>' + c0(l.title) + "</b><small>" + c0([l.subject, l.chapter].filter(Boolean).join(" › ") || "Batch-wide") + '</small></div><button class="bm-btn red sm" data-lx="' + ix + '">Unlink</button></div>'; }).join("") : '<div class="bm-card bm-empty">Is batch se abhi koi test juda nahi.</div>');
    } else {
      h += asg.length ? asg.map(function (a, ix) {
        var ev = a.subs.filter(function (s) { return s.status === "evaluated"; }).length;
        return '<div class="bm-card"><div class="bm-row"><div class="g"><b>' + c0(a.title) + "</b><small>" + c0([a.subject, a.chapter].filter(Boolean).join(" › ") || "Batch-wide") + (a.due ? " • Due " + new Date(a.due).toLocaleDateString("en-IN") : "") + " • Max " + (a.maxMarks || 0) + '</small></div><span class="bm-badge ' + (a.published ? "" : "o") + '">' + (a.published ? "Published" : "Draft") + "</span></div>" +
          '<small>' + a.subs.length + " submissions • " + ev + ' evaluated</small><div class="bm-act" style="margin-top:6px"><button class="bm-btn sm" data-sb="' + ix + '">Submissions</button><button class="bm-btn sec sm" data-ap="' + ix + '">' + (a.published ? "Unpublish" : "Publish") + '</button><button class="bm-btn sec sm" data-ae="' + ix + '">Edit</button><button class="bm-btn red sm" data-ax="' + ix + '">Delete</button></div></div>';
      }).join("") : '<div class="bm-card bm-empty">Abhi koi assignment nahi.</div>';
    }
    m.innerHTML = h; bindBatch(c, m, function () { EXT.adminViews.tests.render(m, c); });
    m.querySelectorAll("[data-tt]").forEach(function (b) { b.onclick = function () { c.A.f.tt = b.dataset.tt; EXT.adminViews.tests.render(m, c); }; });
    var ot = m.querySelector("#bx-ot"); ot && (ot.onclick = function (e) { e.preventDefault(); var a = document.getElementById("bm-admin"); a && a.remove(); typeof goAdmin === "function" && goAdmin("tests"); });
    var again = function () { return EXT.adminViews.tests.render(m, c); };
    m.querySelectorAll("[data-lx]").forEach(function (b) { b.onclick = function () { var l = links[+b.dataset.lx]; if (!c.sure("Test ko batch se unlink karein? (test delete nahi hoga)")) return; sub(c, inst, bf, "testLinks").doc(l.id).delete().then(function () { c.audit("testlink.delete", l.id); try { window.SnapV169 && window.SnapV169.untagTest(l.testId, bf); } catch (e) {} again(); }); }; });
    m.querySelectorAll("[data-ap]").forEach(function (b) { b.onclick = function () { var a = asg[+b.dataset.ap]; sub(c, inst, bf, "assignments").doc(a.id).update({ published: !a.published, updatedAt: c.FV().serverTimestamp() }).then(function () { c.audit("assignment.publish", a.id); if (!a.published) try { window.SnapV169 && window.SnapV169.assignmentPublished(a); } catch (e) {} again(); }); }; });
    m.querySelectorAll("[data-ae]").forEach(function (b) { b.onclick = function () { asgForm(c, asg[+b.dataset.ae], bf, m); }; });
    m.querySelectorAll("[data-ax]").forEach(function (b) { b.onclick = function () { var a = asg[+b.dataset.ax]; if (a.subs.length) return alert("Is assignment par " + a.subs.length + " submissions hain. Safe policy: delete ke bajay Unpublish karein (records surakshit rahenge)."); if (!c.sure('"' + a.title + '" delete karein?')) return; sub(c, inst, bf, "assignments").doc(a.id).delete().then(function () { c.audit("assignment.delete", a.id); if (a.ownFile && a.ownFile.key && window.SnapFiles) window.SnapFiles.remove(a.ownFile.key); again(); }); }; });
    m.querySelectorAll("[data-sb]").forEach(function (b) { b.onclick = function () { subsView(c, asg[+b.dataset.sb], bf, again); }; });
  }
  function linkForm(c, bf, m) {
    var ts = window.tests || {}, list = Object.keys(ts).map(function (id) { return [id, (ts[id] && (ts[id].title || ts[id].name)) || id]; });
    if (!list.length) return c.toast("Abhi koi test maujood nahi — pehle Tests me test banayein");
    c.form("Batch se Test jodein", [{ k: "batchId", l: "Batch", t: "select", o: c.A.batches.map(function (b) { return [b.id, b.name]; }), r: 1 }, { k: "testId", l: "Test", t: "select", o: list, r: 1 }, { k: "subject", l: "Subject (optional)" }, { k: "chapter", l: "Chapter (optional)" }], { batchId: bf }, function (o) {
      var ve = EXT.validateItem(o, "test"); if (ve) { c.toast(ve); return false; } var d = { instituteId: c.A.inst, batchId: o.batchId, testId: o.testId, title: (ts[o.testId] && (ts[o.testId].title || ts[o.testId].name)) || o.testId, subject: o.subject || "", chapter: o.chapter || "", createdAt: c.FV().serverTimestamp(), createdBy: c.adminEmail() }; EXT.stampIds(d, o);
      return sub(c, c.A.inst, o.batchId, "testLinks").add(d).then(function () { c.audit("testlink.create", o.testId); c.toast("✅ Test juda"); try { window.SnapV169 && window.SnapV169.tagTest(o.testId, o.batchId, o.subject, o.chapter, true, d.title); } catch (e) {} c.A.f.batch = o.batchId; EXT.adminViews.tests.render(m, c); });
    });
  }
  function asgForm(c, a, bf, m) {
    var v = a ? Object.assign({}, a, { dueTxt: a.due ? new Date(a.due - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : "" }) : { batchId: bf, maxMarks: 10 };
    c.form(a ? "Edit Assignment" : "New Assignment", [{ k: "batchId", l: "Batch", t: "select", o: c.A.batches.map(function (b) { return [b.id, b.name]; }), r: 1 }, { k: "title", l: "Title", r: 1 }, { k: "subject", l: "Subject" }, { k: "chapter", l: "Chapter" }, { k: "desc", l: "Instructions", t: "textarea" },
      { k: "dueTxt", l: "Due Date & Time", t: "datetime-local" }, { k: "maxMarks", l: "Max Marks", t: "number" }, { k: "file", l: "Attachment file — device se (optional)", t: "file", acc: ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,image/*,audio/*,video/*", h: "Apna storage — badi file bhi chalegi. YA neeche link daalein." }, { k: "url", l: "Attachment / Question Link (https, optional)" }], v, function (o) {
      if (a && o.batchId !== a.batchId) { c.toast("Assignment ka batch badla nahi ja sakta"); return false; }
      if (o.url && !/^https:\/\/\S+$/i.test(o.url)) { c.toast("Link https:// se shuru hona chahiye"); return false; }
      var ve = EXT.validateItem(o, "assignment"); if (ve) { c.toast(ve); return false; }
      var d = { instituteId: c.A.inst, batchId: o.batchId, title: o.title, desc: o.desc || "", subject: o.subject || "", chapter: o.chapter || "", due: o.dueTxt ? new Date(o.dueTxt).getTime() : 0, maxMarks: +o.maxMarks || 0, url: o.url || "", updatedAt: c.FV().serverTimestamp() }; EXT.stampIds(d, o);
      var upP = Promise.resolve(null);
      if (o.file) {
        if (window.SnapDrive && window.SnapDrive.blocked && window.SnapDrive.blocked(c.A.inst)) { c.toast("Pehle Institute Settings → Mera Storage me apna Drive jodein"); return false; }
        var sdv = window.SnapDrive && window.SnapDrive.ready();
        if (!sdv && !(window.SnapFiles && window.SnapFiles.ready())) { c.toast("File storage abhi chalu nahi — link daalein"); return false; }
        c.toast("⏳ Upload ho raha hai… (band na karein)");
        if (sdv) { upP = (window.SnapQuota ? window.SnapQuota.check(c.A.inst, o.file.size) : Promise.resolve({ ok: true })).then(function (q) { if (!q.ok) throw new Error(q.msg); return window.SnapDrive.upload(o.file, { inst: c.A.inst, batchId: o.batchId }, function (pc) { var bt = document.querySelector(".bm-sheet [data-s]"); bt && (bt.textContent = "Upload " + pc + "%"); }); }).then(function (dd) { window.SnapQuota && window.SnapQuota.add(c.A.inst, dd.size); d.url = dd.url; d.driveId = dd.id; d.fileName = dd.name; return null; }); } else
        upP = window.SnapFiles.upload(o.file, { inst: c.A.inst, batchId: o.batchId }, function (pc) { var bt = document.querySelector(".bm-sheet [data-s]"); bt && (bt.textContent = "Upload " + pc + "%"); });
      }
      var p = upP.then(function (of) {
        var oldF = a && a.ownFile;
        if (of) d.ownFile = of; else if (a && oldF && o.url && o.url !== a.url) d.ownFile = c.FV().delete();
        return (a ? sub(c, c.A.inst, a.batchId, "assignments").doc(a.id).update(d) : sub(c, c.A.inst, o.batchId, "assignments").add(Object.assign(d, { published: false, createdAt: c.FV().serverTimestamp(), createdBy: c.adminEmail() }))).then(function (r) { if (oldF && oldF.key && (of || d.ownFile) && window.SnapFiles) window.SnapFiles.remove(oldF.key); return r; });
      });
      return p.then(function () { c.audit(a ? "assignment.update" : "assignment.create", o.title); c.toast("✅ Save ho gaya"); EXT.adminViews.tests.render(m, c); });
    });
  }
  function subsView(c, a, bf, again) {
    var md = document.createElement("div"); md.className = "bm-modal";
    md.innerHTML = '<div class="bm-sheet"><h3>' + c0(a.title) + " — Submissions</h3>" + (a.subs.length ? a.subs.map(function (s, ix) { return '<div class="bm-card"><div class="bm-row"><div class="g"><b>' + c0(s.name || s.mobile) + "</b><small>" + c0(s.mobile) + " • " + c.fdate(s.submittedAt) + '</small></div><span class="bm-badge ' + (s.status === "evaluated" ? "" : "o") + '">' + (s.status === "evaluated" ? (s.marks + "/" + (a.maxMarks || 0)) : "Pending") + "</span></div>" +
      '<p style="white-space:pre-wrap;margin:6px 0">' + c0(s.text) + "</p>" + (s.url ? '<a href="' + c0(s.url) + '" target="_blank" rel="noopener">Link kholein</a>' : "") + (s.feedback ? "<div class=\"bx-ans\">" + c0(s.feedback) + "</div>" : "") + '<div><button class="bm-btn sm" data-ev="' + ix + '">' + (s.status === "evaluated" ? "Re-evaluate" : "Evaluate") + "</button></div></div>"; }).join("") : '<div class="bm-empty">Abhi koi submission nahi.</div>') + '<div class="acts"><button class="bm-btn sec" data-c>Close</button></div></div>';
    document.body.appendChild(md); md.querySelector("[data-c]").onclick = function () { md.remove(); again(); };
    md.querySelectorAll("[data-ev]").forEach(function (b) { b.onclick = function () { var s = a.subs[+b.dataset.ev];
      c.form("Evaluate — " + (s.name || s.mobile), [{ k: "marks", l: "Marks (max " + (a.maxMarks || 0) + ")", t: "number", r: 1 }, { k: "feedback", l: "Feedback", t: "textarea" }], { marks: s.marks == null ? "" : s.marks, feedback: s.feedback || "" }, function (o) {
        var mk = +o.marks; if (isNaN(mk) || mk < 0 || (a.maxMarks && mk > a.maxMarks)) { c.toast("Marks 0 se " + a.maxMarks + " ke beech hone chahiye"); return false; }
        return sub(c, c.A.inst, bf, "assignments").doc(a.id).collection("submissions").doc(s.mobile).update({ marks: mk, feedback: o.feedback || "", status: "evaluated", evaluatedBy: c.adminEmail(), evaluatedAt: c.FV().serverTimestamp() }).then(function () { c.audit("assignment.evaluate", a.id + ":" + s.mobile); s.marks = mk; s.feedback = o.feedback; s.status = "evaluated"; md.remove(); subsView(c, a, bf, again); });
      }); }; });
  }

  /* =================== ADMIN: Reports & Attendance =================== */
  EXT.adminViews.reports = { icon: "📈", label: "Reports & Attendance", render: function (m, c) {
    if (!c.A.batches.length) return noBatch(m);
    var bf = c.A.f.batch && batchOf(c, c.A.f.batch) ? c.A.f.batch : c.A.batches[0].id; c.A.f.batch = bf; m.innerHTML = '<div class="bm-empty">Report ban rahi hai…</div>';
    var inst = c.A.inst;
    Promise.all([sub(c, inst, bf, "attendance").get(), sub(c, inst, bf, "members").get(), sub(c, inst, bf, "doubts").get().catch(function () { return { docs: [] }; }), sub(c, inst, bf, "assignments").get()]).then(function (r) {
      var att = r[0].docs.map(function (d) { return d.data(); }), mem = r[1].docs.map(function (d) { return Object.assign({ mobile: d.id }, d.data()); }), dbt = r[2].docs.map(function (d) { return d.data(); });
      var its = c.A.items[bf] || [], classes = its.filter(function (i) { return i.kind === "class" && (i.status === "completed" || i.status === "live"); }).sort(function (a, b) { return c.ms(b.scheduledAt) - c.ms(a.scheduledAt); });
      var per = {}; att.forEach(function (a) { (per[a.itemId] = per[a.itemId] || []).push(a); });
      var stuAtt = {}; att.forEach(function (a) { stuAtt[a.mobile] = (stuAtt[a.mobile] || 0) + 1; });
      var enrolled = (batchOf(c, bf) || {}).enrolledCount || mem.length;
      var kinds = [["class", "Live Classes"], ["recording", "Recordings"], ["note", "Notes"], ["material", "Study Material"], ["ppt", "PPT"], ["announcement", "Announcements"]];
      m.innerHTML = batchBar(c, m) + '<div class="bm-stats">' + [["Enrolled", enrolled], ["Classes Held", classes.length], ["Open Doubts", dbt.filter(function (d) { return d.status === "open"; }).length], ["Assignments", r[3].docs.length]].map(function (s) { return '<div class="bm-stat"><small>' + s[0] + "</small><b>" + s[1] + "</b></div>"; }).join("") + "</div>" +
        '<div class="bm-card"><h3>Content summary</h3>' + kinds.map(function (k) { return '<div class="bm-row"><div class="g">' + k[1] + "</div><b>" + its.filter(function (i) { return i.kind === k[0]; }).length + "</b></div>"; }).join("") + "</div>" +
        '<div class="bm-card"><h3>Class-wise attendance</h3><div class="bm-tablewrap"><table class="bm-table"><tr><th>Class</th><th>Date</th><th>Attended</th><th>Verified</th><th>%</th></tr>' + (classes.length ? classes.map(function (cl) { var a = per[cl.id] || [], v = a.filter(function (x) { return x.v; }).length; return "<tr><td>" + c0(cl.title) + "</td><td>" + c.fdate(cl.scheduledAt) + "</td><td>" + a.length + "</td><td>" + v + "</td><td>" + (enrolled ? Math.round(100 * a.length / enrolled) : 0) + "%</td></tr>"; }).join("") : '<tr><td colspan="5"><div class="bm-empty">Abhi koi class nahi hui.</div></td></tr>') + "</table></div></div>" +
        '<div class="bm-card"><h3>Student-wise attendance</h3><div class="bm-tablewrap"><table class="bm-table"><tr><th>Student</th><th>Mobile</th><th>Attended</th><th>%</th></tr>' + (mem.length ? mem.map(function (s) { var n = stuAtt[s.mobile] || 0; return "<tr><td>" + c0(s.name || "—") + "</td><td>" + c0(s.mobile) + "</td><td>" + n + "/" + classes.length + "</td><td>" + (classes.length ? Math.round(100 * n / classes.length) : 0) + "%</td></tr>"; }).join("") : '<tr><td colspan="4"><div class="bm-empty">Koi student nahi.</div></td></tr>') + '</table></div></div><button class="bm-btn" id="bx-csv">⬇ Attendance CSV</button><div class="bm-note">“Verified” = haziri tab likhi gayi jab student ka login rules me verify tha (Strict Mode). Unverified haziri pakki nahi hoti.</div>';
      bindBatch(c, m, function () { EXT.adminViews.reports.render(m, c); });
      m.querySelector("#bx-csv").onclick = function () {
        var rows = [["Student", "Mobile", "Attended", "Total Classes", "Percent"]].concat(mem.map(function (s) { var n = stuAtt[s.mobile] || 0; return [s.name || "", s.mobile, n, classes.length, classes.length ? Math.round(100 * n / classes.length) : 0]; }));
        var csv = rows.map(function (r) { return r.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(","); }).join("\n"), a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" })); a.download = "attendance-" + c0(c.batchName(bf)).replace(/\W+/g, "_") + ".csv"; a.click();
      };
    }).catch(function (e) { m.innerHTML = '<div class="bm-empty">Report load nahi hui (' + c0(e.code || e.message) + "). Firestore Rules publish kiye?</div>"; });
  } };

  /* =================== ADMIN: Teachers =================== */
  EXT.adminViews.teachers = { icon: "👨‍🏫", label: "Teachers", render: function (m, c) {
    var inst = c.A.inst; m.innerHTML = '<div class="bm-empty">Loading…</div>';
    c.DB().collection("institutes").doc(inst).collection("teachers").get().then(function (q) {
      var ts = q.docs.map(function (d) { return plain(d, c); }).sort(function (a, b) { return norm(a.name) < norm(b.name) ? -1 : 1; });
      c.topBtn("+ Add Teacher", function () { teacherForm(c, null, m); });
      m.innerHTML = '<div class="bm-note">Teacher profile aur assignments yahan manage hote hain (batch cards par naam dikhta hai). Teacher ka alag login abhi nahi hai — content admin account se hi upload hota hai.</div>' + (ts.length ? ts.map(function (t, ix) {
        return '<div class="bm-card"><div class="bm-row"><div class="g"><b>' + c0(t.name) + "</b><small>" + c0([t.mobile, t.email].filter(Boolean).join(" • ")) + '</small></div><span class="bm-badge ' + (t.status === "inactive" ? "o" : "") + '">' + (t.status === "inactive" ? "Inactive" : "Active") + "</span></div>" +
          "<small>Batches: " + c0((t.batchIds || []).map(c.batchName).join(", ") || "—") + "<br>Subjects: " + c0((t.subjects || []).join(", ") || "—") + "<br>Permissions: " + ["live", "upload", "doubts"].filter(function (k) { return t.perm && t.perm[k]; }).map(function (k) { return { live: "Live class", upload: "Upload", doubts: "Doubts" }[k]; }).join(", ") + '</small><div class="bm-act" style="margin-top:6px"><button class="bm-btn sec sm" data-te="' + ix + '">Edit</button><button class="bm-btn red sm" data-tx="' + ix + '">Delete</button></div></div>'; }).join("") : '<div class="bm-card bm-empty">Abhi koi teacher nahi.</div>');
      m.querySelectorAll("[data-te]").forEach(function (b) { b.onclick = function () { teacherForm(c, ts[+b.dataset.te], m); }; });
      m.querySelectorAll("[data-tx]").forEach(function (b) { b.onclick = function () { var t = ts[+b.dataset.tx]; if (!c.sure('Teacher "' + t.name + '" delete karein? (batch par naam bhi hat jaayega)')) return; syncTeacherNames(c, t, []).then(function () { return c.DB().collection("institutes").doc(inst).collection("teachers").doc(t.id).delete(); }).then(function () { c.audit("teacher.delete", t.id); return c.loadAll(); }).then(function () { EXT.adminViews.teachers.render(m, c); }); }; });
    }).catch(function (e) { m.innerHTML = '<div class="bm-empty">Load nahi hua (' + c0(e.code || e.message) + "). Firestore Rules publish kiye?</div>"; });
  } };
  function syncTeacherNames(c, t, newBatches) {   /* batch.teachers me sirf is teacher ka naam add/remove */
    var all = {}; (t.batchIds || []).concat(newBatches).forEach(function (b) { all[b] = 1; });
    return Promise.all(Object.keys(all).map(function (b) { var bt = batchOf(c, b); if (!bt) return null; var cur = (bt.teachers || []).filter(function (x) { return x !== t.name; });
      if (newBatches.indexOf(b) > -1) cur.push(t.newName || t.name); return c.bref(c.A.inst, b).update({ teachers: cur, updatedAt: c.FV().serverTimestamp() }); }));
  }
  function teacherForm(c, t, m) {
    var md = document.createElement("div"); md.className = "bm-modal"; var cur = t || { perm: { live: true, upload: true, doubts: true }, batchIds: [], status: "active" };
    md.innerHTML = '<div class="bm-sheet"><h3>' + (t ? "Edit Teacher" : "Add Teacher") + '</h3><div class="bm-form"><label>Name *</label><input id="bt-n" value="' + c0(cur.name || "") + '"><label>Mobile</label><input id="bt-m" value="' + c0(cur.mobile || "") + '"><label>Email</label><input id="bt-e" value="' + c0(cur.email || "") + '"><label>Subjects (comma se alag)</label><input id="bt-s" value="' + c0((cur.subjects || []).join(", ")) + '">' +
      "<label>Assigned Batches</label>" + c.A.batches.map(function (b) { return '<label class="bx-chk"><input type="checkbox" data-bb="' + b.id + '"' + ((cur.batchIds || []).indexOf(b.id) > -1 ? " checked" : "") + "> " + c0(b.name) + "</label>"; }).join("") +
      "<label>Permissions</label>" + [["live", "Live class chala sakta hai"], ["upload", "Content upload kar sakta hai"], ["doubts", "Student doubts dekh/jawab de sakta hai"]].map(function (p) { return '<label class="bx-chk"><input type="checkbox" data-pp="' + p[0] + '"' + (cur.perm && cur.perm[p[0]] ? " checked" : "") + "> " + p[1] + "</label>"; }).join("") +
      '<label>Status</label><select id="bt-st"><option value="active"' + (cur.status !== "inactive" ? " selected" : "") + '>Active</option><option value="inactive"' + (cur.status === "inactive" ? " selected" : "") + '>Inactive</option></select><div class="acts"><button class="bm-btn sec" data-c>Cancel</button><button class="bm-btn" data-s>Save</button></div></div></div>';
    document.body.appendChild(md); md.querySelector("[data-c]").onclick = function () { md.remove(); };
    md.querySelector("[data-s]").onclick = function () {
      var name = md.querySelector("#bt-n").value.trim(); if (!name) return c.toast("Name zaroori hai");
      var bids = [].slice.call(md.querySelectorAll("[data-bb]")).filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.bb; }), perm = {}; md.querySelectorAll("[data-pp]").forEach(function (x) { perm[x.dataset.pp] = x.checked; });
      var d = { instituteId: c.A.inst, name: name, mobile: md.querySelector("#bt-m").value.trim(), email: md.querySelector("#bt-e").value.trim().toLowerCase(), subjects: md.querySelector("#bt-s").value.split(",").map(function (x) { return x.trim(); }).filter(Boolean), batchIds: bids, perm: perm, status: md.querySelector("#bt-st").value, updatedAt: c.FV().serverTimestamp() };
      var col = c.DB().collection("institutes").doc(c.A.inst).collection("teachers"), old = t ? { name: t.name, batchIds: t.batchIds || [] } : { name: name, batchIds: [] }; old.newName = name;
      var p = t ? col.doc(t.id).update(d) : col.add(Object.assign(d, { createdAt: c.FV().serverTimestamp(), createdBy: c.adminEmail() }));
      this.disabled = true;
      p.then(function () { return syncTeacherNames(c, old, d.status === "inactive" ? [] : bids); }).then(function () { c.audit(t ? "teacher.update" : "teacher.create", name); return c.loadAll(); }).then(function () { md.remove(); c.toast("✅ Teacher save ho gaya"); EXT.adminViews.teachers.render(m, c); }).catch(function (e) { c.toast("Save nahi hua: " + (e.code || e.message)); md.querySelector("[data-s]").disabled = false; });
    };
  }

  /* =================== ADMIN: Institute Settings (Strict Mode) =================== */
  EXT.adminViews.settings2 = { icon: "⚙️", label: "Institute Settings", render: function (m, c) {
    var inst = c.A.inst; m.innerHTML = '<div class="bm-empty">Loading…</div>';
    Promise.all([secRef(c, inst).get(), c.DB().collection("institutes").doc(inst).get().catch(function () { return null; })]).then(function (rr) { var d = rr[0], idoc = rr[1], chUrl = (idoc && idoc.exists && idoc.data().youtubeChannelUrl) || ""; var on = !!(d.exists && d.data().strict); X.strict[inst] = on;
      m.innerHTML = '<div class="bm-card"><h3>🔒 Strict Security Mode — ' + (on ? '<span class="bm-badge">ON</span>' : '<span class="bm-badge o">OFF</span>') + "</h3>" +
        '<p style="font-size:.86rem">ON hone par server khud verify karta hai ki student kaun hai aur kis batch ka member hai. Tab sirf enrolled students hi batch ka content, files, recordings, assignments aur apne doubts dekh sakte hain — URL/ID guess karke ya doosre institute se kuch nahi khulta. Doubt Solving aur Assignment submission sirf Strict Mode me chalte hain.</p>' +
        '<div class="bm-note"><b>ON karne se pehle:</b> (1) naye <code>firestore.rules</code> Firebase me Publish karein, (2) app update students tak pahunch jaye, (3) students ek baar logout → login karein (isse unka verified session banta hai). Jo student login nahi karega use batch me "dobara login karein" dikhega.<br>Kuch bigad jaye to yahan se OFF kar dein — turant purana behaviour wapas.</div>' +
        '<button class="bm-btn' + (on ? " red" : "") + '" id="bx-strict">' + (on ? "Strict Mode OFF karein" : "Strict Mode ON karein") + "</button></div>" +
        '<div class="bm-card"><h3>Institute</h3><div class="bm-row"><div class="g">Institute ID</div><code>' + c0(inst) + "</code></div><div class=\"bm-row\"><div class=\"g\">Admin</div><span>" + c0(c.adminEmail()) + "</span></div></div>" +
        '<div class="bm-card"><h3>📚 Catalog (reads kam)</h3><div class="bm-note">Student ko batch ki list chhote "catalog" se milti hai (bahut kam reads). Ye admin ke har badlaav par apne aap theek hota hai. Kuch galat dikhe to yahan se dobara banayein.</div><button class="bm-btn" id="bx-cat">Catalog dobara banayein</button></div>' +
        '<div class="bm-card" id="bx-drv"></div>' +
        '<div class="bm-card"><h3>▶ YouTube</h3><label>Institute ka YouTube channel link (optional)</label><input id="bx-yc" type="url" placeholder="https://www.youtube.com/@aapkachannel" value="' + c0(chUrl) + '"><div class="bm-note">Student ko batch page par "Channel dekho" link dikhega. Sirf https://youtube.com/… link chalega.</div><button class="bm-btn" id="bx-ycs">Save</button>' +
        '<div class="bm-note" style="margin-top:10px">ℹ️ Live/recording ke liye <b>Unlisted</b> YouTube link use karein. Unlisted link koi bhi forward kar sakta hai — ye poori suraksha nahi hai. App link student ko seedha nahi dikhati, sirf andar embed karti hai.</div></div>';
      (function drv() {
        var box = m.querySelector("#bx-drv"), sd = window.SnapDrive; if (!box || !sd) return;
        var hasId = !!(window.SNAP_CONFIG || {}).googleClientId;
        sd.status(inst, true).then(function (s) {
          var on = s.connected;
          box.innerHTML = "<h3>💾 Mera Storage (Google Drive) — " + (on ? '<span class="bm-badge">Jura hai</span>' : '<span class="bm-badge o">Jura nahi</span>') + "</h3>" +
            (on ? '<div class="bm-row"><div class="g">Account</div><b>' + c0(s.email || "—") + '</b></div><div class="bm-row"><div class="g">Files / use</div><span>' + (s.files || 0) + " files • " + (s.usedMB || 0) + " MB</span></div>"
                : '<div class="bm-note">' + (hasId ? "Apna Google Drive jodein — files aapke apne Drive me rahengi (data aapka)." : "Drive jodne ka setup abhi baaki hai (Owner ko batayein). Tab tak links/YouTube chalte rahenge.") + "</div>") +
            '<div class="bm-note">💡 Institute ke naam ka <b>alag Google account</b> use karein (personal se nahi) — admin badle to files saath na jaayein. App sirf apni banayi hui files dekh sakta hai.</div>' +
            '<button class="bm-btn" id="bx-dc"' + (hasId ? "" : " disabled") + ">" + (hasId ? (on ? "Account badlein" : "Drive jodein") : "Setup baaki hai") + "</button>" +
            (on ? ' <button class="bm-btn" id="bx-do">📂 Drive folder kholein</button> <button class="bm-btn red" id="bx-dd">Disconnect</button>' : "");
          var bc = box.querySelector("#bx-dc"), bo = box.querySelector("#bx-do"), bd = box.querySelector("#bx-dd");
          bc && (bc.onclick = function () { bc.disabled = true; sd.connect(inst).then(function () { c.audit("institute.driveConnect", inst); c.toast("✅ Drive jur gaya"); drv(); try { c.driveBanner(); } catch (e) {} }, function (e) { bc.disabled = false; c.toast("Drive nahi juda: " + (e && e.message || e)); }); });
          bo && (bo.onclick = function () { sd.folderUrl(inst).then(function (u) { window.open(u, "_blank", "noopener"); }, function (e) { c.toast("Folder nahi khula: " + (e && e.message || e)); }); });
          bd && (bd.onclick = function () { if (!confirm("Drive disconnect karein? Purani files Drive me rahengi, par nayi upload band hogi.")) return; sd.disconnect(inst).then(function () { c.audit("institute.driveDisconnect", inst); c.toast("Disconnect ho gaya"); drv(); }, function (e) { c.toast("Nahi hua: " + (e.code || e.message)); }); });
        });
      })();
      m.querySelector("#bx-cat").onclick = function () {
        var bt = this; if (!window.SnapCatalog) return c.toast("Catalog module load nahi hua"); bt.disabled = true;
        window.SnapCatalog.syncAll(c.A.inst, c.A.batches, c.A.items, true).then(function () { bt.disabled = false; c.toast("✅ Catalog ban gaya (" + c.A.batches.length + " batch)"); }, function () { bt.disabled = false; c.toast("Catalog nahi bana"); });
      };
      m.querySelector("#bx-ycs").onclick = function () {
        var v = m.querySelector("#bx-yc").value.trim();
        if (v && !/^https:\/\/(www\.|m\.)?youtube\.com\/[^\s]{1,150}$/i.test(v)) return c.toast("Sirf https://youtube.com/… link daalein");
        c.DB().collection("institutes").doc(inst).update({ youtubeChannelUrl: v }).then(function () { try { window.SnapBrand && window.SnapBrand.load(inst, true); } catch (e) {} c.audit("institute.youtubeChannel", inst); c.toast("✅ Save ho gaya"); }).catch(function (e) { c.toast("Nahi hua: " + (e.code || e.message)); });
      };
      m.querySelector("#bx-strict").onclick = function () {
        if (!c.sure(on ? "Strict Mode OFF karein?" : "Strict Mode ON karein?\n\nPehle rules publish ho chuke hon aur students ko ek baar re-login karna hoga.")) return;
        secRef(c, inst).set({ strict: !on, updatedAt: c.FV().serverTimestamp(), by: c.adminEmail() }, { merge: true }).then(function () { c.audit("security.strict." + (!on), inst); c.toast("✅ Update ho gaya"); EXT.adminViews.settings2.render(m, c); }).catch(function (e) { c.toast("Nahi hua: " + (e.code || e.message)); });
      };
    }).catch(function (e) { m.innerHTML = '<div class="bm-empty">Load nahi hua (' + c0(e.code || e.message) + ")</div>"; });
  } };


  /* =================== ADMIN: Bulk YouTube recordings (v217) =================== */
  function ytTitle(id) {   /* best-effort oEmbed (koi API key nahi); fail ho to "" */
    return new Promise(function (res) {
      var done = false, fin = function (v) { if (!done) { done = true; res(v || ""); } }, tm = setTimeout(function () { fin(""); }, 4000);
      try { fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + id)).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { clearTimeout(tm); fin(j && j.title ? String(j.title).slice(0, 200) : ""); }).catch(function () { fin(""); }); } catch (e) { fin(""); }
    });
  }
  EXT.adminViews.bulkyt = { icon: "📥", label: "Bulk YouTube Add", render: function (m, c) {
    if (!c.A.batches.length) return noBatch(m);
    var redraw = function () { EXT.adminViews.bulkyt.render(m, c); }, bf0;
    m.innerHTML = batchBar(c, m, redraw) + '<div class="bm-card"><h3>📥 Bulk YouTube recordings</h3><p style="font-size:.86rem">Ek line = ek video. Format: <code>link | title | subject | chapter</code> (title, subject, chapter optional). Sab recordings "Ready" (unpublished) banengi — aap dekhkar Publish karein. Ek baar me max 400 lines.</p><textarea id="bx-bt" rows="8" style="width:100%" placeholder="https://youtu.be/xxxxxxxxxxx | Lecture 1 | Physics | Motion"></textarea><div style="margin-top:8px"><button class="bm-btn" id="bx-bp">Preview</button></div><div id="bx-bv"></div></div>';
    bindBatch(c, m, redraw); bf0 = c.A.f.batch;
    var rows = [];
    m.querySelector("#bx-bp").onclick = function () {
      var lines = m.querySelector("#bx-bt").value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), box = m.querySelector("#bx-bv");
      if (!lines.length) return c.toast("Pehle links paste karein");
      if (lines.length > 400) return c.toast("Ek baar me max 400 lines — baki alag se paste karein");
      var have = {}; (c.A.items[bf0] || []).forEach(function (i) { if (i.kind === "recording" && i.ytId) have[i.ytId] = 1; });
      var seen = {};
      rows = lines.map(function (ln, k) {
        var p = ln.split("|").map(function (x) { return x.trim(); }), id = c.ytId(p[0]), r = { n: k + 1, id: id, title: (p[1] || "").slice(0, 200), subject: p[2] || "", chapter: p[3] || "", err: "" };
        if (!id) r.err = "Link sahi nahi"; else if (seen[id]) r.err = "Isi paste me dobara"; else if (have[id]) r.err = "Batch me pehle se hai";
        if (!r.err && (r.subject || r.chapter)) { var ve = EXT.validateItem({ batchId: bf0, subject: r.subject, chapter: r.chapter }, "recording"); if (ve) r.err = ve; }
        if (id) seen[id] = 1; return r;
      });
      box.innerHTML = '<div class="bm-note">Title fetch ho raha hai…</div>';
      Promise.all(rows.map(function (r) { return !r.err && !r.title ? ytTitle(r.id).then(function (t) { r.title = t; r.auto = !!t; }) : null; })).then(function () {
        rows.forEach(function (r) { if (!r.err && !r.title) r.title = "YouTube Lecture " + r.id; });
        var ok = rows.filter(function (r) { return !r.err; });
        box.innerHTML = '<div class="bm-tablewrap"><table class="bm-table"><tr><th>#</th><th>Video ID</th><th>Title</th><th>Subject / Chapter</th><th>Status</th></tr>' + rows.map(function (r) { return '<tr' + (r.err ? ' style="background:#fee2e2;color:#991b1b"' : "") + "><td>" + r.n + "</td><td>" + c0(r.id || "—") + "</td><td>" + c0(r.title || "—") + "</td><td>" + c0((r.subject || "—") + (r.chapter ? " / " + r.chapter : "")) + "</td><td>" + (r.err ? c0(r.err) : "OK") + "</td></tr>"; }).join("") + '</table></div><div style="margin-top:8px"><b>' + ok.length + "</b> valid, <b>" + (rows.length - ok.length) + '</b> galat (save nahi hongi).</div>' + (ok.length ? '<button class="bm-btn" id="bx-bs" style="margin-top:8px">' + ok.length + " recordings Save karein</button>" : "");
        var sb = box.querySelector("#bx-bs"); if (!sb) return;
        sb.onclick = function () {
          sb.disabled = true; var db = c.DB(), FV = c.FV, col = c.bref(c.A.inst, bf0).collection("items"), chunks = [];
          for (var i = 0; i < ok.length; i += 400) chunks.push(ok.slice(i, i + 400));
          chunks.reduce(function (pr, ch) { return pr.then(function () { var wb = db.batch(); ch.forEach(function (r) { var d = { batchId: bf0, instituteId: c.A.inst, kind: "recording", title: r.title, desc: "", subject: r.subject, chapter: r.chapter, durationMin: 0, teacher: "", status: "ready", published: false, url: c.ytWatch(r.id), ytId: r.id, createdAt: FV().serverTimestamp(), createdBy: c.adminEmail(), updatedAt: FV().serverTimestamp() }; EXT.stampIds(d, { batchId: bf0, subject: r.subject, chapter: r.chapter }); wb.set(col.doc(), d); }); return wb.commit(); }); }, Promise.resolve())
            .then(function () { c.audit("item.bulkyt", String(ok.length)); c.toast("✅ " + ok.length + " recordings save hui (Ready — Publish baaki)"); return c.loadAll().then(function () { c.adminGo("recording"); }); })
            .catch(function (e) { sb.disabled = false; c.toast("Save nahi hua: " + (e.code || e.message)); });
        };
      });
    };
  } };

  /* =================== STUDENT side =================== */
  function me() { var s = C().sess(); return s ? { mobile: String(s.mobile), name: s.name || "" } : null; }
  function strictFor(c) { var inst = c.S.inst; if (X.strict[inst] !== undefined) return Promise.resolve(X.strict[inst]); return secRef(c, inst).get().then(function (d) { return (X.strict[inst] = !!(d.exists && d.data().strict)); }).catch(function () { return false; }); }
  function progRef(c, b) { return sub(c, c.S.inst, b, "progress").doc(me().mobile); }
  
  var COUNTABLE = ["recording", "note", "material", "ppt"];
  EXT.hooks.open = function (it, b) {
    try { if (!it || COUNTABLE.indexOf(it.kind) < 0 || !b) return; var c = C(), m = me(); if (!m) return; X.prog[b] = X.prog[b] || {}; if (X.prog[b][it.id]) return; X.prog[b][it.id] = 1;
      var o = {}; o["done." + it.id] = 1; progRef(c, b).set({ mobile: m.mobile, done: (function () { var d = {}; d[it.id] = Date.now(); return d; })(), updatedAt: c.FV().serverTimestamp() }, { merge: true }).catch(function () {}); } catch (e) {}
  };
  EXT.hooks.join = function (it, b) {
    try { if (!it || it.kind !== "class" || !b) return; var c = C(), m = me(); if (!m) return;
      var ref = sub(c, c.S.inst, b, "attendance").doc(it.id + "_" + m.mobile), write = function (v) { return ref.set({ mobile: m.mobile, name: m.name, itemId: it.id, joinedAt: c.FV().serverTimestamp(), v: v }); };
      var chk = window.SnapSession ? window.SnapSession.check(m.mobile) : Promise.resolve(false);
      chk.then(function (v) { return write(!!v).catch(function () { return write(!v); }); }).catch(function () {}); } catch (e) {}
  };

  function itemsOf(c, b) { return c.S.items[b.id] || []; }
  function ic(i) { return { class: "🔴", recording: "🎬", note: "📄", material: "📚", ppt: "📊", announcement: "📢" }[i.kind] || "📄"; }
  function itemRow(c, i) {
    var act = i.kind === "class" ? (i.status === "live" && (i.liveRoom || i.liveUrl || i.ytId || i._lv) ? '<button class="go" style="background:#ef4444" data-xl="' + i.id + '">Join</button>' : '<span class="bm-badge ' + (i.status === "completed" ? "" : "b") + '">' + (i.status === "completed" ? "Done" : i.status === "cancelled" ? "Cancelled" : "Upcoming") + "</span>") : c.hasFile(i) ? '<button class="go" data-xv="' + i.id + '">' + (i.kind === "recording" ? "▶ Play" : "View") + "</button>" : "";
    return '<div class="bm-item"><div class="ic">' + ic(i) + '</div><div class="g"><b>' + c0(i.title) + "</b><small>" + c0(i.kind === "class" ? c.fdate(i.scheduledAt) : (i.cat || "")) + "</small></div>" + act + "</div>";
  }
  function bindItems(c, b, box) {
    var its = itemsOf(c, b);
    box.querySelectorAll("[data-xv]").forEach(function (x) { x.onclick = function () { var i = its.filter(function (k) { return k.id === x.dataset.xv; })[0]; EXT.hooks.open(i, b.id); c.openItem(i, c.S.inst); }; });
    box.querySelectorAll("[data-xl]").forEach(function (x) { x.onclick = function () { var i = its.filter(function (k) { return k.id === x.dataset.xl; })[0]; EXT.hooks.join(i, b.id); c.joinLive(i); }; });
  }

  /* v199 SPEED: Subjects tab ab saved data se TURANT khulta hai (memory ya phone me saved), fresh data peeche se aata hai
     (2 min me ek hi baar) aur screen sirf tab badalti hai jab subjects/chapters/progress sach me badle. */
  var XK = function (c, b) { var m = me(); return "snap_bm_x_" + (m ? m.mobile : "") + "_" + b; };
  function xSig(b) { try { var st = X.struct[b]; return JSON.stringify([(st ? st.subjects : []).map(function (s) { return [s.id, s.name, s.order, (s.chapters || []).map(function (h) { return [h.id, h.name, h.order]; })]; }), Object.keys(X.prog[b] || {}).length, X.nAsg && X.nAsg[b]]); } catch (e) { return String(Date.now()); } }
  function xWarm(c, b) {
    if (X.struct[b] && X.struct[b].stu) return true;
    try {
      var D = window.SnapDiet, z = D && D.cget && D.cget(XK(c, b), 14 * 864e5); z = z && z.items; if (!z || !Array.isArray(z.subjects)) return false;
      X.struct[b] = { subjects: z.subjects, stu: true, at: 0 }; if (!X.prog[b]) X.prog[b] = z.prog || {}; X.nAsg = X.nAsg || {}; X.nAsg[b] = z.nAsg || 0; return true;
    } catch (e) { return false; }
  }
  function xSave(c, b) { try { var D = window.SnapDiet; if (D && D.cset && X.struct[b]) D.cset(XK(c, b), 0, { subjects: X.struct[b].subjects, prog: X.prog[b] || {}, nAsg: (X.nAsg && X.nAsg[b]) || 0 }); } catch (e) {} }
  /* network se fresh lena: struct + progress + assignments count ek saath; fail ho to purana data bana rehta hai */
  function xRefresh(c, inst, b) {
    X.fetched = X.fetched || {}; X.nAsg = X.nAsg || {};
    if (X.fetched[b] && Date.now() - X.fetched[b] < 120000) return Promise.resolve(false);
    X.fetched[b] = Date.now();
    var before = xSig(b), had = !!X.struct[b];
    return Promise.all([
      loadStruct(c, inst, b, true).then(function () { return true; }, function () { return false; }),
      progRef(c, b).get().then(function (d) { var sv = (d.exists && d.data().done) || {}; X.prog[b] = Object.assign({}, sv, X.prog[b] || {}); return true; }, function () { return false; }),
      sub(c, inst, b, "assignments").where("published", "==", true).get().then(function (q) { X.nAsg[b] = q.docs.length; return true; }, function () { return false; })
    ]).then(function (ok) {
      if (!ok[0] && !had) X.struct[b] = { subjects: [], at: Date.now() };
      if (!ok[0] && !ok[1] && !ok[2]) X.fetched[b] = 0;
      if (ok[0]) xSave(c, b);
      return xSig(b) !== before;
    });
  }
  EXT.prefetchBatch = function (bt, c) { try { var m = me(); if (!m || !bt) return; return xRefresh(c, c.S.inst, bt.id); } catch (e) {} };
  EXT.studentTabs.subjects = { label: "Subjects", render: function (b, box, c) {
    var inst = c.S.inst, v = X.sv; if (v.b !== b.id) { v = X.sv = { b: b.id }; }
    X.nAsg = X.nAsg || {};
    function paint() {
      var subs = (X.struct[b.id] && X.struct[b.id].subjects) || []; v.nAsg = X.nAsg[b.id] || 0;
      if (v.cid) { var s = subs.filter(function (x) { return x.id === v.sid; })[0], ch = s && s.chapters.filter(function (x) { return x.id === v.cid; })[0]; if (s && ch) return chapterPage(c, b, box, s, ch); }
      if (v.sid) { var s2 = v.sid.indexOf("legacy:") === 0 ? subjectsFor(c, b.id).filter(function (x) { return x.name === v.sid.slice(7); })[0] : subs.filter(function (x) { return x.id === v.sid; })[0]; if (s2) return subjectPage(c, b, box, s2); }
      dashPage(c, b, box, subs);
    }
    var warm = xWarm(c, b.id), drawn = false;
    if (warm) { try { paint(); drawn = true; } catch (e) { console.warn(e); } }
    var sg = drawn ? xSig(b.id) : "";
    xRefresh(c, inst, b.id).then(function (changed) {
      if (drawn && !changed && xSig(b.id) === sg) return;
      if (!box.isConnected) return;
      var cur = SB.ctx().S; if (cur.cur !== b.id) return;
      paint();
    }).catch(function (e) { if (!drawn) box.innerHTML = '<div class="bm-empty">Load nahi hua. Internet check karein.</div>'; });
  } };
  function rerender(c, b, box) { EXT.studentTabs.subjects.render(b, box, c); }
  /* v217: institute ka YouTube channel (SnapBrand cache se — koi naya Firestore read nahi) */
  function chanUrl(c) { try { var d = window.SnapBrand && window.SnapBrand.cached(c.S.inst); var u = d && d.youtubeChannelUrl; return /^https:\/\/(www\.|m\.)?youtube\.com\//i.test(u || "") ? u : ""; } catch (e) { return ""; } }
  function chanLink(c) { var u = chanUrl(c); return u ? '<div class="bm-note"><a href="' + c0(u) + '" target="_blank" rel="noopener noreferrer">▶ Institute ka YouTube channel dekho ↗</a></div>' : ""; }
  function dashPage(c, b, box, subs) {
    var its = itemsOf(c, b), done = X.prog[b.id] || {}, cnt = its.filter(function (i) { return COUNTABLE.indexOf(i.kind) > -1; }), dn = cnt.filter(function (i) { return done[i.id]; }).length, pct = cnt.length ? Math.round(100 * dn / cnt.length) : 0;
    var live = its.filter(function (i) { return i.kind === "class" && i.status === "live" && (i.liveRoom || i.liveUrl || i.ytId || i._lv); })[0], nxt = its.filter(function (i) { return i.kind === "class" && i.status === "upcoming" && c.ms(i.scheduledAt) >= Date.now() - 36e5; }).sort(function (a, z) { return c.ms(a.scheduledAt) - c.ms(z.scheduledAt); })[0];
    var rec = its.filter(function (i) { return i.kind === "recording"; }).sort(function (a, z) { return c.ms(z.createdAt) - c.ms(a.createdAt); }).slice(0, 3), nts = its.filter(function (i) { return i.kind === "note" || i.kind === "material"; }).sort(function (a, z) { return c.ms(z.createdAt) - c.ms(a.createdAt); }).slice(0, 3), ann = its.filter(function (i) { return i.kind === "announcement"; }).sort(function (a, z) { return c.ms(z.createdAt) - c.ms(a.createdAt); }).slice(0, 2);
    var list = subs.length ? subs : subjectsFor(c, b.id);
    box.innerHTML = '<div class="bx-prog"><div><b>Aapki progress</b><small>' + dn + "/" + cnt.length + ' lectures/notes dekhe</small></div><div class="bx-bar"><i style="width:' + pct + '%"></i></div><b>' + pct + "%</b></div>" +
      (live ? '<div class="bm-next"><div>🔴 Live: ' + c0(live.title) + '</div><button data-xl="' + live.id + '">Join Now</button></div>' : nxt ? '<div class="bm-next"><div>Next Live Class<br><b>' + c.fdate(nxt.scheduledAt) + "</b> • " + c0(nxt.title) + "</div></div>" : "") +
      chanLink(c) +
      (ann.length ? '<div class="bm-list">' + ann.map(function (a) { return '<div class="bm-item"><div class="ic">📢</div><div class="g"><b>' + c0(a.title) + "</b><small>" + c0(a.desc || "") + "</small></div></div>"; }).join("") + "</div>" : "") +
      '<h4 class="bx-h">Subjects</h4><div class="bx-grid">' + (list.length ? list.map(function (s) { var n = its.filter(function (i) { return i.kind !== "announcement" && itemIn(i, s); }).length; return '<button class="bx-sc" data-ss="' + c0(s.id || "legacy:" + s.name) + '"><b>' + c0(s.name) + "</b><small>" + (s.chapters ? s.chapters.length : 0) + " chapters • " + n + " content</small></button>"; }).join("") : '<div class="bm-empty">Subjects abhi add nahi hue.</div>') + "</div>" +
      (b.teachers && b.teachers.length ? '<h4 class="bx-h">Teachers</h4><div>' + b.teachers.map(function (t) { return '<span class="bm-badge b" style="margin:0 6px 6px 0">👨‍🏫 ' + c0(t) + "</span>"; }).join("") + "</div>" : "") +
      (rec.length ? '<h4 class="bx-h">Recent recordings</h4><div class="bm-list">' + rec.map(function (i) { return itemRow(c, i); }).join("") + "</div>" : "") + (nts.length ? '<h4 class="bx-h">Recent notes</h4><div class="bm-list">' + nts.map(function (i) { return itemRow(c, i); }).join("") + "</div>" : "") +
      (X.sv.nAsg ? '<div class="bm-note">📝 ' + X.sv.nAsg + " assignment(s) — \"Assignments\" tab me dekhein</div>" : "");
    bindItems(c, b, box);
    var j = box.querySelector(".bm-next [data-xl]"); j && (j.onclick = function () { EXT.hooks.join(live, b.id); c.joinLive(live); });
    box.querySelectorAll("[data-ss]").forEach(function (x) { x.onclick = function () { var id = x.dataset.ss; if (id.indexOf("legacy:") === 0) { X.sv.sid = id; X.sv.cid = ""; } else { X.sv.sid = id; X.sv.cid = ""; } rerender(c, b, box); }; });
  }
  function subjectPage(c, b, box, s) {
    var its = itemsOf(c, b); var back = '<button class="bx-back" data-bk>← Subjects</button>';
    box.innerHTML = back + '<h3 class="bx-h2">' + c0(s.name) + '</h3>' + (s.desc ? "<p style=\"font-size:.84rem;color:#475569\">" + c0(s.desc) + "</p>" : "") +
      (s.chapters.length ? '<div class="bm-list">' + s.chapters.map(function (ch) { var n = its.filter(function (i) { return i.kind !== "announcement" && itemIn(i, s, ch); }).length; return '<div class="bm-item" data-ch="' + ch.id + '" style="cursor:pointer"><div class="ic">📖</div><div class="g"><b>Ch ' + (ch.number || "") + ": " + c0(ch.name) + "</b><small>" + n + ' content</small></div><span class="go">›</span></div>'; }).join("") + "</div>" : "") +
      (function () { var loose = its.filter(function (i) { return i.kind !== "announcement" && itemIn(i, s) && (!s.chapters.length || !s.chapters.some(function (ch) { return itemIn(i, s, ch); })); }); return loose.length ? '<h4 class="bx-h">' + (s.chapters.length ? "Other content" : "Content") + '</h4><div class="bm-list">' + loose.map(function (i) { return itemRow(c, i); }).join("") + "</div>" : (s.chapters.length ? "" : '<div class="bm-empty">Is subject me abhi content nahi hai.</div>'); })();
    box.querySelector("[data-bk]").onclick = function () { X.sv.sid = ""; X.sv.cid = ""; rerender(c, b, box); };
    box.querySelectorAll("[data-ch]").forEach(function (x) { x.onclick = function () { X.sv.cid = x.dataset.ch; rerender(c, b, box); }; }); bindItems(c, b, box);
  }
  function chapterPage(c, b, box, s, ch) {
    var its = itemsOf(c, b).filter(function (i) { return i.kind !== "announcement" && itemIn(i, s, ch); });
    var sec = [["class", "🔴 Live Classes", ["class"]], ["recording", "🎬 Recorded Lectures", ["recording"]], ["note", "📄 Notes", ["note"]], ["material", "📚 Study Material", ["material"]], ["ppt", "📊 PPT / Presentations", ["ppt"]]];
    box.innerHTML = '<button class="bx-back" data-bk>← ' + c0(s.name) + '</button><h3 class="bx-h2">Ch ' + (ch.number || "") + ": " + c0(ch.name) + "</h3>" + (ch.desc ? '<p style="font-size:.84rem;color:#475569">' + c0(ch.desc) + "</p>" : "") +
      sec.map(function (x) { var l = its.filter(function (i) { return x[2].indexOf(i.kind) > -1; }); return '<details class="bx-sec"' + (l.length ? " open" : "") + "><summary>" + x[1] + " (" + l.length + ')</summary><div class="bm-list">' + (l.length ? l.map(function (i) { return itemRow(c, i); }).join("") : '<div class="bm-empty">Abhi kuch nahi.</div>') + "</div></details>"; }).join("") +
      '<details class="bx-sec" id="bx-tl"><summary>📝 Chapter Tests</summary><div class="bm-list"><div class="bm-empty">Loading…</div></div></details><details class="bx-sec"><summary>❓ Doubt Solving</summary><div class="bm-list"><div class="bm-item"><div class="g"><b>Is chapter ka doubt poochein</b></div><button class="go" data-dq>Doubt poochein</button></div></div></details>';
    box.querySelector("[data-bk]").onclick = function () { X.sv.cid = ""; rerender(c, b, box); }; bindItems(c, b, box);
    box.querySelector("[data-dq]").onclick = function () { X.dq = { sid: s.id, subject: s.name, cid: ch.id, chapter: ch.name }; c.S.tab = "doubt"; c.sBatch(b.id); };
    sub(c, c.S.inst, b.id, "testLinks").get().then(function (q) {
      var l = q.docs.map(function (d) { return d.data(); }).filter(function (t) { return (!t.subjectId && !t.subject) || (t.subjectId ? t.subjectId === s.id && (!t.chapterId || t.chapterId === ch.id) : norm(t.subject) === norm(s.name) && (!t.chapter || norm(t.chapter) === norm(ch.name))); });
      var tl = box.querySelector("#bx-tl .bm-list"); if (!tl) return;
      tl.innerHTML = l.length ? l.map(function (t, ix) { return '<div class="bm-item"><div class="ic">📝</div><div class="g"><b>' + c0(t.title) + '</b></div><button class="go" data-ot="' + c0(t.testId) + '">Open</button></div>'; }).join("") : '<div class="bm-empty">Abhi koi test nahi.</div>';
      tl.querySelectorAll("[data-ot]").forEach(function (x) { x.onclick = function () { openTest(c, x.dataset.ot); }; });
    }).catch(function () { var tl = box.querySelector("#bx-tl .bm-list"); tl && (tl.innerHTML = '<div class="bm-empty">Tests load nahi hue.</div>'); });
  }
  function openTest(c, id) { c.closeStudent(); typeof goStudentSection === "function" && goStudentSection("student-form-fields-anchor"); setTimeout(function () { var s = document.getElementById("test-select"); if (s && [].some.call(s.options, function (o) { return o.value === id; })) { s.value = id; s.dispatchEvent(new Event("change", { bubbles: true })); } }, 400); }

  /* ---- student: Doubts ---- */
  function privateGate(c, box, what) {
    return strictFor(c).then(function (on) {
      if (!on) { box.innerHTML = '<div class="bm-card bm-empty">' + what + " abhi is institute me band hai.<br><small>Aapke data ko private rakhne ke liye admin ko Security Mode ON karna hoga.</small></div>"; return false; }
      return window.SnapSession ? window.SnapSession.check(me().mobile).then(function (ok) { if (!ok) box.innerHTML = '<div class="bm-card bm-empty">Is feature ke liye ek baar <b>logout karke dobara login</b> karein (aapka verified session banega).</div>'; return ok; }) : true;
    });
  }
  EXT.studentTabs.doubt = { label: "Doubts", render: function (b, box, c) {
    privateGate(c, box, "Doubt Solving").then(function (ok) {
      if (!ok) return; var m = me(); box.innerHTML = '<div class="bm-empty">Loading…</div>';
      Promise.all([sub(c, c.S.inst, b.id, "doubts").where("mobile", "==", m.mobile).get(), ensure(c, c.S.inst, b.id, true)]).then(function (r) {
        var ds = r[0].docs.map(function (d) { return plain(d, c); }).sort(function (a, z) { return z.createdMs - a.createdMs; }), dq = X.dq || null; X.dq = null;
        box.innerHTML = '<button class="bm-btn" id="bx-ask" style="margin-bottom:10px">＋ Naya Doubt Poochein</button>' + (ds.length ? ds.map(function (d, ix) { return '<div class="bm-card"><div class="bm-row"><div class="g"><b>' + c0([d.subject, d.chapter].filter(Boolean).join(" › ") || "General") + "</b><small>" + c.fdate(d.createdAt) + '</small></div><span class="bm-badge ' + (d.status === "open" ? "o" : d.status === "answered" ? "b" : "") + '">' + (d.status === "open" ? "Pending" : d.status === "answered" ? "Answered" : "Resolved") + "</span></div><p style=\"margin:6px 0;white-space:pre-wrap\">" + c0(d.text) + "</p>" + (d.img ? '<img src="' + d.img + '" style="max-width:100%;max-height:200px;border-radius:8px">' : "") + (d.answer ? '<div class="bx-ans"><small>Teacher ka jawab</small><div style="white-space:pre-wrap">' + c0(d.answer) + "</div></div>" : "") + (d.status === "answered" ? '<button class="bm-btn sec sm" data-rv="' + ix + '" style="margin-top:6px">✔ Doubt solve ho gaya</button>' : "") + "</div>"; }).join("") : '<div class="bm-card bm-empty">Aapne abhi koi doubt nahi poocha.</div>');
        box.querySelectorAll("[data-rv]").forEach(function (x) { x.onclick = function () { sub(c, c.S.inst, b.id, "doubts").doc(ds[+x.dataset.rv].id).update({ status: "resolved" }).then(function () { EXT.studentTabs.doubt.render(b, box, c); }); }; });
        var ask = function (pre) { doubtForm(c, b, box, pre); }; box.querySelector("#bx-ask").onclick = function () { ask(null); }; if (dq) ask(dq);
      }).catch(function (e) { box.innerHTML = '<div class="bm-empty">Doubts load nahi hue (' + c0(e.code || e.message) + ")</div>"; });
    });
  } };
  function doubtForm(c, b, box, pre) {
    var m = me(), md = document.createElement("div"); md.className = "bm-modal"; var subs = subjectsFor(c, b.id);
    md.innerHTML = '<div class="bm-sheet"><h3>Naya Doubt</h3><div class="bm-form"><label>Subject</label><select id="bd-s"></select><label>Chapter</label><select id="bd-c"></select><label>Aapka doubt *</label><textarea id="bd-t" rows="4" maxlength="2000"></textarea><label>Photo (optional)</label><input type="file" id="bd-i" accept="image/*"><div class="acts"><button class="bm-btn sec" data-c>Cancel</button><button class="bm-btn" data-s>Bhejein</button></div></div></div>';
    document.body.appendChild(md); var ss = md.querySelector("#bd-s"), cs = md.querySelector("#bd-c");
    function fc() { var s = subs.filter(function (x) { return x.name === ss.value; })[0]; cs.innerHTML = opts(s ? s.chapters.map(function (x) { return x.name; }) : [], pre && pre.chapter && ss.value === pre.subject ? pre.chapter : ""); }
    ss.innerHTML = opts(subs.map(function (x) { return x.name; }), pre ? pre.subject : "", "General"); ss.onchange = fc; fc();
    md.querySelector("[data-c]").onclick = function () { md.remove(); };
    md.querySelector("[data-s]").onclick = function () {
      var t = md.querySelector("#bd-t").value.trim(); if (!t) return c.toast("Doubt likhein"); var btn = this; btn.disabled = true;
      var s = subs.filter(function (x) { return x.name === ss.value; })[0], ch = s && s.chapters.filter(function (x) { return x.name === cs.value; })[0], f = md.querySelector("#bd-i").files[0];
      (f ? c.shrink(f, 900, 300000) : Promise.resolve("")).then(function (img) {
        var d = { instituteId: c.S.inst, batchId: b.id, subjectId: (s && s.id) || "", subject: ss.value || "", chapterId: (ch && ch.id) || "", chapter: cs.value || "", mobile: m.mobile, name: m.name, text: t, status: "open", createdAt: c.FV().serverTimestamp() }; if (img) d.img = img;
        return sub(c, c.S.inst, b.id, "doubts").add(d);
      }).then(function () { md.remove(); c.toast("✅ Doubt bhej diya gaya"); EXT.studentTabs.doubt.render(b, box, c); }).catch(function (e) { btn.disabled = false; c.toast(e && e.code === "permission-denied" ? "Permission nahi mili — logout karke dobara login karein" : "Nahi bhej paye: " + (e.message || e)); });
    };
  }

  /* ---- student: Assignments ---- */
  EXT.studentTabs.assign = { label: "Assignments", render: function (b, box, c) {
    var m = me(); box.innerHTML = '<div class="bm-empty">Loading…</div>';
    strictFor(c).then(function (strict) {
      return sub(c, c.S.inst, b.id, "assignments").where("published", "==", true).get().then(function (q) {
        var as = q.docs.map(function (d) { return plain(d, c); }).sort(function (a, z) { return (a.due || 9e15) - (z.due || 9e15); });
        return Promise.all(as.map(function (a) { return !strict ? null : sub(c, c.S.inst, b.id, "assignments").doc(a.id).collection("submissions").doc(m.mobile).get().then(function (d) { a.my = d.exists ? d.data() : null; }).catch(function () { a.my = null; }); })).then(function () { return [as, strict]; });
      });
    }).then(function (r) {
      var as = r[0], strict = r[1];
      box.innerHTML = (strict ? "" : '<div class="bm-note">Submission abhi band hai (admin ko Security Mode ON karna hoga). Assignment dekh sakte hain.</div>') + (as.length ? as.map(function (a, ix) {
        var late = a.due && Date.now() > a.due, st = a.my ? (a.my.status === "evaluated" ? '<span class="bm-badge">' + a.my.marks + "/" + (a.maxMarks || 0) + "</span>" : '<span class="bm-badge b">Submitted</span>') : late ? '<span class="bm-badge r">Due nikal gaya</span>' : '<span class="bm-badge o">Pending</span>';
        return '<div class="bm-card"><div class="bm-row"><div class="g"><b>' + c0(a.title) + "</b><small>" + c0([a.subject, a.chapter].filter(Boolean).join(" › ") || "") + (a.due ? " • Due " + new Date(a.due).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "") + "</small></div>" + st + "</div>" +
          (a.desc ? '<p style="font-size:.84rem;white-space:pre-wrap;margin:6px 0">' + c0(a.desc) + "</p>" : "") + (a.url ? '<a href="' + c0(a.url) + '" target="_blank" rel="noopener">📎 Question / attachment</a>' : "") + (a.ownFile && window.SnapFiles ? '<a href="' + c0(window.SnapFiles.urlOf(a.ownFile)) + '" target="_blank" rel="noopener"' + (/\.pdf$/i.test(a.ownFile.name || "") || /pdf/i.test(a.ownFile.type || "") ? ' onclick="return window.SnapPdf ? (window.SnapPdf.open(this.textContent.replace(/^\\S+\\s/, \'\'), this.href, {}), false) : true"' : "") + '>📎 ' + c0(a.ownFile.name || "File") + "</a>" : "") + (a.my && a.my.feedback ? '<div class="bx-ans"><small>Teacher feedback</small><div>' + c0(a.my.feedback) + "</div></div>" : "") +
          (strict && !(a.my && a.my.status === "evaluated") ? '<div style="margin-top:6px"><button class="bm-btn sm" data-sm="' + ix + '">' + (a.my ? "Submission badlein" : "Submit karein") + "</button></div>" : "") + "</div>"; }).join("") : '<div class="bm-card bm-empty">Abhi koi assignment nahi.</div>');
      box.querySelectorAll("[data-sm]").forEach(function (x) { x.onclick = function () { var a = as[+x.dataset.sm];
        c.form("Submit — " + a.title, [{ k: "text", l: "Aapka jawab", t: "textarea", r: 1 }, { k: "url", l: "Link (Drive / photo, https — optional)" }], { text: a.my ? a.my.text : "", url: a.my ? a.my.url : "" }, function (o) {
          if (o.url && !/^https:\/\/\S+$/i.test(o.url)) { c.toast("Link https:// se shuru hona chahiye"); return false; }
          return sub(c, c.S.inst, b.id, "assignments").doc(a.id).collection("submissions").doc(m.mobile).set({ mobile: m.mobile, name: m.name, text: o.text, url: o.url || "", submittedAt: c.FV().serverTimestamp(), status: "submitted" }).then(function () { c.toast("✅ Submit ho gaya"); EXT.studentTabs.assign.render(b, box, c); }).catch(function (e) { c.toast(e.code === "permission-denied" ? "Permission nahi mili — logout karke dobara login karein" : "Submit nahi hua"); return false; });
        }); }; });
    }).catch(function (e) { box.innerHTML = '<div class="bm-empty">Assignments load nahi hue (' + c0(e.code || e.message) + ")</div>"; });
  } };

  window.SnapBatchP2 = { _X: X, loadStruct: loadStruct, subjectsFor: subjectsFor };
})();
