/* Practice Mode v1 — ek hi practice me kai subjects ke kai chapters.
   Purana single-subject card (#practice-mode-card ke andar .pm-legacy) chhupa rehta hai; naya UI #pm-root me banta hai.
   Question bank wahi (questionBank / SnapQuestionBankChunks), start logic purane startPractice jaisa — bas (subject, chapter) jodiyon se filter. */
(function () {
  "use strict";
  var S = { sel: {}, open: {}, want: 10, q: "", data: null, state: "idle" };
  var ARR = '<svg class="pm-ar" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
  function $(i) { return document.getElementById(i); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function sess() { try { return typeof getStudentSession === "function" ? getStudentSession() : null; } catch (e) { return null; } }
  function bank() {
    try { return (typeof getStudentClassScopedQuestionBank === "function" ? getStudentClassScopedQuestionBank() : (typeof questionBank !== "undefined" ? questionBank : [])) || []; } catch (e) { return []; }
  }
  function subj(q) { try { return typeof getQuestionSubject === "function" ? getQuestionSubject(q) : (q.subject || ""); } catch (e) { return q.subject || ""; } }
  function build() {
    var d = {};
    bank().forEach(function (q) {
      if (typeof isValidQ === "function" && !isValidQ(q)) return;
      var s = subj(q), c = q && q.chapter; if (!s || !c) return;
      (d[s] = d[s] || {})[c] = (d[s][c] || 0) + 1;
    });
    return d;
  }
  function ensure() {
    var C = window.SnapQuestionBankChunks;
    if (C && window.__bankChunkMode && window.__bankChunkScope !== "all" && C.loadAll) return C.loadAll();
    return Promise.resolve();
  }
  function refresh() {
    if (S.state === "loading") return;
    S.state = "loading"; draw();
    var done = function (ok) { S.data = build(); S.state = ok ? "ready" : "error"; prune(); draw(); };
    var go = function () { ensure().then(function () { done(true); }, function () { done(Object.keys(build()).length > 0); }); };
    if (window.__bankChunkMode || window.SnapQuestionBankChunks) { var t = 0, iv = setInterval(function () { t++; if (window.SnapQuestionBankChunks || t > 20) { clearInterval(iv); go(); } }, 150); } else go();
  }
  function prune() { Object.keys(S.sel).forEach(function (s) { if (!S.data || !S.data[s]) { delete S.sel[s]; return; } S.sel[s].forEach(function (c) { if (!S.data[s][c]) S.sel[s].delete(c); }); }); }
  function cmp(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }); }
  function totals() {
    var tc = 0, av = 0, ks = Object.keys(S.sel).filter(function (s) { return S.sel[s].size; }).sort(cmp);
    ks.forEach(function (s) { S.sel[s].forEach(function (c) { tc++; av += (S.data[s] && S.data[s][c]) || 0; }); });
    return { ks: ks, tc: tc, av: av, eff: Math.min(S.want, av) };
  }
  function draw() {
    var root = $("pm-root"); if (!root) return;
    var keep = document.activeElement && document.activeElement.id === "pm-q";
    var left;
    if (S.state === "loading" || S.state === "idle") left = '<div class="pm-none">Loading question bank...</div>';
    else if (!S.data || !Object.keys(S.data).length) left = '<div class="pm-none">No question bank is available right now.</div>';
    else {
      var f = S.q.trim().toLowerCase(), h = "";
      Object.keys(S.data).sort(cmp).forEach(function (s) {
        var all = Object.keys(S.data[s]).sort(cmp), cs = all.filter(function (c) { return !f || c.toLowerCase().indexOf(f) > -1 || s.toLowerCase().indexOf(f) > -1; });
        if (!cs.length) return;
        var n = S.sel[s] ? S.sel[s].size : 0, st = !n ? "" : n === all.length ? "on" : "p", o = S.open[s] || f;
        h += '<div class="pm-sj' + (o ? " open" : "") + '"><div class="pm-sh" data-h="' + esc(s) + '"><span class="pm-cb ' + st + '" data-a="' + esc(s) + '"></span><b>' + esc(s) + "</b><small>" + (n ? n + " / " : "") + all.length + '<span class="pm-w"> chapters</span></small>' + ARR + '</div><div class="pm-cl">' +
          cs.map(function (c) { return '<div class="pm-ci" data-s="' + esc(s) + '" data-c="' + esc(c) + '"><span class="pm-cb ' + (S.sel[s] && S.sel[s].has(c) ? "on" : "") + '"></span><span class="n">' + esc(c) + "</span><small>" + S.data[s][c] + '<span class="pm-w"> prashn</span></small></div>'; }).join("") + "</div></div>";
      });
      left = h || '<div class="pm-none">No chapters found.</div>';
    }
    var T = S.data ? totals() : { ks: [], tc: 0, av: 0, eff: 0 }, right;
    if (!T.tc) right = '<div class="pm-em">No chapter selected.</div>';
    else right = T.ks.map(function (s) { return '<div class="pm-sg"><b>' + esc(s) + "<small>" + S.sel[s].size + " chapter</small></b>" + Array.from(S.sel[s]).sort(cmp).map(function (c) { return '<div class="pm-t"><span>' + esc(c) + '</span><button type="button" class="pm-x" aria-label="Hatayein" data-r="' + esc(s) + "|" + esc(c) + '">×</button></div>'; }).join("") + "</div>"; }).join("") +
      '<div class="pm-qs"><label>Prashnon ki sankhya</label><div class="pm-pre">' + [10, 20, 30, 50].map(function (n) { return '<button type="button" class="' + (S.want === n ? "on" : "") + '" data-n="' + n + '">' + n + "</button>"; }).join("") + '</div><div class="pm-cu">Or enter a number:<input id="pm-cn" type="number" min="1" max="' + T.av + '" value="' + S.want + '"></div>' +
      '<div class="pm-r"><span>Selected chapters</span><b>' + T.tc + '</b></div><div class="pm-r"><span>Available questions</span><b>' + T.av + '</b></div><div class="pm-r"><span>In this practice</span><b>' + T.eff + '</b></div><button type="button" class="pm-go" id="pm-go">Start practice</button><button type="button" class="pm-clr" id="pm-clr">Clear all</button></div>';
    root.innerHTML = '<div class="pm-grid"><div class="pm-panel"><div class="pm-h">Subjects aur chapters<span>' + (T.tc ? T.tc + " chapters selected" : "Nothing selected") + '</span></div><div class="pm-srch"><input id="pm-q" placeholder="Chapter khojein" value="' + esc(S.q) + '"></div>' + left + '</div><div class="pm-panel pm-sum"><div class="pm-h">Your practice test</div>' + right + "</div></div>";
    if (keep) { var i = $("pm-q"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }
  function start() {
    var e = sess(); if (!e) { alert("Please log in to start practice."); return; }
    var T = totals(); if (!T.tc) return;
    if (!S.want || S.want <= 0) { alert("Question count must be greater than 0."); return; }
    var pool = bank().filter(function (r) { return (typeof isValidQ !== "function" || isValidQ(r)) && S.sel[subj(r)] && S.sel[subj(r)].has(r.chapter); }).map(cloneQ);
    pool = shuffleArray(pool);
    if (!pool.length) { alert("No questions available for this filter."); return; }
    var items = pool.slice(0, Math.min(S.want, pool.length)), first = T.ks[0] ? Array.from(S.sel[T.ks[0]])[0] : "";
    var label = T.tc === 1 ? first : T.ks.length === 1 ? T.tc + " Chapters" : T.ks.length + " Subjects, " + T.tc + " Chapters";
    current.student = { name: ($("student-name") && $("student-name").value.trim()) || e.name || "Student", mobile: ($("student-mobile") && $("student-mobile").value.trim()) || e.mobile || "", email: "" };
    current.testId = "practice-" + Date.now();
    current.test = { title: "Practice: " + label, minutes: 999, marksPerQuestion: 1, negativeEnabled: false, negativeMarks: 0, custom: true, isPractice: true, questions: items };
    beginExam();
  }
  document.addEventListener("click", function (ev) {
    var root = $("pm-root"); if (!root || !root.contains(ev.target)) return;
    var g = function (k) { return ev.target.closest ? ev.target.closest(k) : null; }, t;
    if ((t = g("[data-a]"))) { var s = t.getAttribute("data-a"), a = Object.keys(S.data[s] || {}); S.sel[s] = (S.sel[s] && S.sel[s].size === a.length) ? new Set() : new Set(a); }
    else if ((t = g("[data-h]"))) { var h = t.getAttribute("data-h"); S.open[h] = !S.open[h]; }
    else if ((t = g(".pm-ci"))) { var s2 = t.getAttribute("data-s"), c = t.getAttribute("data-c"); S.sel[s2] = S.sel[s2] || new Set(); if (S.sel[s2].has(c)) S.sel[s2].delete(c); else S.sel[s2].add(c); }
    else if ((t = g("[data-r]"))) { var p = t.getAttribute("data-r"), k = p.indexOf("|"); if (S.sel[p.slice(0, k)]) S.sel[p.slice(0, k)].delete(p.slice(k + 1)); }
    else if ((t = g("[data-n]"))) S.want = +t.getAttribute("data-n");
    else if (g("#pm-clr")) S.sel = {};
    else if (g("#pm-go")) { start(); return; }
    else return;
    draw();
  });
  document.addEventListener("input", function (ev) { if (ev.target && ev.target.id === "pm-q") { S.q = ev.target.value; draw(); } });
  document.addEventListener("change", function (ev) { if (ev.target && ev.target.id === "pm-cn") { S.want = Math.max(1, parseInt(ev.target.value, 10) || 10); draw(); } });
  function init() {
    var card = $("practice-mode-card"); if (!card || !$("pm-root")) return;
    var seen = false, check = function () { if (!card.classList.contains("hidden") && !seen) { seen = true; refresh(); } else if (card.classList.contains("hidden")) seen = false; };
    try { new MutationObserver(check).observe(card, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
    check();
  }
  if (document.readyState !== "loading") init(); else document.addEventListener("DOMContentLoaded", init);
  window.PracticeMulti = { refresh: refresh };
})();
