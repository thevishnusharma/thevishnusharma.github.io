/* My Mistakes — Notebook design v1.
   student-features.js ka A(items, container) is module ko render deta hai; data: studentMistakes/{mobile}.items (baaki) + learnedItems (seekh liye). */
(function () {
  "use strict";
  var WHY = ["Concept samajh nahi aaya", "Jaldbaazi", "Formula bhool gaya", "Andaza lagaya"], L = "ABCD";
  var S = { items: [], box: null, tab: "Sabhi", sheet: null, st: "baaki", rv: null, keys: [], ans: null, pos: 0 };
  function $(i) { return document.getElementById(i); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function qt(t) { return t.questionHI || t.questionEN || ""; }
  function opts(t) { return (t.optionsHI && t.optionsHI.length ? t.optionsHI : t.optionsEN) || []; }
  function key(t) { return ((t.subject || "") + "|" + (t.chapter || "") + "|" + (qt(t) || "").slice(0, 60)).toLowerCase().replace(/\s+/g, " ").trim(); }
  function ckey(t) { return (t.subject || "Anya") + "|" + (t.chapter || "Anya"); }
  function learned() { return Array.isArray(window.__mmLearned) ? window.__mmLearned : []; }
  function ring(p, sz, col, cls) {
    var r = sz / 2 - 4, C = 2 * Math.PI * r;
    return '<div class="' + (cls || "mm-ring") + '" style="width:' + sz + "px;height:" + sz + 'px"><svg width="' + sz + '" height="' + sz + '"><circle cx="' + sz / 2 + '" cy="' + sz / 2 + '" r="' + r + '" fill="none" stroke="' + (cls ? "rgba(255,255,255,.22)" : "#e6e9f2") + '" stroke-width="5"/><circle cx="' + sz / 2 + '" cy="' + sz / 2 + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + C * (1 - p) + '"/></svg><b>' + Math.round(p * 100) + "%</b></div>";
  }
  function chapters() {
    var m = {};
    S.items.forEach(function (t) { var k = ckey(t); (m[k] = m[k] || { k: k, s: t.subject || "Anya", c: t.chapter || "Anya", p: [], l: [] }).p.push(t); });
    learned().forEach(function (t) { var k = ckey(t); (m[k] = m[k] || { k: k, s: t.subject || "Anya", c: t.chapter || "Anya", p: [], l: [] }).l.push(t); });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.p.length - a.p.length; });
  }
  function due() { return S.items.slice().sort(function (a, b) { return (Number(b.times) || 1) - (Number(a.times) || 1) || String(a.addedAt || "").localeCompare(String(b.addedAt || "")); }).slice(0, 5); }
  function home() {
    var chs = chapters(), subs = ["Sabhi"], seen = {};
    chs.forEach(function (c) { if (!seen[c.s]) { seen[c.s] = 1; subs.push(c.s); } });
    if (S.tab !== "Sabhi" && !seen[S.tab]) S.tab = "Sabhi";
    var shown = chs.filter(function (c) { return S.tab === "Sabhi" || c.s === S.tab; }), d = due(), nl = learned().length, tot = S.items.length + nl;
    var why = [0, 0, 0, 0]; S.items.forEach(function (t) { if (t.why != null && why[t.why] != null) why[t.why]++; });
    var mx = Math.max.apply(null, why), top = mx ? WHY[why.indexOf(mx)] : "—";
    var cnt = function (s) { return s === "Sabhi" ? S.items.length : S.items.filter(function (t) { return (t.subject || "Anya") === s; }).length; };
    return '<div class="mm"><div class="mm-hero"><div class="tx"><small>Aaj ka revision</small><h2>' + (d.length ? d.length + " questions revise karne hain" : "Aaj ka revision poora") + '</h2><button type="button" class="mm-hb" data-rv="due"' + (d.length ? "" : " disabled") + '>Revise shuru karein</button></div>' + ring(tot ? nl / tot : 0, 78, "#7fb0ff", "mm-rg") + "</div>" +
      '<div class="mm-ins"><div><small>Revise baaki</small><b style="color:#c62835">' + S.items.length + '</b></div><div><small>Seekh liye</small><b style="color:#0f8a5f">' + nl + '</b></div><div><small>Sabse zyada karan</small><b style="font-size:14px;line-height:1.3;margin-top:3px">' + esc(top) + "</b></div></div>" +
      '<div class="mm-tabs">' + subs.map(function (s) { return '<button type="button" class="mm-tab' + (S.tab === s ? " on" : "") + '" data-tab="' + esc(s) + '">' + esc(s) + "<em>" + cnt(s) + "</em></button>"; }).join("") + "</div>" +
      '<div class="mm-gr">' + (shown.map(function (c) {
        var rp = c.p.filter(function (t) { return (Number(t.times) || 1) > 1; }).length, all = c.p.length + c.l.length;
        return '<div class="mm-cc" data-ch="' + esc(c.k) + '">' + (rp ? '<span class="mm-tag mm-rp">' + rp + " baar-baar</span>" : "") + ring(all ? c.l.length / all : 0, 46, c.p.length ? "#2563eb" : "#0f8a5f") + '<span class="sj">' + esc(c.s) + "</span><h3>" + esc(c.c) + "</h3><p>" + (c.p.length ? c.p.length + " baaki" : "Poora seekh liya") + " · " + all + " kul</p></div>";
      }).join("") || '<div class="mm-empty">Is subject mein koi galti nahi.</div>') + "</div></div>";
  }
  function item(t, pending) {
    var o = opts(t), ua = t.userAnswer, ex = t.explanationHI || t.explanationEN || "";
    return '<div class="mm-q"><div class="mm-meta"><span>' + esc(t.testTitle || "") + "</span>" + ((Number(t.times) || 1) > 1 ? '<span class="mm-tag">' + t.times + " baar galat</span>" : "") + "</div><p>" + esc(qt(t)) + '</p><div class="mm-ans">' +
      (ua != null && o[ua] != null ? '<div class="mm-xx"><small>Aapka uttar</small>' + L[ua] + ") " + esc(o[ua]) + "</div>" : "") + '<div class="mm-oo"><small>Sahi uttar</small>' + L[t.correctAnswer] + ") " + esc(o[t.correctAnswer]) + "</div></div>" + (ex ? '<div class="mm-ex">' + esc(ex) + "</div>" : "") +
      (pending ? '<div class="mm-why"><small>Galti ka karan (apne liye note)</small>' + WHY.map(function (w, i) { return '<button type="button" class="c' + (t.why === i ? " on" : "") + '" data-why="' + i + '" data-k="' + esc(key(t)) + '">' + w + "</button>"; }).join("") + '</div><button type="button" class="mm-btn ok s" data-ok="' + esc(key(t)) + '">Seekh liya</button>' : "") + "</div>";
  }
  function sheet() {
    var c = chapters().filter(function (x) { return x.k === S.sheet; })[0]; if (!c) return "";
    var list = S.st === "baaki" ? c.p : c.l;
    return '<div class="mm-sph"><div class="t"><small>' + esc(c.s) + "</small><h3>" + esc(c.c) + '</h3></div><button type="button" class="mm-cx" data-x="1">×</button></div><div class="mm-spt"><button type="button" class="' + (S.st === "baaki" ? "on" : "") + '" data-st="baaki">Baaki (' + c.p.length + ')</button><button type="button" class="' + (S.st === "ok" ? "on" : "") + '" data-st="ok">Seekh liye (' + c.l.length + ')</button></div>' +
      '<div class="mm-spb">' + (list.map(function (t) { return item(t, S.st === "baaki"); }).join("") || '<div class="mm-empty">Yahan abhi kuch nahi hai.</div>') + '</div><div class="mm-spf"><button type="button" class="mm-btn o" data-rv="' + esc(c.k) + '"' + (c.p.length ? "" : " disabled") + '>Revise karein</button><button type="button" class="mm-btn" data-pr="' + esc(c.k) + '"' + (c.p.length ? "" : " disabled") + ">Practice karein</button></div>";
  }
  function find(k) { return S.items.filter(function (t) { return key(t) === k; })[0]; }
  function rev() {
    var l = S.keys.map(find).filter(Boolean), i = Math.min(S.pos, l.length - 1), t = l[i];
    var head = function (sub) { return '<div class="mm-sph"><div class="t"><small>' + sub + "</small><h3>Revise</h3></div>" + '<button type="button" class="mm-cx" data-x="1">×</button></div>'; };
    if (!t) return head("") + '<div class="mm-spb"><div class="mm-empty">Sab revise ho gaya.</div></div>';
    var o = opts(t), ex = t.explanationHI || t.explanationEN || "";
    return head("Card " + (i + 1) + " / " + l.length) + '<div class="mm-spb"><div class="mm-prog"><i style="width:' + (i / l.length * 100) + '%"></i></div><div class="mm-meta"><span>' + esc(t.subject || "") + " · " + esc(t.chapter || "") + '</span></div><p style="font-weight:600;margin:6px 0 12px;font-size:15px">' + esc(qt(t)) + "</p>" +
      o.map(function (x, j) { var c = S.ans === null ? "" : j === Number(t.correctAnswer) ? "good" : j === S.ans ? "bad" : "dim"; return '<button type="button" class="mm-op ' + c + '" data-op="' + j + '"' + (S.ans === null ? "" : " disabled") + ">" + L[j] + ") " + esc(x) + "</button>"; }).join("") +
      (S.ans !== null ? '<div class="mm-ex">' + (S.ans === Number(t.correctAnswer) ? "Sahi. " : "Galat. ") + esc(ex) + "</div>" : "") + '</div><div class="mm-spf"><button type="button" class="mm-btn o" data-nx="1">Baad mein</button><button type="button" class="mm-btn ok" data-ok="' + esc(key(t)) + '"' + (S.ans !== null ? "" : " disabled") + ">Seekh liya</button></div>";
  }
  function sheetEl() {
    var e = $("mm-sh"); if (e) return e;
    e = document.createElement("div"); e.id = "mm-sh"; e.className = "mm-sh"; e.innerHTML = '<div class="mm-sp" id="mm-sp"></div>'; document.body.appendChild(e); return e;
  }
  function draw() {
    if (S.box) S.box.innerHTML = S.items.length || learned().length ? home() : '<div class="mm"><div class="mm-empty" style="margin:0">Koi mistake save nahi hai.</div></div>';
    var sh = sheetEl(), on = !!(S.rv || S.sheet); sh.classList.toggle("on", on);
    $("mm-sp").innerHTML = S.rv ? rev() : S.sheet ? sheet() : "";
  }
  function close() { S.sheet = null; S.rv = null; S.ans = null; S.pos = 0; }
  function idxOf(k) { for (var i = 0; i < S.items.length; i++) if (key(S.items[i]) === k) return i; return -1; }
  function setWhy(k, w) {
    try {
      var s = getStudentSession(), db = getDB(), mob = normalizeMobile(s.mobile), arr = S.items.map(function (t) { return key(t) === k ? Object.assign({}, t, { why: w }) : t; });
      S.items = arr; draw(); db.collection("studentMistakes").doc(mob).set({ mobile: mob, items: arr }, { merge: true }).catch(function (e) { console.warn("why save failed", e); });
    } catch (e) { console.warn(e); }
  }
  function practice(list) {
    if (!list.length) { alert("Practice ke liye koi mistake nahi hai."); return; }
    var e = getStudentSession(), n = list.map(function (t) { return { textEN: t.questionEN, textHI: t.questionHI, text: t.questionHI || t.questionEN, optionsEN: t.optionsEN, optionsHI: t.optionsHI, options: opts(t), answer: Number(t.correctAnswer || 0), explanationEN: t.explanationEN, explanationHI: t.explanationHI, explanation: t.explanationHI || t.explanationEN, subject: t.subject, chapter: t.chapter }; });
    current.student = { name: ($("student-name") && $("student-name").value.trim()) || (e && e.name) || "Student", mobile: ($("student-mobile") && $("student-mobile").value.trim()) || (e && e.mobile) || "", email: "" };
    current.testId = "mistakes-" + Date.now();
    current.test = { title: "Mistake Revision Practice", minutes: 999, marksPerQuestion: 1, negativeEnabled: false, negativeMarks: 0, custom: true, isPractice: true, questions: n };
    close(); draw(); beginExam();
  }
  document.addEventListener("click", function (ev) {
    var inBox = S.box && S.box.contains(ev.target), sh = $("mm-sh"), inSh = sh && sh.contains(ev.target);
    if (!inBox && !inSh) return;
    var g = function (k) { return ev.target.closest ? ev.target.closest(k) : null; }, t;
    if (sh && ev.target === sh) close();
    else if ((t = g("[data-tab]"))) S.tab = t.getAttribute("data-tab");
    else if ((t = g("[data-ch]"))) { S.sheet = t.getAttribute("data-ch"); S.st = "baaki"; }
    else if (g("[data-x]")) close();
    else if ((t = g("[data-st]"))) S.st = t.getAttribute("data-st");
    else if ((t = g("[data-why]"))) { setWhy(t.getAttribute("data-k"), +t.getAttribute("data-why")); return; }
    else if ((t = g("[data-ok]"))) { var i = idxOf(t.getAttribute("data-ok")); S.ans = null; if (i > -1 && window.SavyaExtras && window.SavyaExtras.removeMistake) window.SavyaExtras.removeMistake(i); return; }
    else if ((t = g("[data-rv]"))) { var k = t.getAttribute("data-rv"); S.keys = (k === "due" ? due() : S.items.filter(function (x) { return ckey(x) === k; })).map(key); S.rv = k; S.pos = 0; S.ans = null; }
    else if ((t = g("[data-pr]"))) { var k2 = t.getAttribute("data-pr"); practice(S.items.filter(function (x) { return ckey(x) === k2; })); return; }
    else if ((t = g("[data-op]"))) S.ans = +t.getAttribute("data-op");
    else if (g("[data-nx]")) { S.pos++; S.ans = null; }
    else return;
    draw();
  });
  window.MyMistakes = { render: function (items, box) { S.items = Array.isArray(items) ? items : []; S.box = box; draw(); } };
})();
