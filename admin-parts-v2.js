/* v313 — Admin: Test ke Parts / Sections (multiple parts)
   - Har part ka naam (Part A, Part B...), optional Subject, Marks/Q, up/down, delete
   - "Kai Parts ek saath" button: Part A..Part N ek hi baar me
   - Students ko instructions page me Section | Subject | Q | Marks table dikhti hai
   Purana renderTestSections/addTestSection ko replace karta hai; questions ka section-mapping (question.section = title) waisa hi rehta hai.
   Kill-switch: app-config.js me `examFlowV2: false`. */
(function () {
  "use strict";
  try { if (window.APP_CONFIG && window.APP_CONFIG.examFlowV2 === false) return; } catch (e) {}
  var LET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function q(s) { return document.querySelector(s); }
  function tn(s) { return String(s || "").trim(); }

  function nextTitle() {
    var last = testSections.length ? tn(testSections[testSections.length - 1].title) : "";
    var m = /^(.*?)\s*[A-Z]$/.exec(last), prefix = (m && m[1]) ? m[1] : "Part";
    var i = testSections.length, t;
    do { t = prefix + " " + (LET[i] || String(i + 1)); i++; } while (testSections.some(function (s) { return s.title === t; }));
    return t;
  }
  function addPart(title) {
    var id = "sec-" + Date.now() + "-" + testSections.length;
    testSections.push({ id: id, title: title || nextTitle(), marksPerQuestion: null, subject: "" });
    activeSectionId = id;
  }
  function addOne() { addPart(); renderTestSections(); }
  function addMany() {
    var v = prompt("Kitne Parts ek saath banane hain? (2 se 12)\nNaam Part A, Part B... aise banenge.", "4");
    if (v === null) return; var n = parseInt(v, 10);
    if (!(n >= 1 && n <= 12)) { alert("1 se 12 ke beech number likhein."); return; }
    for (var i = 0; i < n; i++) addPart();
    renderTestSections();
  }
  function move(i, d) {
    var j = i + d; if (j < 0 || j >= testSections.length) return;
    var t = testSections[i]; testSections[i] = testSections[j]; testSections[j] = t; renderTestSections();
  }
  function count(title) { return draftQuestions.filter(function (c) { return (c.section || "Section A") === title; }).length; }

  window.addTestSection = addOne;
  window.renderTestSections = function () {
    var host = q("#test-sections-list"), sel = q("#active-section-select"); if (!host || !sel) return;
    host.innerHTML = "";
    var each = Number((q("#test-marks") || {}).value) || 2;
    testSections.forEach(function (s, i) {
      var row = document.createElement("div"); row.className = "xf-prow";
      var a = document.createElement("input"); a.type = "text"; a.className = "section-title-input"; a.value = s.title; a.placeholder = "Part / Section ka naam (jaise Part A)"; a.setAttribute("aria-label", "Section name");
      var b = document.createElement("input"); b.type = "text"; b.className = "xf-psub"; b.value = s.subject || ""; b.placeholder = "Subject (optional)"; b.setAttribute("aria-label", "Subject");
      var m = document.createElement("input"); m.type = "number"; m.className = "section-marks-input"; m.value = s.marksPerQuestion == null ? "" : s.marksPerQuestion; m.placeholder = "Marks/Q"; m.step = "0.25"; m.min = "0.25";
      var bt = document.createElement("div"); bt.className = "xf-pbtns";
      function btn(label, cls, fn, title) { var x = mkBtn(label, cls, fn); x.title = title || ""; return x; }
      bt.append(btn("↑", "secondary", function () { move(i, -1); }, "Upar"), btn("↓", "secondary", function () { move(i, 1); }, "Neeche"),
        btn("✕", "danger", function () {
          if (testSections.length <= 1) { alert("At least one section is required."); return; }
          var cnt = count(s.title); if (cnt && !confirm("\"" + s.title + "\" me " + cnt + " question hain. Delete karne par ve pehle section me chale jayenge. Aage badhein?")) return;
          var rest = testSections.filter(function (c) { return c.id !== s.id; });
          draftQuestions.forEach(function (c) { if (c.section === s.title) c.section = rest[0].title; });
          testSections = rest; activeSectionId = testSections[0].id; renderTestSections(); renderDrafts();
        }, "Delete"));
      var meta = document.createElement("div"); meta.className = "xf-pmeta";
      var c = count(s.title), mk = s.marksPerQuestion != null ? Number(s.marksPerQuestion) : each;
      meta.innerHTML = "<span><b>" + c + "</b> question</span><span>Total: <b>" + (Math.round(c * mk * 100) / 100) + "</b> marks</span>";
      a.onchange = function () {
        var nt = tn(a.value) || s.title;
        if (testSections.some(function (o) { return o.id !== s.id && o.title === nt; })) { alert("Is naam ka section pehle se hai. Alag naam rakhein."); a.value = s.title; return; }
        var old = s.title; s.title = nt;
        draftQuestions.forEach(function (x) { if (x.section === old) x.section = nt; });
        renderTestSections(); renderDrafts();
      };
      b.onchange = function () { s.subject = tn(b.value); };
      m.onchange = function () { s.marksPerQuestion = m.value ? Number(m.value) : null; renderTestSections(); };
      row.append(a, b, m, bt, meta); host.appendChild(row);
    });
    sel.innerHTML = "";
    testSections.forEach(function (s) { var o = document.createElement("option"); o.value = s.id; o.textContent = s.title; sel.appendChild(o); });
    sel.value = activeSectionId; sel.onchange = function () { activeSectionId = sel.value; };
    ensureBar();
  };
  function ensureBar() {
    var add = q("#add-test-section"); if (!add || q("#xf-add-many")) return;
    var b = document.createElement("button"); b.type = "button"; b.id = "xf-add-many"; b.className = "btn-secondary"; b.style.cssText = "margin:0 0 12px 8px;"; b.textContent = "🧩 Kai Parts ek saath (Part A–D)";
    add.insertAdjacentElement("afterend", b);
    add.textContent = "➕ Ek Part / Section Add Karein";
  }
  /* "Add Section" button script.js ne apne purane function se bind kiya tha — capture me rok kar naya chalate hain */
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("#add-test-section,#xf-add-many") : null; if (!t) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (t.id === "xf-add-many") addMany(); else addOne();
  }, true);
  document.addEventListener("input", function (e) { if (e.target && e.target.id === "test-marks") { try { renderTestSections(); } catch (x) {} } }, true);
  function boot() { try { renderTestSections(); } catch (e) {} }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
