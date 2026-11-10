/* v252 — Paper Generator ko Question Bank (admin list) ke barabar rakhta hai.
   Jo question admin ki list me hain par generator me nahi, unhe backend se seedha ID se mangwa kar jod deta hai.
   v253: ab KUCH BHI DELETE NAHI karta. Jo question sirf admin list me hain (backend ID se nahi mile) unhe admin list me rehne deta hai
   (ho sakta hai wo asli data ho jo backend tak pahunch hi nahi paya) — bas toast me batata hai aur recover-bank.html ka rasta dikhata hai.
   Ye kaam chupke se hota hai (sirf farak wale questions ki ID — poora bank dobara download nahi). Firebase reads = 0 (apna backend). */
(function (W) {
  'use strict';
  var running = false, timer = null;

  function parentBank() {
    try {
      var p = W.parent;
      if (!p || p === W) return null;
      var f = p.getClassScopedQuestionBank;
      return typeof f === 'function' ? f.call(p) : null;
    } catch (e) { return null; }
  }
  function say(msg) {
    try {
      if (typeof W.toast === 'function') W.toast(msg);
      var t = W.document && W.document.getElementById('toast');
      if (t) { clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 9000); }
    } catch (e) { /* ignore */ }
  }

  async function run() {
    if (running) return;
    var pb = parentBank();
    var db = W.vishnuFirebase && W.vishnuFirebase.db;
    if (!pb || !pb.length || !db || typeof W.__qgMapDocs !== 'function') return;
    running = true;
    try {
      var cur = W.QUESTION_BANK || [];
      var mine = new Set(cur.map(function (q) { return q[4]; }));
      var missing = [];
      pb.forEach(function (q) { if (q && q.id && !mine.has(q.id)) missing.push(q.id); });
      if (!missing.length) { console.log('[Bank] generator = admin list (' + mine.size + ')'); return; }

      var list = missing.slice(0, 600), found = [], gone = [], unknown = 0;
      for (var i = 0; i < list.length; i += 10) {
        var part = list.slice(i, i + 10);
        var res = await Promise.all(part.map(function (id) {
          return db.collection('questionBank').doc(id).get().then(function (d) { return { id: id, d: d }; }, function () { return { id: id, err: 1 }; });
        }));
        res.forEach(function (r) {
          if (r.err) { unknown++; return; }
          if (!r.d.exists) gone.push(r.id); else found.push(r.d);
        });
      }

      var added = 0, hidden = 0;
      if (found.length) {
        var rows = W.__qgMapDocs(found);                 // class filter yahan bhi laagu
        hidden = found.length - rows.length;
        cur = W.QUESTION_BANK || [];
        var have = new Set(cur.map(function (q) { return q[4]; }));
        rows.forEach(function (r) { if (!have.has(r[4])) { cur.push(r); added++; } });
        if (added) {
          cur.sort(function (a, b) { return String(a[4]).localeCompare(String(b[4])); });
          W.QUESTION_BANK = cur;
          if (typeof W.buildBankList === 'function') W.buildBankList();
        }
      }
      var onlyAdmin = gone.length; // v253: inhe hataya NAHI jata
      console.warn('[Bank] milan: admin list me ' + pb.length + ', generator me ' + mine.size + ' tha. Jode: ' + added + ', sirf admin list me (backend me nahi): ' + onlyAdmin + ', class se chhupe: ' + hidden + ', check nahi hue: ' + unknown + (missing.length > list.length ? ', baaki ' + (missing.length - list.length) : ''));
      W.__qgOnlyAdminIds = gone.slice();
      if (added) say('🔄 ' + added + ' question generator me jode' + (onlyAdmin ? ' · ' + onlyAdmin + ' question sirf Question Bank list me hain, backend me nahi (recover-bank.html kholo)' : ''));
      else if (onlyAdmin) say('⚠️ ' + onlyAdmin + ' question sirf Question Bank list me hain, backend me nahi — recover-bank.html kholkar backend me daalo');
      else if (hidden) say('ℹ️ ' + hidden + ' question is admin ki allowed classes me nahi hain, isliye generator me nahi dikhte');
    } catch (e) {
      console.warn('[Bank] milan fail:', e && e.message);
    } finally { running = false; }
  }


  // v254: classId alag-alag shakl me ho sakta hai ("9", "class9", "Class 9", ya khali). Sab ko "class_9" jaisa banata hai;
  // khali ho to doc ID ("class9-...") se nikalta hai. Isse Class 9 filter / allowed-class check me question chhootte nahi.
  W.__qgNormClass = function (c, id) {
    var v = String(c == null ? '' : c).trim().toLowerCase().replace(/\s+/g, '');
    var m = v.match(/^(?:class[_-]?)?(\d{1,2})$/);
    if (m) return 'class_' + m[1];
    if (v) return c;
    m = String(id || '').toLowerCase().match(/^class[_-]?(\d{1,2})[-_]/);
    return m ? 'class_' + m[1] : '';
  };
  // generator me count ke neeche chhoti line: kis class ke kitne question load hue (kaun-sa class gayab hai turant dikh jaye)
  function showMix() {
    try {
      var d = W.document, bt = d && d.getElementById('bankTotal'); if (!bt) return;
      var host = bt.parentNode, el = d.getElementById('qgClassMix');
      if (!el) { el = d.createElement('div'); el.id = 'qgClassMix'; el.style.cssText = 'font-size:11px;color:#64748b;text-align:center;margin:2px 0'; host.parentNode.insertBefore(el, host.nextSibling); }
      var cnt = {}; (W.QUESTION_BANK || []).forEach(function (q) { var k = q[10] || '(class nahi)'; cnt[k] = (cnt[k] || 0) + 1; });
      var parts = Object.keys(cnt).sort().map(function (k) { return k.replace('class_', 'Class ') + ': ' + cnt[k]; });
      if (W.__qgHiddenByClass > 0) parts.push('allowed class ke bahar: ' + W.__qgHiddenByClass);
      el.textContent = parts.length ? 'Total ' + (W.QUESTION_BANK || []).length + ' → ' + parts.join(' · ') : '';
    } catch (e) { /* ignore */ }
  }
  // v257: generator ko backend se judna HI chahiye. Config na mile to chupke se purane Firebase se padhta tha (galat/delete hue question dikhte the)
  function checkRouted() {
    try {
      var st = W.SnapOwnBackend && W.SnapOwnBackend.status && W.SnapOwnBackend.status();
      var ok = st && st.enabled && (st.collections || []).indexOf('questionBank') !== -1;
      if (!ok && !W.__qgRouteWarned) { W.__qgRouteWarned = 1; console.error('[Bank] Generator apne backend se NAHI juda (SNAP_CONFIG missing?)'); say('⚠️ Generator backend se nahi juda — page refresh karo; na chale to mujhe batao'); }
    } catch (e) { /* ignore */ }
  }
  W.__qgReconcile = function () { checkRouted(); showMix(); clearTimeout(timer); timer = setTimeout(function () { showMix(); run(); }, 2500); };
  W.__qgReconcileNow = run; // test ke liye
})(typeof window !== 'undefined' ? window : globalThis);
