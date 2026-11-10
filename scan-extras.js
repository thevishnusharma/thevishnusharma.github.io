/* v282 — Scan Extras (SnapScanExtras)
   1. Double scan warning   2. Roll auto-fix (roster se milte-julte roll)   3. Class result PDF
   4. Question-wise difficulty report   5. Scan awaaz (beep)   6. Offline scan chip
   exam-manager.js ko chhua nahi gaya: ye file SnapRoster.onScan/clear ko wrap karti hai aur Reports screen mein 2 button jodti hai. */
(function (root) {
  "use strict";
  var LETTERS = ["A", "B", "C", "D", "E"];

  /* ---------- pure helpers (tests mein bhi chalte hain) ---------- */
  function keyFor(exam, setLetter) {
    var n = Math.max(1, Math.min(100, Number(exam && exam.questions) || 100)), out = new Array(n).fill(null);
    var s = setLetter || "A", arr = exam && exam.answerKeys && Array.isArray(exam.answerKeys[s]) && exam.answerKeys[s].some(Boolean) ? exam.answerKeys[s] : (exam && Array.isArray(exam.answerKey) ? exam.answerKey : []);
    for (var i = 0; i < n; i++) if (LETTERS.indexOf(arr[i]) >= 0) out[i] = arr[i];
    return out;
  }
  function fullRoll(r) { r = String(r == null ? "" : r).trim(); return r && r.indexOf("?") === -1; }
  /* ek roll ka sirf ek (sabse zyada marks wala) result */
  function bestPerRoll(results) {
    var by = {}, out = [];
    (results || []).forEach(function (r) {
      if (!r) return; var k = String(r.roll || "").trim();
      if (!fullRoll(k)) { out.push(r); return; }
      if (!by[k] || (Number(r.marks) || 0) > (Number(by[k].marks) || 0)) by[k] = r;
    });
    Object.keys(by).forEach(function (k) { out.push(by[k]); });
    return out;
  }
  function ranked(results) {
    var list = bestPerRoll(results).slice().sort(function (a, b) { return (Number(b.marks) || 0) - (Number(a.marks) || 0) || String(a.roll).localeCompare(String(b.roll), "en", { numeric: true }); });
    var last = null, rk = 0;
    list.forEach(function (r, i) { var m = Number(r.marks) || 0; if (last === null || m !== last) { rk = i + 1; last = m; } r._rank = rk; });
    return list;
  }
  function findPrevious(results, roll) {
    roll = String(roll || "").trim(); if (!fullRoll(roll)) return null;
    var best = null;
    (results || []).forEach(function (r) { if (r && String(r.roll || "").trim() === roll && (!best || (Number(r.marks) || 0) > (Number(best.marks) || 0))) best = r; });
    return best;
  }
  /* '?' = koi bhi digit. Poora roll ho to sirf 1 digit ka fark wale roll. */
  function suggestRolls(detected, rosterList, scannedRolls) {
    detected = String(detected || "").trim(); var out = [];
    if (!detected || !rosterList || !rosterList.length) return out;
    var done = {}; (scannedRolls || []).forEach(function (r) { done[String(r).trim()] = 1; });
    var hasQ = detected.indexOf("?") !== -1, reg = {}; rosterList.forEach(function (e) { reg[e.roll] = 1; });
    if (!hasQ && reg[detected]) return out;
    rosterList.forEach(function (e) {
      var r = String(e.roll || ""); if (r.length !== detected.length) return;
      var diff = 0, ok = true;
      for (var i = 0; i < r.length; i++) { var d = detected[i]; if (d === "?") continue; if (d !== r[i]) { diff++; } }
      if (hasQ) ok = diff === 0; else ok = diff === 1;
      if (ok) out.push({ roll: r, name: e.name || "", done: !!done[r] });
    });
    out.sort(function (a, b) { return (a.done - b.done) || String(a.roll).localeCompare(String(b.roll), "en", { numeric: true }); });
    return out.slice(0, 5);
  }
  /* question-wise: kitne ne galat/blank/sahi kiya aur sabse zyada kaunsa galat option chuna */
  function difficulty(exam, results) {
    var rows = {}, list = bestPerRoll(results), total = 0;
    list.forEach(function (r) { total = Math.max(total, (r.answers || []).length, Number(r.totalQuestions) || 0); });
    var attempted = 0;
    for (var q = 0; q < total; q++) rows[q] = { q: q + 1, n: 0, right: 0, wrong: 0, blank: 0, opt: {}, key: null };
    list.forEach(function (r) {
      var key = keyFor(exam, r.setLetter), ans = r.answers || []; attempted++;
      for (var q = 0; q < total; q++) {
        var k = key[q]; if (!k) continue; var row = rows[q]; row.key = row.key || k; row.n++;
        var a = ans[q];
        if (!a) row.blank++; else if (a === k) row.right++; else { row.wrong++; row.opt[a] = (row.opt[a] || 0) + 1; }
      }
    });
    var out = [];
    Object.keys(rows).forEach(function (q) {
      var r = rows[q]; if (!r.n) return;
      var topOpt = null, topN = 0; Object.keys(r.opt).forEach(function (o) { if (r.opt[o] > topN) { topN = r.opt[o]; topOpt = o; } });
      out.push({ q: r.q, n: r.n, right: r.right, wrong: r.wrong, blank: r.blank, key: r.key, wrongPct: Math.round(r.wrong / r.n * 100), blankPct: Math.round(r.blank / r.n * 100), rightPct: Math.round(r.right / r.n * 100), topWrong: topOpt, topWrongPct: Math.round(topN / r.n * 100),
        keyDoubt: r.n >= 5 && topN / r.n >= 0.7 });
    });
    out.sort(function (a, b) { return b.wrongPct - a.wrongPct || b.blankPct - a.blankPct || a.q - b.q; });
    return { students: attempted, rows: out };
  }
  function stats(list) {
    var m = list.map(function (r) { return Number(r.marks) || 0; });
    if (!m.length) return { n: 0, avg: 0, max: 0, min: 0 };
    return { n: m.length, avg: m.reduce(function (a, b) { return a + b; }, 0) / m.length, max: Math.max.apply(null, m), min: Math.min.apply(null, m) };
  }
  var pure = { keyFor: keyFor, bestPerRoll: bestPerRoll, ranked: ranked, findPrevious: findPrevious, suggestRolls: suggestRolls, difficulty: difficulty, stats: stats, fullRoll: fullRoll };
  if (typeof module !== "undefined" && module.exports) module.exports = { pure: pure };
  if (!root || !root.document) return;

  /* ---------- browser part ---------- */
  var D = root.document;
  function X() { return root.__examgrCtx || null; }
  function exam() { var c = X(); return c && c.exam ? c.exam() : null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function el(id) { return D.getElementById(id); }
  function results(ex) { return ex && Array.isArray(ex.results) ? ex.results : []; }
  function nameOf(id, roll) { try { return root.SnapRoster ? root.SnapRoster.nameOf(id, roll) : ""; } catch (e) { return ""; } }

  /* 5. awaaz */
  var audio = null, lastBeep = 0;
  function soundOn() { try { return localStorage.getItem("snap_scan_sound") !== "0"; } catch (e) { return true; } }
  function tone(freq, start, dur, type, vol) {
    var o = audio.createOscillator(), g = audio.createGain(); o.type = type || "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, audio.currentTime + start); g.gain.exponentialRampToValueAtTime(vol || 0.25, audio.currentTime + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + dur); o.connect(g); g.connect(audio.destination); o.start(audio.currentTime + start); o.stop(audio.currentTime + start + dur + 0.02);
  }
  function beep(kind) {
    if (!soundOn()) return; var now = Date.now(); if (now - lastBeep < 600) return; lastBeep = now;
    try {
      var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return; audio = audio || new AC(); if (audio.state === "suspended") audio.resume();
      if (kind === "ok") { tone(1046, 0, 0.09, "sine", 0.3); tone(1568, 0.09, 0.11, "sine", 0.3); }
      else if (kind === "warn") { tone(520, 0, 0.13, "square", 0.18); tone(520, 0.2, 0.13, "square", 0.18); }
      else { tone(180, 0, 0.35, "sawtooth", 0.22); }
    } catch (e) {}
  }

  /* toolbar: sound toggle + offline chip */
  function ensureToolbar() {
    var bar = el("examgr-scan-toolbar"); if (!bar) return null;
    if (!el("snapx-sound")) {
      var b = D.createElement("button"); b.type = "button"; b.id = "snapx-sound"; b.className = "btn-secondary"; b.style.cssText = "padding:6px 10px;font-size:12px;";
      var paint = function () { b.textContent = soundOn() ? "🔊 Awaaz: ON" : "🔇 Awaaz: OFF"; }; paint();
      b.addEventListener("click", function () { try { localStorage.setItem("snap_scan_sound", soundOn() ? "0" : "1"); } catch (e) {} paint(); beep("ok"); });
      bar.appendChild(b);
    }
    if (!el("snapx-off")) {
      var c = D.createElement("div"); c.id = "snapx-off"; c.hidden = true; c.style.cssText = "flex-basis:100%;font-size:12px;font-weight:700;padding:5px 9px;border-radius:8px;"; bar.appendChild(c);
    }
    return bar;
  }
  var hadPending = false;
  function paintOffline() {
    ensureToolbar(); var c = el("snapx-off"); if (!c) return;
    var off = root.navigator && navigator.onLine === false, p = root.OfflineSync && root.OfflineSync.state ? Number(root.OfflineSync.state.pending) || 0 : 0;
    if (off) { c.hidden = false; c.style.cssText += ";background:#fff7ed;color:#c2410c;border:1px solid #fed7aa"; c.textContent = "📴 Offline — scan chalta rahega, result phone mein save hoga" + (p ? " (" + p + " upload baaki)" : "") + ". Net aate hi apne aap upload hoga."; hadPending = true; }
    else if (p > 0) { c.hidden = false; c.style.cssText += ";background:#fffbeb;color:#b45309;border:1px solid #fde68a"; c.textContent = "⏳ " + p + " result upload ho rahe hain..."; hadPending = true; }
    else if (hadPending) { hadPending = false; c.hidden = false; c.style.cssText += ";background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0"; c.textContent = "✅ Sab result upload ho gaye."; setTimeout(function () { if (!hadPending) c.hidden = true; }, 4000); }
    else c.hidden = true;
  }
  root.addEventListener("online", paintOffline); root.addEventListener("offline", paintOffline); root.addEventListener("snap-sync-state", paintOffline);

  /* 1 + 2: scan ke baad box (double scan + roll suggestions) */
  function ensureBox() {
    var b = el("snapx-box"); if (b) return b;
    var anchor = el("examgr-scan-name-guess") || el("examgr-scan-graded-head"); if (!anchor || !anchor.parentNode) return null;
    b = D.createElement("div"); b.id = "snapx-box"; b.hidden = true; b.style.cssText = "margin:8px 0;"; anchor.parentNode.insertBefore(b, anchor.nextSibling); return b;
  }
  function note(html, bg, fg, bd) { return '<div style="background:' + bg + ';color:' + fg + ';border:1px solid ' + bd + ';border-radius:10px;padding:8px 10px;font-size:13px;font-weight:700;margin-bottom:6px;">' + html + "</div>"; }
  function applyRoll(roll) {
    try {
      var edit = el("examgr-scan-edit-btn"); if (!edit) return; edit.click();
      setTimeout(function () {
        var sel = D.querySelectorAll("#examgr-edit-rollset .examgr-edit-roll-digit");
        if (sel.length !== roll.length) { alert("Roll ke digits match nahi hue — Edit se khud chunein."); return; }
        sel.forEach(function (s, i) { s.value = roll[i]; s.dispatchEvent(new Event("change", { bubbles: true })); });
        var ap = el("examgr-edit-apply-btn"); ap && ap.click();
      }, 60);
    } catch (e) { console.warn("[scan-extras] applyRoll", e); }
  }
  var seq = 0;
  function onScan(ex, det) {
    var my = ++seq, box = ensureBox(); ensureToolbar(); paintOffline();
    if (!ex || !det) return;
    var roll = String(det.roll || "").trim(), ignore = ex.scanIgnoreRollNumber || ex.includeRollNumber === false, html = "", kind = "ok";
    if (!ignore) {
      var prev = findPrevious(results(ex), roll);
      if (prev) { kind = "warn"; html += note("⚠️ Roll " + esc(roll) + " pehle scan ho chuka hai (" + (Number(prev.marks) || 0).toFixed(1) + " marks). Naya save karoge to zyada marks wala hi valid rahega.", "#fffbeb", "#92400e", "#fde68a"); }
      if (!roll || roll.indexOf("?") !== -1) { kind = "bad"; html += note("❌ Roll No poora nahi padha gaya: " + esc(roll || "—"), "#fef2f2", "#b91c1c", "#fecaca"); }
    }
    var id = X() && X().id(), R = root.SnapRoster && root.SnapRoster.load && id ? root.SnapRoster.load(id) : null;
    function paint(list) {
      if (my !== seq || !box) return;
      var sug = !ignore && list && list.length ? suggestRolls(roll, list, results(ex).map(function (r) { return r.roll; })) : [];
      var out = html;
      if (sug.length) out += '<div style="font-size:12px;font-weight:700;margin-bottom:4px;">Kya ye roll hai? Tap karo:</div><div style="display:flex;flex-wrap:wrap;gap:6px;">' + sug.map(function (s) { return '<button type="button" class="btn-secondary snapx-roll" data-roll="' + esc(s.roll) + '" style="padding:6px 10px;font-size:13px;' + (s.done ? "opacity:.6;" : "") + '">' + esc(s.roll) + (s.name ? " • " + esc(String(s.name).slice(0, 18)) : "") + (s.done ? " ✔ scan ho chuka" : "") + "</button>"; }).join("") + "</div>";
      box.innerHTML = out; box.hidden = !out;
    }
    paint(null);
    if (!ignore && R && roll) R.then(function (e) { paint(e && e.list); }).catch(function () {});
    if (!ignore && kind === "ok" && root.SnapRoster && root.SnapRoster.autoWhy) { try { if (root.SnapRoster.autoWhy(ex, det, "")) kind = "warn"; } catch (e) {} }
    beep(kind);
  }
  D.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest(".snapx-roll"); if (b) applyRoll(b.dataset.roll); });
  function hookRoster() {
    var S = root.SnapRoster; if (!S || S.__snapx) return !!S; S.__snapx = true;
    var o = S.onScan, c = S.clear;
    S.onScan = function (ex, det, gr, ocr) { var r = o && o.apply(S, arguments); try { onScan(ex, det); } catch (e) { console.warn("[scan-extras]", e); } return r; };
    S.clear = function () { var r = c && c.apply(S, arguments); seq++; var b = el("snapx-box"); if (b) { b.hidden = true; b.innerHTML = ""; } return r; };
    return true;
  }
  if (!hookRoster()) { var tries = 0, t = setInterval(function () { if (hookRoster() || ++tries > 40) clearInterval(t); }, 250); }

  /* ---------- 3 + 4: Reports screen ke button ---------- */
  function overlay(id, title, bodyHtml) {
    var o = el(id); if (o) o.remove();
    o = D.createElement("div"); o.id = id; o.style.cssText = "position:fixed;inset:0;z-index:2147482000;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center;";
    o.innerHTML = '<div style="background:#fff;color:#111827;width:100%;max-width:640px;max-height:92vh;overflow:auto;border-radius:16px 16px 0 0;padding:16px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><strong style="font-size:17px;">' + title + '</strong><button type="button" data-x="1" class="btn-secondary" style="padding:4px 10px;">✕</button></div>' + bodyHtml + "</div>";
    o.addEventListener("click", function (e) { if (e.target === o || (e.target.dataset && e.target.dataset.x)) o.remove(); });
    D.body.appendChild(o); return o;
  }
  async function load() {
    var c = X(), ex = c && c.exam(); if (!c || !ex) throw new Error("Exam khula nahi hai");
    if (c.ensureResults) await c.ensureResults(c.id(), ex);
    return ex;
  }
  async function showDifficulty() {
    try {
      var ex = await load(), d = difficulty(ex, results(ex));
      if (!d.rows.length) { alert("Abhi koi scanned result ya answer key nahi hai."); return; }
      var body = '<div style="font-size:12px;color:#475569;margin-bottom:8px;">' + d.students + " students ke result se • sabse mushkil sawaal pehle</div>" + d.rows.map(function (r) {
        var col = r.wrongPct >= 60 ? "#dc2626" : r.wrongPct >= 35 ? "#f59e0b" : "#16a34a";
        return '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px;margin-bottom:6px;"><div style="display:flex;justify-content:space-between;font-weight:800;"><span>Q' + r.q + '</span><span style="color:' + col + ';">' + r.wrongPct + '% galat</span></div><div style="height:6px;background:#e5e7eb;border-radius:4px;margin:5px 0;overflow:hidden;"><div style="height:100%;width:' + r.wrongPct + "%;background:" + col + ';"></div></div><div style="font-size:12px;color:#475569;">Sahi ' + r.rightPct + "% • Blank " + r.blankPct + "% • Key " + esc(r.key) + (r.topWrong ? " • Sabse zyada galat option " + esc(r.topWrong) + " (" + r.topWrongPct + "%)" : "") + "</div>" + (r.keyDoubt ? '<div style="font-size:12px;font-weight:800;color:#b45309;margin-top:3px;">⚠️ Q' + r.q + " ki key galat ho sakti hai — zyada students ne " + esc(r.topWrong) + " bhara, key " + esc(r.key) + " hai. Key check karo.</div>" : "") + "</div>";
      }).join("");
      overlay("snapx-diff", "📉 Question Difficulty", body);
    } catch (e) { alert("Report nahi bani: " + (e.message || e)); }
  }
  function clip(ctx, t, w) { t = String(t || ""); if (ctx.measureText(t).width <= w) return t; while (t.length > 1 && ctx.measureText(t + "…").width > w) t = t.slice(0, -1); return t + "…"; }
  function pages(ex, id, list, diff) {
    var W = 1240, H = 1754, out = [], st = stats(list), maxM = Number(list[0] && list[0].maxMarks) || Number(ex.questions) || 0, inst = ex.instituteName || "";
    var date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    function page() { var cv = D.createElement("canvas"); cv.width = W; cv.height = H; var x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.textBaseline = "top"; out.push(cv); return x; }
    function head(x, first) {
      x.fillStyle = "#111827"; x.font = "800 40px Arial"; x.textAlign = "left"; x.fillText(clip(x, (inst ? inst + " — " : "") + "Class Result", 1120), 60, 50);
      x.font = "700 28px Arial"; x.fillStyle = "#334155"; x.fillText(clip(x, (ex.examName || "Exam") + "  •  " + date, 1120), 60, 104);
      if (first) { x.font = "600 24px Arial"; x.fillStyle = "#475569"; x.fillText("Students " + st.n + "   Average " + st.avg.toFixed(1) + "   Topper " + st.max + "   Lowest " + st.min + (maxM ? "   Total " + maxM : ""), 60, 150); }
      var y = first ? 205 : 160;
      x.fillStyle = "#e2e8f0"; x.fillRect(60, y, 1120, 44); x.fillStyle = "#0f172a"; x.font = "800 22px Arial";
      x.textAlign = "left"; x.fillText("Rank", 72, y + 10); x.fillText("Roll", 160, y + 10); x.fillText("Naam", 290, y + 10);
      x.textAlign = "right"; x.fillText("Marks", 930, y + 10); x.fillText("Sahi", 1010, y + 10); x.fillText("Galat", 1090, y + 10); x.fillText("Blank", 1170, y + 10);
      return y + 52;
    }
    var i = 0, first = true;
    while (i < list.length || first) {
      var x = page(), y = head(x, first), cap = first ? 30 : 36, n = 0; first = false;
      for (; i < list.length && n < cap; i++, n++) {
        var r = list[i]; if (n % 2) { x.fillStyle = "#f8fafc"; x.fillRect(60, y - 4, 1120, 42); }
        x.font = "600 22px Arial"; x.fillStyle = "#111827"; x.textAlign = "left"; x.fillText("#" + r._rank, 72, y + 4); x.fillText(String(r.roll || "—"), 160, y + 4);
        x.fillText(clip(x, nameOf(id, r.roll) || "", 540), 290, y + 4);
        x.textAlign = "right"; x.font = "800 22px Arial"; x.fillText((Number(r.marks) || 0).toFixed(1) + (maxM ? "/" + maxM : ""), 930, y + 4);
        x.font = "600 22px Arial"; x.fillStyle = "#15803d"; x.fillText(String(r.correct == null ? "" : r.correct), 1010, y + 4); x.fillStyle = "#b91c1c"; x.fillText(String(r.wrong == null ? "" : r.wrong), 1090, y + 4); x.fillStyle = "#64748b"; x.fillText(String(r.blank == null ? "" : r.blank), 1170, y + 4);
        y += 42;
      }
    }
    if (diff && diff.rows.length) {
      var x2 = page(); x2.fillStyle = "#111827"; x2.font = "800 36px Arial"; x2.textAlign = "left"; x2.fillText("Sabse mushkil sawaal (dobara padhao)", 60, 60);
      var yy = 130; diff.rows.slice(0, 15).forEach(function (r) {
        x2.fillStyle = "#111827"; x2.font = "800 26px Arial"; x2.textAlign = "left"; x2.fillText("Q" + r.q, 60, yy);
        x2.fillStyle = "#e5e7eb"; x2.fillRect(190, yy + 6, 700, 24); x2.fillStyle = r.wrongPct >= 60 ? "#dc2626" : "#f59e0b"; x2.fillRect(190, yy + 6, 7 * r.wrongPct, 24);
        x2.fillStyle = "#111827"; x2.font = "700 24px Arial"; x2.fillText(r.wrongPct + "% galat", 910, yy + 3); x2.font = "600 20px Arial"; x2.fillStyle = "#64748b"; x2.fillText("Key " + r.key + (r.topWrong ? " • zyada ne " + r.topWrong + " bhara" : ""), 190, yy + 36);
        yy += 88;
      });
    }
    return out;
  }
  async function classPdf(btn) {
    var old = btn.textContent; btn.disabled = true; btn.textContent = "⏳ PDF ban raha hai...";
    try {
      var ex = await load(), id = X().id(), list = ranked(results(ex));
      if (!list.length) { alert("Abhi koi scanned result nahi hai."); return; }
      if (root.__ensureLib) { try { await root.__ensureLib("jspdf"); } catch (e) {} }
      var t0 = Date.now(); while (!(root.jspdf && root.jspdf.jsPDF) && Date.now() - t0 < 6000) await new Promise(function (r) { setTimeout(r, 150); });
      if (!(root.jspdf && root.jspdf.jsPDF)) throw new Error("PDF library load nahi hui — internet check karke dobara try karein.");
      var doc = new root.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait" }), pg = pages(ex, id, list, difficulty(ex, results(ex)));
      pg.forEach(function (cv, i) { if (i) doc.addPage(); doc.addImage(cv.toDataURL("image/jpeg", 0.86), "JPEG", 0, 0, 210, 297); });
      doc.save(String(ex.examName || "exam").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) + "-class-result.pdf");
    } catch (e) { alert("PDF banane mein dikkat aayi: " + (e.message || e)); }
    finally { btn.disabled = false; btn.textContent = old; }
  }
  function addButtons() {
    if (el("snapx-btns")) return true; var anchor = el("examgr-rs-img-btn"); if (!anchor || !anchor.parentNode) return false;
    var w = D.createElement("div"); w.id = "snapx-btns"; w.style.cssText = "display:flex;gap:8px;margin-bottom:12px;";
    w.innerHTML = '<button type="button" class="btn-primary" id="snapx-pdf-btn" style="flex:1;">📄 Class Result PDF</button><button type="button" class="btn-secondary" id="snapx-diff-btn" style="flex:1;">📉 Question Difficulty</button>';
    anchor.parentNode.parentNode.insertBefore(w, anchor.parentNode.nextSibling);
    el("snapx-pdf-btn").addEventListener("click", function () { classPdf(this); }); el("snapx-diff-btn").addEventListener("click", showDifficulty);
    return true;
  }
  if (!ensureToolbar()) { var n3 = 0, t3 = setInterval(function () { if (ensureToolbar() || ++n3 > 40) { clearInterval(t3); paintOffline(); } }, 250); } else paintOffline();
  if (!addButtons()) { var n2 = 0, t2 = setInterval(function () { if (addButtons() || ++n2 > 40) clearInterval(t2); }, 250); }

  root.SnapScanExtras = { pure: pure, beep: beep, showDifficulty: showDifficulty, classPdf: function () { var b = el("snapx-pdf-btn"); return b && classPdf(b); } };
})(typeof window !== "undefined" ? window : { document: null });
