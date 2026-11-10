/* ============================================================
   The Vishnu Sharma — Paper Generator: MULTIPLE SETS (v229)
   ------------------------------------------------------------
   Set A  = aapka original paper (jaisa ab tak tha).
   Set B–E = SAME questions, order alag (aur chahe to options ka order bhi).
   Har set ka order + option-order test me `qSets` field me save hota hai
   (paper-sets.js ka format) — publish par isi se OMR Exam Manager ki
   har set ki answer key apne aap banti hai.

   Ye file qgen-app.js ke globals (getAllQuestionsFlat, sections, toast ...)
   sirf CALL-TIME par use karti hai, isliye load-order ki chinta nahi.
   Agar ye file load na ho to paper generator pehle jaisa hi chalta hai.
   ============================================================ */
(function () {
  "use strict";
  var PS = window.PaperSets;
  if (!PS) {
    console.warn("[QGSets] paper-sets.js load nahi hua — Multiple Sets band rahenge.");
    return;
  }
  var LETTERS = PS.LETTERS;
  var S = { n: 1, optShuffle: false, def: null, active: 0, sid: 0, locked: 0, differ: true };

  /* ---------------- helpers ---------------- */
  function isSec() {
    try {
      return typeof isSectionMode === "function" && isSectionMode();
    } catch (e) {
      return false;
    }
  }
  function flat() {
    try {
      return getAllQuestionsFlat() || [];
    } catch (e) {
      return [];
    }
  }
  function say(m) {
    try {
      if (typeof toast === "function") toast(m);
    } catch (e) {}
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function sidOf(q) {
    if (!q._qgSid) q._qgSid = "n" + ++S.sid + "-" + Date.now().toString(36);
    return q._qgSid;
  }
  function descs(list) {
    return list.map(function (q) {
      var sub = q.qType === "subjective";
      return {
        qid: sidOf(q),
        mcq: !sub,
        nOpts: Array.isArray(q.opts) ? q.opts.length : 0,
        lock: sub ? true : PS.optsLocked(q.opts),
        ans: sub ? null : PS.normAns(q.ans),
      };
    });
  }
  function segSizes(list) {
    if (isSec()) {
      var z = sections
        .map(function (s) {
          return s.questions.length;
        })
        .filter(function (x) {
          return x > 0;
        });
      return z.length ? z : [list.length];
    }
    return [list.length];
  }
  function same(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  /* ---------------- generate / validate ---------------- */
  function regen(d, seg, auto, hadDef, keep) {
    S.def = d.length ? PS.generate(d, { n: S.n, optShuffle: S.optShuffle, seg: seg, existing: keep ? S.def : null }) : null;
    S.locked = PS.countLocked(d);
    S.differ = PS.canDiffer(d, S.optShuffle);
    if (S.active >= S.n) S.active = 0;
    if (auto && hadDef) say("🔀 Paper badla — Set B–E ka order naye sire se bana diya gaya.");
    renderBar();
  }

  function ensure() {
    if (S.n < 2) {
      S.def = null;
      S.active = 0;
      return;
    }
    var L = flat();
    if (!L.length) {
      S.def = null;
      S.active = 0;
      return;
    }
    var d = descs(L),
      seg = segSizes(L);
    var ok = S.def && S.def.n === S.n && !!S.def.optShuffle === S.optShuffle && same(S.def.seg, seg) && PS.validate(S.def, d).ok;
    if (!ok) regen(d, seg, true, !!S.def, false);
  }

  /* ---------------- views (preview / print / word) ---------------- */
  function viewQ(q, p) {
    if (!q || q.qType === "subjective" || PS.isIdentityP(p)) return q;
    var c = Object.assign({}, q);
    c.opts = PS.permuteOpts(q.opts, p);
    c.ans = PS.mapAnswer(q.ans, p);
    c._origQ = q;
    return c;
  }
  function viewFlatFor(idx) {
    var L = flat();
    if (S.n < 2 || !idx || !S.def || idx >= S.n) return L;
    var letter = LETTERS[idx],
      N = L.length;
    var o = PS.orderOf(S.def, letter, N);
    if (!o || o.length !== N) return L;
    var out = new Array(N);
    for (var k = 0; k < N; k++) out[k] = viewQ(L[o[k]], PS.pOf(S.def, letter, o[k]));
    return out;
  }
  function viewFlat() {
    return viewFlatFor(S.active);
  }
  function secList(i, fallback) {
    if (S.n < 2 || !S.active || !S.def) return fallback;
    var v = viewFlat(),
      start = 0;
    for (var k = 0; k < i; k++) start += sections[k].questions.length;
    return v.slice(start, start + sections[i].questions.length);
  }

  /* ---------------- UI ---------------- */
  function renderBar() {
    var sel = document.getElementById("setCountSel");
    if (sel && String(sel.value) !== String(S.n)) sel.value = String(S.n);
    var chk = document.getElementById("setOptShuffle");
    if (chk) chk.checked = !!S.optShuffle;
    var rb = document.getElementById("setRegenBtn");
    if (rb) rb.style.display = S.n >= 2 ? "" : "none";
    var info = document.getElementById("setInfo");
    var warn = "";
    if (S.n >= 2) {
      if (!S.differ) warn += "⚠️ Itne kam questions se alag sets nahi ban sakte (kam se kam 2 MCQ chahiye, ya 'Options bhi shuffle' on karein).<br>";
      if (S.optShuffle && S.locked) warn += "🔒 " + S.locked + " question ke options 'Sab sahi / A aur B dono' type hain (ya khaali/4 se kam hain) — unka option order same rahega.<br>";
    }
    if (info) {
      info.innerHTML =
        S.n >= 2
          ? "✅ " + S.n + " sets (A–" + LETTERS[S.n - 1] + "). Sab me same questions, order alag. Test publish hone par OMR Exam Manager me har set ki answer key apne aap bhar jaayegi.<br>" + warn
          : "1 set = purana tareeka. 2–5 chunne par Set B–E auto-shuffle se banenge.";
    }
    var bar = document.getElementById("qgSetBar");
    if (!bar) return;
    if (S.n < 2) {
      bar.style.display = "none";
      bar.innerHTML = "";
      return;
    }
    var h = '<span class="qg-set-lbl">📑 Set:</span>';
    for (var i = 0; i < S.n; i++) h += '<button type="button" class="qg-set-chip' + (i === S.active ? " active" : "") + '" onclick="QGSets.setActive(' + i + ')">Set ' + LETTERS[i] + "</button>";
    h += '<span class="qg-set-note">' + (S.active === 0 ? "Original paper" : "Shuffle hua — answer key bhi isi set ki") + (S.optShuffle ? " · options bhi shuffle" : "") + "</span>";
    if (warn) h += '<span class="qg-set-warn">' + warn.replace(/<br>/g, " ") + "</span>";
    bar.innerHTML = h;
    bar.style.display = "flex";
  }

  function setActive(i) {
    i = Number(i);
    if (!(i >= 0 && i < S.n)) return;
    S.active = i;
    renderBar();
    if (typeof reRenderPaper === "function") reRenderPaper();
  }

  function setCount(v) {
    var n = PS.clampSets(v);
    if (n === S.n) {
      renderBar();
      return;
    }
    if (n < 2) {
      if (S.n >= 2 && S.def && !confirm("Sets hata dein? Set B–E ka shuffle delete ho jaayega (sirf original Set A rahega).")) {
        renderBar();
        return;
      }
      S.n = 1;
      S.def = null;
      S.active = 0;
      renderBar();
      if (typeof reRenderPaper === "function") reRenderPaper();
      return;
    }
    var L = flat();
    S.n = n;
    if (!L.length) {
      renderBar();
      say("ℹ️ Pehle paper me questions add karein — sets apne aap ban jaayenge.");
      return;
    }
    regen(descs(L), segSizes(L), false, true, true);
    say("✅ " + n + " sets taiyar (Set A–" + LETTERS[n - 1] + ")");
    if (typeof reRenderPaper === "function") reRenderPaper();
  }

  function setOptShuffle(b) {
    S.optShuffle = !!b;
    if (S.n >= 2) {
      var L = flat();
      if (L.length) regen(descs(L), segSizes(L), false, true, false);
      say(S.optShuffle ? "🔀 Ab options ka order bhi shuffle hoga" : "↕️ Ab sirf questions ka order shuffle hoga");
      if (typeof reRenderPaper === "function") reRenderPaper();
    } else renderBar();
  }

  function regenerate() {
    if (S.n < 2) return;
    if (S.def && !confirm("Set B–E ka order dobara shuffle hoga. Agar pehle ke sets print kar chuke hain to wo purane ho jaayenge. Aage badhein?")) return;
    var L = flat();
    if (!L.length) return;
    regen(descs(L), segSizes(L), false, true, false);
    say("🔀 Sets dobara shuffle ho gaye");
    if (typeof reRenderPaper === "function") reRenderPaper();
  }

  function reset() {
    S.n = 1;
    S.def = null;
    S.active = 0;
    S.optShuffle = false;
    renderBar();
  }

  /* ---------------- header label ---------------- */
  function label() {
    return S.n >= 2 ? " - SET " + LETTERS[S.active] : "";
  }
  function onHeader() {
    var t = S.n >= 2 ? " · SET " + LETTERS[S.active] : "";
    ["h-setlabel", "ak-setlabel"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = t;
    });
  }

  /* ---------------- all-sets answer key table (Answer Key tab) ---------------- */
  function afterKey(grid) {
    if (!grid || S.n < 2 || !S.def) return;
    var L = flat();
    var qs = descs(L).map(function (d) {
      return { mcq: d.mcq, ans: d.ans };
    });
    var keys = [];
    for (var s = 0; s < S.n; s++) keys.push(PS.answerKey(S.def, LETTERS[s], qs, 1000));
    var rows = keys[0].length;
    if (!rows) return;
    var h = '<div class="qg-allkeys" style="grid-column:1/-1"><div class="qg-allkeys-title">📋 Sab Sets ki Answer Key (OMR question number ke hisaab se, sirf MCQ)</div><div class="qg-allkeys-scroll"><table><thead><tr><th>Q</th>';
    for (var c = 0; c < S.n; c++) h += "<th>Set " + LETTERS[c] + "</th>";
    h += "</tr></thead><tbody>";
    for (var r = 0; r < rows; r++) {
      h += "<tr><td>" + (r + 1) + "</td>";
      for (var c2 = 0; c2 < S.n; c2++) h += "<td>" + esc(keys[c2][r] || "—") + "</td>";
      h += "</tr>";
    }
    h += "</tbody></table></div></div>";
    grid.insertAdjacentHTML("beforeend", h);
  }

  /* ---------------- save / restore ---------------- */
  function savePayload(isUpdate) {
    ensure();
    var L = flat();
    if (S.n >= 2 && S.def && L.length) {
      var ids = L.map(function (q) {
        return q.firestoreId;
      });
      var allIds = ids.every(function (x) {
        return x !== undefined && x !== null && x !== "";
      });
      if (allIds && PS.validate(S.def, descs(L)).ok) {
        var out = PS.sanitize(S.def);
        out.qids = ids.map(String);
        return { qSets: out };
      }
      return {};
    }
    try {
      if (isUpdate && window.firebase && firebase.firestore) return { qSets: firebase.firestore.FieldValue.delete() };
    } catch (e) {}
    return {};
  }

  function restore(persisted) {
    S.active = 0;
    if (!persisted || !(Number(persisted.n) >= 2)) {
      S.n = 1;
      S.def = null;
      S.optShuffle = false;
      renderBar();
      return;
    }
    var L = flat();
    L.forEach(function (q) {
      q._qgSid = String(q.firestoreId);
    });
    var d = descs(L);
    var v = PS.validate(persisted, d);
    if (v.ok) {
      S.def = PS.sanitize(persisted);
      S.n = S.def.n;
      S.optShuffle = !!S.def.optShuffle;
      S.locked = PS.countLocked(d);
      S.differ = PS.canDiffer(d, S.optShuffle);
      renderBar();
    } else {
      S.n = 1;
      S.def = null;
      S.optShuffle = false;
      renderBar();
      say("⚠️ Is test ke purane Sets ab paper se match nahi karte (" + v.reason + ") — Sets dobara banayein.");
      try {
        console.warn("[QGSets] purane sets reject hue:", v.reason);
      } catch (e) {}
    }
  }

  /* ---------------- Word export (active set ya ALL sets) ---------------- */
  

  /* ---------------- init ---------------- */
  function init() {
    renderBar();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.QGSets = {
    ensure: ensure,
    flat: viewFlat,
    flatFor: viewFlatFor,
    secList: secList,
    setActive: setActive,
    setCount: setCount,
    setOptShuffle: setOptShuffle,
    regenerate: regenerate,
    reset: reset,
    label: label,
    onHeader: onHeader,
    afterKey: afterKey,
    savePayload: savePayload,
    restore: restore,
    state: function () {
      return { n: S.n, active: S.active, optShuffle: S.optShuffle, def: S.def };
    },
  };
})();
