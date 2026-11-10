/* Student question-bank loader: fetches class/subject chunks only when practice needs them. */
import { getLegacyAuth, getLegacyStudentSession, setLegacyQuestionBank } from './legacy-bridge.mjs';

  var MANIFEST_URL = "/question-bank/manifest.json", FULL_CACHE = "savya_bank_cache", SYNC_TS = "snap_bank_sync_ts";
  var indexPromise = null, groupPromises = new Map(), resetDone = false;
  function workerUrl() { return String((window.SNAP_CONFIG || {}).workerUrl || "").replace(/\/+$/, ""); }
  function adminUser() {
    var a = getLegacyAuth(), u = a && a.currentUser; return !!(u && !u.isAnonymous && u.email);
  }
  function studentClass() {
    var s = getLegacyStudentSession(); return String(s && s.classId || "");
  }
  function readJson(url) { return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }); }
  function resetOldFullBank() {
    if (resetDone) return; resetDone = true;
    try { setLegacyQuestionBank([]); } catch (e) { window.questionBank = []; }
    try { localStorage.removeItem(FULL_CACHE); localStorage.removeItem(SYNC_TS); } catch (e) {}
    try { if (window.__bankIdb && window.__bankIdb.delete) window.__bankIdb.delete("bank"); } catch (e) {}
  }
  function getIndex() {
    if (indexPromise) return indexPromise;
    indexPromise = readJson(MANIFEST_URL).then(function (staticIndex) {
      var url = workerUrl(); if (!url) return staticIndex;
      return readJson(url + "/bank/meta").then(function (meta) {
        if (!Array.isArray(meta.groups) || !meta.groups.length) return staticIndex;
        var local = new Map((staticIndex.groups || []).map(function (g) { return [g.classId + "\n" + g.subject, g]; }));
        return { schemaVersion: 1, count: meta.count || staticIndex.count, updatedAt: meta.updatedAt || 0, groups: meta.groups.map(function (g) { return Object.assign({}, local.get(g.classId + "\n" + g.subject) || {}, g); }) };
      }).catch(function () { return staticIndex; });
    }).then(function (idx) {
      if (!idx || !Array.isArray(idx.groups)) throw new Error("Question bank index galat hai");
      window.__questionBankIndex = idx; window.__bankChunkMode = true; return idx;
    }).catch(function (e) { indexPromise = null; throw e; });
    return indexPromise;
  }
  function groupKey(g, index) { return "chunk:" + String(index.updatedAt || index.sourceSha256 || "static") + ":" + g.classId + ":" + g.subject; }
  function getGroup(g, index) {
    var id = groupKey(g, index); if (groupPromises.has(id)) return groupPromises.get(id);
    var p = Promise.resolve(window.__bankIdb && window.__bankIdb.get ? window.__bankIdb.get(id) : null).then(function (cached) {
      if (Array.isArray(cached)) return cached;
      var url = workerUrl(), remote = url && g.key ? url + "/bank/chunk?classId=" + encodeURIComponent(g.classId) + "&subject=" + encodeURIComponent(g.subject) : "";
      var request = remote ? readJson(remote).catch(function () { if (!g.url) throw new Error("Question bank chunk offline hai"); return readJson(g.url); }) : (g.url ? readJson(g.url) : Promise.reject(new Error("Question bank chunk URL nahi mila")));
      return request.then(function (arr) {
        if (!Array.isArray(arr)) throw new Error("Question bank chunk galat format mein hai");
        try { window.__bankIdb && window.__bankIdb.put && window.__bankIdb.put(arr, id); } catch (e) {}
        return arr;
      });
    });
    groupPromises.set(id, p); p.catch(function () { groupPromises.delete(id); }); return p;
  }
  function applyQuestions(rows, scope) {
    var seen = new Set(), out = [];
    rows.forEach(function (q) { if (!q || q.id == null || seen.has(String(q.id))) return; seen.add(String(q.id)); out.push(q); });
    setLegacyQuestionBank(out); window.__bankChunkScope = scope;
    try { if (window.SavyaExtras && window.SavyaExtras.syncPracticeFilters) window.SavyaExtras.syncPracticeFilters(); } catch (e) {}
    return out;
  }
  async function loadGroups(groups, index, scope) {
    var rows = [];
    for (var i = 0; i < groups.length; i += 4) {
      var page = await Promise.all(groups.slice(i, i + 4).map(function (g) { return getGroup(g, index); }));
      page.forEach(function (arr) { rows = rows.concat(arr); });
    }
    applyQuestions(rows, scope); return rows;
  }
  async function loadSubject(subject) {
    resetOldFullBank();
    var index = await getIndex(), classId = studentClass(), groups = index.groups.filter(function (g) { return g.subject === subject && (!classId || g.classId === classId); });
    if (!groups.length && !classId) groups = index.groups.filter(function (g) { return g.subject === subject; });
    if (!groups.length) throw new Error("Is class ke liye subject bank nahi mila: " + subject);
    return loadGroups(groups, index, "subject:" + subject);
  }
  async function loadAll() {
    resetOldFullBank(); var index = await getIndex(), classId = studentClass(), groups = index.groups.filter(function (g) { return !classId || g.classId === classId; });
    if (!groups.length && !classId) groups = index.groups;
    if (!groups.length) throw new Error("Is class ke liye question bank nahi mila: " + classId);
    return loadGroups(groups, index, "all");
  }
  window.SnapQuestionBankChunks = { loadSubject: loadSubject, loadAll: loadAll, getIndex: getIndex };
  // Weak-topic actions historically sampled the entire questionBank. Load the
  // student's complete class bank before delegating so chunk mode preserves it.
  if (window.SavyaExtras && typeof window.SavyaExtras.startWeakChapterPractice === "function") {
    var originalWeakPractice = window.SavyaExtras.startWeakChapterPractice;
    window.SavyaExtras.startWeakChapterPractice = function () {
      var args = arguments;
      if (adminUser()) return originalWeakPractice.apply(this, args);
      return loadAll().then(function () { return originalWeakPractice.apply(window.SavyaExtras, args); }).catch(function (e) {
        console.warn("[bank-chunks] weak-topic practice load fail:", e && e.message || e);
        alert("Question bank load nahi hua. Internet check karke dobara try karein.");
        return false;
      });
    };
  }
  var originalSync = window.syncBank;
  window.syncBank = function () {
    if (adminUser() && typeof originalSync === "function") return originalSync.apply(this, arguments);
    window.__bankChunkMode = true; resetOldFullBank();
    getIndex().then(function () { try { window.SavyaExtras && window.SavyaExtras.syncPracticeFilters && window.SavyaExtras.syncPracticeFilters(); } catch (e) {} })
      .catch(function (e) { console.warn("[bank-chunks] index load fail:", e && e.message || e); });
    return true;
  };
  document.addEventListener("change", function (ev) {
    var select = ev.target; if (!select || select.id !== "practice-subject-filter" || adminUser()) return;
    var subject = select.value || "all";
    if (subject === "all") { resetOldFullBank(); applyQuestions([], "all"); return; }
    var cards = document.getElementById("practice-mode-card"), status = cards && cards.querySelector(".bank-chunk-status");
    loadSubject(subject).catch(function (e) { console.warn("[bank-chunks] subject load fail:", e && e.message || e); if (status) status.textContent = "Question bank online nahi mila. Internet aane par dobara subject chunein."; });
  }, true);
  document.addEventListener("click", function (ev) {
    var button = ev.target && ev.target.closest ? ev.target.closest("#practice-start-btn") : null;
    if (!button || adminUser() || !getLegacyStudentSession()) return;
    var count = Number(document.getElementById("practice-question-count") && document.getElementById("practice-question-count").value || 10);
    if (!count || count <= 0) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    var subject = document.getElementById("practice-subject-filter") && document.getElementById("practice-subject-filter").value || "all", label = button.textContent;
    button.disabled = true; button.textContent = "⏳ Question bank load ho raha hai...";
    (subject === "all" ? loadAll() : loadSubject(subject)).then(function () {
      button.disabled = false; button.textContent = label;
      if (typeof button.onclick === "function") button.onclick.call(button, new Event("click"));
    }).catch(function (e) {
      button.disabled = false; button.textContent = label;
      alert("Question bank load nahi hua. Internet check karke subject dobara chunein.");
      console.warn("[bank-chunks] practice load fail:", e && e.message || e);
    });
  }, true);

export { loadSubject, loadAll, getIndex };
