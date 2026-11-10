/* v244  Single Question Editor (admin).
   Ek hi popup: Create Test ki added list, Test Bank picker aur Question Reports teeno jagah se khulta hai.
   - Test ke andar edit: draftQuestions[n] badalta hai (phir "Save Test Online" dabana hai).
   - Bank wale question ka edit: questionBank + backend dono me save (optimistic: popup turant band, save peeche).
   Koi network call popup kholne me nahi lagti. */
(function () {
  "use strict";
  var ov = null, prevOverflow = "";

  function el(tag, css, txt) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function toast(msg, ms) {
    try {
      var t = el("div", "position:fixed;left:12px;right:12px;bottom:16px;z-index:100001;background:#0f172a;color:#fff;padding:12px 14px;border-radius:12px;font-size:.88rem;box-shadow:0 8px 24px rgba(0,0,0,.3);text-align:center", msg);
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, ms || 5000);
    } catch (e) {}
  }
  function close() {
    if (ov) { ov.remove(); ov = null; }
    document.body.style.overflow = prevOverflow;
  }
  function field(label) {
    var w = el("label", "display:block;margin:10px 0 0;font-size:.8rem;font-weight:700;color:#334155", label);
    return w;
  }
  var INPUT = "width:100%;box-sizing:border-box;margin-top:4px;padding:9px 10px;border:1px solid #cbd5e1;border-radius:10px;font-size:.95rem;font-family:inherit;background:#fff;color:#0f172a";

  /* cfg: { title, q, note, bankId, onSave(fields, opts) } */
  function open(cfg) {
    close();
    var q = cfg.q || {};
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ov = el("div", "position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center");
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    var box = el("div", "background:#f8fafc;color:#0f172a;width:100%;max-width:640px;max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;padding:14px 16px 18px;box-sizing:border-box");
    box.appendChild(el("div", "font-weight:800;font-size:1.05rem", "✏️ " + (cfg.title || "Question Edit")));
    if (cfg.note) box.appendChild(el("div", "margin-top:8px;padding:8px 10px;background:#fef3c7;color:#92400e;border-radius:10px;font-size:.82rem;white-space:pre-wrap", cfg.note));

    var typeL = field("Type");
    var type = el("select", INPUT);
    [["mcq", "MCQ"], ["subjective", "Subjective"]].forEach(function (o) { var op = el("option", "", o[1]); op.value = o[0]; type.appendChild(op); });
    type.value = q.qType === "subjective" ? "subjective" : "mcq";
    typeL.appendChild(type); box.appendChild(typeL);

    var textL = field("Question");
    var text = el("textarea", INPUT + ";min-height:96px;resize:vertical");
    text.value = q.textHI || q.text || q.textEN || "";
    textL.appendChild(text); box.appendChild(textL);

    var mcq = el("div", "");
    var opts = [], radios = [];
    var ans = Number(q.answer || 0);
    for (var i = 0; i < 4; i++) {
      (function (i) {
        var row = el("div", "display:flex;align-items:center;gap:8px;margin-top:8px");
        var r = el("input", "width:20px;height:20px;flex-shrink:0"); r.type = "radio"; r.name = "snap-qe-ans"; r.checked = ans === i; r.setAttribute("aria-label", "Sahi option " + "ABCD"[i]);
        var b = el("span", "font-weight:800;width:18px", "ABCD"[i]);
        var inp = el("input", INPUT + ";margin-top:0"); inp.type = "text";
        inp.value = (q.optionsHI && q.optionsHI[i]) || (q.options && q.options[i]) || (q.optionsEN && q.optionsEN[i]) || "";
        row.append(r, b, inp); mcq.appendChild(row); opts.push(inp); radios.push(r);
      })(i);
    }
    mcq.insertBefore(el("div", "margin-top:10px;font-size:.8rem;font-weight:700;color:#334155", "Options (jo gola dabega wahi sahi uttar hoga)"), mcq.firstChild);
    box.appendChild(mcq);

    var marksL = field("Marks (sirf subjective ke liye)");
    var marks = el("input", INPUT); marks.type = "number"; marks.step = "0.25"; marks.min = "0";
    marks.value = q.marks !== undefined && q.marks !== null ? q.marks : "";
    marksL.appendChild(marks); box.appendChild(marksL);

    var expL = field("Explanation / Solution");
    var exp = el("textarea", INPUT + ";min-height:70px;resize:vertical");
    exp.value = q.explanationHI || q.explanation || q.explanationEN || "";
    expL.appendChild(exp); box.appendChild(expL);

    function sync() { var sub = type.value === "subjective"; mcq.style.display = sub ? "none" : ""; marksL.style.display = sub ? "" : "none"; }
    type.onchange = sync; sync();

    var bankChk = null;
    if (cfg.bankId) {
      var bl = el("label", "display:flex;align-items:center;gap:8px;margin-top:12px;font-size:.88rem;font-weight:700;color:#3730a3");
      bankChk = el("input", "width:18px;height:18px"); bankChk.type = "checkbox"; bankChk.checked = true;
      bl.append(bankChk, el("span", "", "Question Bank me bhi badlo"));
      box.appendChild(bl);
    }

    var acts = el("div", "display:flex;gap:10px;margin-top:16px");
    var save = el("button", "flex:1;padding:12px;border:0;border-radius:12px;background:#4f46e5;color:#fff;font-weight:800;font-size:.95rem;cursor:pointer", "Save");
    save.type = "button";
    var cancel = el("button", "padding:12px 18px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#334155;font-weight:700;cursor:pointer", "Cancel");
    cancel.type = "button"; cancel.onclick = close;
    save.onclick = function () {
      var sub = type.value === "subjective";
      var t = text.value.trim();
      if (!t) { alert("Question likho."); return; }
      var f = { qType: sub ? "subjective" : "mcq", textHI: t, explanationHI: exp.value.trim() };
      if (sub) {
        f.optionsHI = ["", "", "", ""]; f.answer = 0;
        f.marks = marks.value !== "" ? Number(marks.value) : null;
      } else {
        f.optionsHI = opts.map(function (o) { return o.value.trim(); });
        if (f.optionsHI.some(function (o) { return !o; })) { alert("Chaaron options bharo."); return; }
        f.answer = Math.max(0, radios.findIndex(function (r) { return r.checked; }));
        f.marks = null;
      }
      f.textEN = f.textHI; f.text = f.textHI;
      f.optionsEN = f.optionsHI; f.options = f.optionsHI;
      f.explanationEN = f.explanationHI; f.explanation = f.explanationHI;
      try { cfg.onSave(f, { bank: !!(bankChk && bankChk.checked) }); } catch (e) { alert("Save nahi hua: " + (e && e.message || e)); return; }
      close();
    };
    acts.append(save, cancel); box.appendChild(acts);
    ov.appendChild(box); document.body.appendChild(ov);
    setTimeout(function () { try { text.focus(); } catch (e) {} }, 50);
  }

  function bankSave(id, f) {
    try {
      var b = (typeof questionBank !== "undefined" && questionBank || []).find(function (x) { return x.id === id; });
      if (!b) return;
      Object.assign(b, f);
      try { window.questionBank = questionBank; } catch (e) {}
      try { typeof saveBankCacheQuietly === "function" && saveBankCacheQuietly(questionBank); } catch (e) {}
      if (typeof saveBankOnline === "function") {
        Promise.resolve(saveBankOnline(id, f)).catch(function (e) {
          alert("Question Bank me save nahi hua: " + (e && e.message || e) + "\n\n(Test me badlav ho gaya hai, bank me nahi.)");
        });
      }
    } catch (e) { console.warn("[qedit] bank save", e); }
  }

  /* Create Test ki added list ka n-th question */
  function editDraft(n, extra) {
    extra = extra || {};
    if (typeof draftQuestions === "undefined" || !draftQuestions[n]) { alert("Ye question test me nahi mila."); return; }
    var q = draftQuestions[n];
    var bankId = null;
    try { if (q.id && (questionBank || []).some(function (b) { return b.id === q.id; })) bankId = q.id; } catch (e) {}
    open({
      title: "Q" + (n + 1) + " edit karein", q: q, note: extra.note, bankId: bankId,
      onSave: function (f, o) {
        draftQuestions[n] = cloneQ(Object.assign({}, q, f));
        try { renderDrafts(); renderTestSections(); } catch (e) {}
        if (o.bank && bankId) bankSave(bankId, f);
        toast(extra.doneMsg || "✅ Question badal gaya. Test me save karne ke liye 'Save Test Online' dabayein.", 6000);
        if (extra.onDone) { try { extra.onDone(); } catch (e) {} }
      }
    });
  }

  /* Test Bank picker se: bank ka question seedha edit */
  function editBank(id) {
    var b = (typeof questionBank !== "undefined" && questionBank || []).find(function (x) { return x.id === id; });
    if (!b) { alert("Ye question bank me nahi mila."); return; }
    open({
      title: "Bank question edit", q: b,
      onSave: function (f) {
        bankSave(id, f);
        try {
          if (typeof draftQuestions !== "undefined") draftQuestions.forEach(function (d, i) { if (d.id === id) draftQuestions[i] = cloneQ(Object.assign({}, d, f)); });
          renderTestBankPicker(); renderDrafts();
        } catch (e) {}
        toast("✅ Bank question badal gaya.", 3500);
      }
    });
  }

  window.SnapQEdit = { open: open, editDraft: editDraft, editBank: editBank, close: close };
})();
