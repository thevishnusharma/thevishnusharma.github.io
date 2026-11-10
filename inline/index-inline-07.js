
// ══════════════════════════════════════════════════════
//  AUTOMATIC MATH EQUATION FORMATTER + KATEX RENDERER
// ══════════════════════════════════════════════════════
function isMathSubjectName(subj) {
  return /math/i.test(subj || "");
}

// Recognized math-function / Greek-letter keywords: when one of these shows up as a "word"
// it's still math notation, not sentence text, so it stays inside the equation buffer below.
var MATH_FUNC_WORDS = /^(sin|cos|tan|cot|sec|cosec|log|ln|sqrt|theta|alpha|beta|gamma|delta|lambda|mu|sigma|omega)$/i;

// Converts one chunk of plain-text math notation (numbers/operators, no sentence words mixed
// in) into LaTeX commands KaTeX can render.
function convertMathSymbols(s) {
  // normalize typographic dashes (common from copy-pasted Hindi text) to a plain minus
  s = s.replace(/[–—]/g, "-");

  // Unicode superscripts -> ^{n}
  var supMap = { "⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9" };
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, function(m) {
    return "^{" + m.split("").map(function(c){ return supMap[c] || c; }).join("") + "}";
  });

  // √(...) and √x -> \sqrt{...}
  s = s.replace(/√\(([^)]+)\)/g, "\\sqrt{$1}");
  s = s.replace(/√\s*([a-zA-Z0-9]+)/g, "\\sqrt{$1}");
  s = s.replace(/\bsqrt\(([^)]+)\)/gi, "\\sqrt{$1}");

  // caret exponents: x^2, x^(2+3) -> x^{2} / x^{2+3}
  s = s.replace(/\^\(([^)]+)\)/g, "^{$1}");
  s = s.replace(/\^([a-zA-Z0-9]+)/g, "^{$1}");

  // simple numeric fractions a/b -> \frac{a}{b}
  s = s.replace(/\b(\d+)\s*\/\s*(\d+)\b/g, "\\frac{$1}{$2}");

  // comparison & operator symbols
  s = s.replace(/<=/g, "\\leq ").replace(/>=/g, "\\geq ").replace(/!=/g, "\\neq ");
  s = s.replace(/≤/g, "\\leq ").replace(/≥/g, "\\geq ").replace(/≠/g, "\\neq ");
  s = s.replace(/×/g, "\\times ").replace(/÷/g, "\\div ");
  s = s.replace(/π/g, "\\pi ");

  // standalone " x " between numbers/vars used as multiplication -> \times
  s = s.replace(/(\d)\s*x\s*(\d)/g, "$1 \\times $2");

  // trig/log function names -> LaTeX commands
  s = s.replace(/\b(sin|cos|tan|cot|sec|cosec|log|ln)\b(?!\\)/gi, function(m){ return "\\" + m.toLowerCase(); });

  // common Greek letter names spelled out -> symbols
  var greekMap = { theta:"\\theta", alpha:"\\alpha", beta:"\\beta", gamma:"\\gamma", delta:"\\delta", lambda:"\\lambda", mu:"\\mu", sigma:"\\sigma", omega:"\\omega" };
  s = s.replace(/\b(theta|alpha|beta|gamma|delta|lambda|mu|sigma|omega)\b/gi, function(m){ return greekMap[m.toLowerCase()]; });

  return s;
}

function hasMathContent(s) {
  return /[=+\-*/^√π≤≥≠×÷]|\\[a-zA-Z]+|\^\{/.test(s);
}

// Auto-wraps ONLY the actual equation portion of a question/option in \( \) so KaTeX renders
// it, and leaves everything else (Hindi/English sentence text) completely untouched -- so its
// normal spacing is never at risk, instead of stuffing the whole sentence into math mode.
function autoFormatMathText(raw) {
  if (!raw) return raw;
  // Already has explicit LaTeX in it? Two possibilities:
  //  1. Genuinely clean, intentional LaTeX (e.g. typed in "Manual Mode") -> trust it, leave alone.
  //  2. Old/broken data from before this fix, where the ENTIRE sentence (Hindi words included)
  //     got dumped into one \( \) block -> KaTeX can't parse that reliably, which is exactly the
  //     "shows raw \( \) text instead of rendering" bug. Detect that case and repair it by
  //     unwrapping and re-running it through the normal (correct) formatter below.
  if (/\\\(|\\\[|\$\$/.test(raw)) {
    var brokenWrap = /\\[([][\s\S]*?[\u0900-\u097F][\s\S]*?\\[)\]]/.test(raw);
    if (!brokenWrap) return raw; // clean/manual LaTeX -- don't touch it
    raw = raw.replace(/\\\(|\\\)|\\\[|\\\]|\$\$/g, "");
    // fall through and reprocess raw as plain text below
  } else if (/\\frac|\\sqrt|\\cdot|\\times/.test(raw)) {
    return raw; // has real LaTeX commands already, trust it
  }

  var hasMathSignal = /[=+\-*/^√π≤≥≠×÷]|[⁰¹²³⁴⁵⁶⁷⁸⁹]|\b\d+\s*\/\s*\d+\b|\bsqrt\b|\b(sin|cos|tan|log)\b/i.test(raw);
  if (!hasMathSignal) return raw;

  // Split on sentence "words" -- Devanagari words (any length) and English words (3+ letters).
  // Everything between/around them (digits, operators, single/double-letter variables, √, ^, etc.)
  // is math notation and gets bundled into the equation buffer.
  var parts = raw.split(/([\u0900-\u097F]+|[A-Za-z]{3,})/);
  var out = "";
  var mathBuf = "";
  var hadText = false;

  function flushMath() {
    var buf = mathBuf;
    mathBuf = "";
    // pull whitespace out to the edges so it stays as normal spacing OUTSIDE the math mode,
    // instead of being swallowed by the \( \) wrap
    var lead = (buf.match(/^\s*/) || [""])[0];
    var trail = (buf.match(/\s*$/) || [""])[0];
    var core = buf.slice(lead.length, buf.length - trail.length);
    if (!core) { out += buf; return; }
    // reject buffers that are just stray punctuation/dashes (e.g. a trailing "-" used as a
    // sentence dash, not an equation) -- only treat it as math if something substantive remains
    if (!core.replace(/[\-–—,.()\s]/g, "")) { out += buf; return; }
    var converted = convertMathSymbols(core);
    if (hasMathContent(converted)) {
      out += lead + "\\(" + converted + "\\)" + trail;
    } else {
      out += buf; // not actually math (e.g. a stray letter/number) -- leave as plain text
    }
  }

  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (!part) continue;
    var isWordToken = (i % 2 === 1); // captured groups from split() land on odd indices
    if (isWordToken && !MATH_FUNC_WORDS.test(part)) {
      // ordinary sentence word (Hindi or English) -- flush pending equation, emit word as-is
      flushMath();
      out += part;
      hadText = true;
    } else {
      // math-function keyword (sin, cos, sqrt, greek letters...) or raw symbols/digits
      mathBuf += part;
    }
  }
  flushMath();

  // If the whole field was one bare equation with no surrounding sentence text, use display mode
  if (!hadText) {
    out = out.replace(/^\\\(/, "\\[").replace(/\\\)$/, "\\]");
  }
  return out;
}

function autoFormatMathFields(q) {
  if (!q || !isMathSubjectName(q.subject)) return q;
  if (q.mathManual) return q; // Manual Mode: admin typed LaTeX by hand, don't auto-format it
  ["textEN","textHI","explanationEN","explanationHI"].forEach(function(k){
    if (q[k]) q[k] = autoFormatMathText(q[k]);
  });
  ["optionsEN","optionsHI"].forEach(function(k){
    if (Array.isArray(q[k])) q[k] = q[k].map(function(o){ return autoFormatMathText(o); });
  });
  if (q.textHI) q.text = q.textHI; else if (q.textEN) q.text = q.textEN;
  if (q.optionsHI && q.optionsHI.some(Boolean)) q.options = q.optionsHI;
  else if (q.optionsEN) q.options = q.optionsEN;
  if (q.explanationHI) q.explanation = q.explanationHI; else if (q.explanationEN) q.explanation = q.explanationEN;
  return q;
}
window.isMathSubjectName = isMathSubjectName;
window.autoFormatMathText = autoFormatMathText;
window.autoFormatMathFields = autoFormatMathFields;

function renderMathIn(el) {
  if (!el) return;
  // Fast exit: is element me koi math delimiter hi nahi hai to KaTeX walk
  // (aur KaTeX download) ki zaroorat nahi.
  var _mt = el.textContent || "";
  if (_mt.indexOf("\\(") < 0 && _mt.indexOf("\\[") < 0 && _mt.indexOf("$$") < 0) return;
  // On-demand load: KaTeX (~300KB) sirf pehli baar kisi Math question
  // dikhne par hi fetch hoti hai — page load par nahi.
  if (!window.renderMathInElement) {
    if (window.__ensureLib) {
      window.__ensureLib("katex").then(function () { renderMathIn(el); }).catch(function () {});
    }
    return;
  }
  try {
    window.renderMathInElement(el, {
      delimiters: [
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true },
        { left: "$$", right: "$$", display: true }
      ],
      throwOnError: false
    });
  } catch (e) { /* ignore render errors on partial/invalid LaTeX */ }
}
window.renderMathIn = renderMathIn;

function updateMathPreview() {
  var box = document.getElementById("bank-math-preview");
  var body = document.getElementById("bank-math-preview-body");
  var hint = document.getElementById("bank-math-auto-hint");
  var manualCb = document.getElementById("bank-manual-latex");
  if (!box || !body) return;
  var subjEl = document.getElementById("bank-subject");
  var subj = subjEl ? subjEl.value : "";
  var en = (document.getElementById("bank-question-en") || {}).value || "";
  var hi = (document.getElementById("bank-question-hi") || {}).value || "";
  var src = hi || en;
  var isManual = !!(manualCb && manualCb.checked);

  if (!isMathSubjectName(subj) || !src) { box.style.display = "none"; if (hint) hint.style.display = ""; return; }

  if (isManual) {
    // Manual Mode: show exactly what will be rendered from the admin's own LaTeX, no auto-detect
    if (hint) hint.style.display = "none";
    box.style.display = "block";
    body.innerHTML = src;
    renderMathIn(body);
    return;
  }

  if (hint) hint.style.display = "";
  var formatted = autoFormatMathText(src);
  if (formatted === src) { box.style.display = "none"; return; }
  box.style.display = "block";
  body.innerHTML = formatted;
  renderMathIn(body);
}
window.updateMathPreview = updateMathPreview;

// ══════════════════════════════════════════════════════
//  BULK QUESTION UPLOAD (admin panel section)
// ══════════════════════════════════════════════════════
function parseBulkQuestions(text) {
  // Normalize: remove bold markers, zero-width non-joiner, soft hyphens
  const lines = text.split('\n')
    .map(l => l.trim()
      .replace(/\*\*/g, '')
      .replace(/\u200d|\u00ad|\u200b/g, '')  // zero-width chars
      .replace(/^[#>\s]+/, '')
      .trim()
    )
    .filter(Boolean);

  const questions = [];
  let currentQ = null;

  // Hindi option label map: क=0, ख=1, ग=2, घ=3, ङ=4
  const hindiOptMap = { 'क':0,'ख':1,'ग':2,'घ':3,'ङ':4,'A':0,'B':1,'C':2,'D':3,'E':4,'अ':0,'ब':1,'स':2,'द':3,'1':0,'2':1,'3':2,'4':3 };

  // A block only counts as a real MCQ if it has 2+ options *and* an
  // explicit answer-key line ("Ans: A" / "उत्तर: क") was found. Without
  // that, whatever looked like "options" was very likely explanation
  // bullets for a subjective (long-answer) question — so we reclassify
  // and fold them into the model answer instead of silently dropping
  // the question or mis-filing it as a 4-option MCQ.
  function pushCurrent() {
    if (!currentQ) return;
    if (currentQ.qType === 'subjective') { questions.push(currentQ); return; }
    if (currentQ.options.length >= 2 && currentQ._hasAnswerKey) { questions.push(currentQ); return; }
    if (currentQ.text && currentQ.text.trim()) {
      currentQ.qType = 'subjective';
      if (currentQ.options.length && !currentQ.modelAnswer) {
        currentQ.modelAnswer = currentQ.options.join(' ');
      }
      questions.push(currentQ);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // ── Question line detection ──────────────────────────────────────────
    // Matches: "1.", "Q1.", "Q.1", "प्रश्‍न 1.", "प्रश्न1.", "प्र. 1.", "(1)"
    const qMatch = line.match(
      /^(?:प्र(?:श्‍?न)?\.?\s*|Q\.?\s*)?(\d+)[\.)\-\s]\s*(.+)/i
    );
    if (qMatch) {
      pushCurrent();
      currentQ = { text: qMatch[2].trim(), options: [], answer: 0, explanation: "", qType: 'mcq', marks: null, modelAnswer: '', _hasAnswerKey: false };
      // Inline marks tag on the question line itself, e.g. "... (5 marks)"
      const inlineMarks = currentQ.text.match(/[\(\[]\s*(\d+)\s*(?:marks?|अंक)\s*[\)\]]\s*$/i);
      if (inlineMarks) {
        currentQ.marks = parseInt(inlineMarks[1]);
        currentQ.qType = 'subjective';
        currentQ.text = currentQ.text.replace(inlineMarks[0], '').trim();
      }
      continue;
    }
    if (!currentQ) continue;

    // ── Subjective markers ─────────────────────────────────────────────────
    // Explicit type tag: "Type: Subjective" / "(Subjective)" / "प्रकार: विषयनिष्ठ"
    const typeTagMatch = line.match(/^(?:type|प्रकार)\s*[:\-]\s*(subjective|विषयनिष्ठ|वर्णनात्मक|long\s*answer|short\s*answer)/i) ||
                          line.match(/^[\(\[]\s*subjective\s*[\)\]]\s*$/i);
    if (typeTagMatch) {
      currentQ.qType = 'subjective';
      continue;
    }

    const marksMatch = line.match(/^(?:marks|अंक)\s*[:\-]\s*(\d+)/i);
    if (marksMatch) {
      currentQ.qType = 'subjective';
      currentQ.marks = parseInt(marksMatch[1]);
      continue;
    }

    const modelAnsMatch = line.match(/^(?:model\s*answer|मॉडल\s*उत्तर|expected\s*answer)\s*[:\-]\s*(.+)/i);
    if (modelAnsMatch) {
      currentQ.qType = 'subjective';
      currentQ.modelAnswer = (currentQ.modelAnswer ? currentQ.modelAnswer + " " : "") + modelAnsMatch[1].trim();
      continue;
    }

    // ── Answer line detection (FIRST — before option check) ──────────────
    // Matches: "उत्तर– (क)", "उत्तर: ख", "Ans: A", "Answer: B", "सही उत्तर (ग)"
    const ansMatch = line.match(
      /^(?:उत्तर[\u2013\u2014\-:\s]*|ans(?:wer)?[\s:\-]*|correct[\s:\-]*|सही\s*उत्तर[\s:\-]*)\s*[\(\[]?([कखगघङA-E1-4])[\)\]]?\s*$/i
    );
    if (ansMatch) {
      const key = ansMatch[1];
      currentQ.answer = hindiOptMap[key] ?? hindiOptMap[key.toUpperCase()] ?? 0;
      currentQ._hasAnswerKey = true;
      continue;
    }

    // Free-text answer, e.g. "Answer: Because of typhoid..." — this is a
    // subjective (written) answer, not an MCQ option key, so route it
    // into modelAnswer instead of falling through to option parsing.
    const looseAnsMatch = line.match(/^(?:उत्तर[\u2013\u2014\-:\s]*|ans(?:wer)?[\s:\-]*|correct[\s:\-]*|सही\s*उत्तर[\s:\-]*)(.+)/i);
    if (looseAnsMatch) {
      currentQ.qType = 'subjective';
      currentQ.modelAnswer = (currentQ.modelAnswer ? currentQ.modelAnswer + " " : "") + looseAnsMatch[1].trim();
      continue;
    }

    // ── Option line detection ────────────────────────────────────────────
    // Matches: "(क)", "(A)", "A.", "A)", "1." — single or inline multi-option
    const inlineOpts = line.match(/^[\(\[]([कखगघङABCDE1234])[\)\]]\s*.+/i);
    if (inlineOpts) {
      const parts = line.split(/(?=[\(\[][कखगघABCDE1-4][\)\]])/i).filter(Boolean);
      if (parts.length > 1) {
        parts.forEach(part => {
          const m = part.match(/^[\(\[]([कखगघABCDE1-4])[\)\]]\s*(.+)/i);
          if (m) currentQ.options.push(m[2].trim());
        });
        continue;
      }
    }
    const optMatch = line.match(/^[\(\[]?([कखगघङA-E1-4])[\)\].\-]\s*(.+)/i);
    if (optMatch && optMatch[2]) {
      currentQ.options.push(optMatch[2].trim());
      continue;
    }

    // ── English text/option support (optional "EN:" prefix lines) ─────────
    const enQMatch = line.match(/^EN[\s:\-]+(.+)/i);
    if (enQMatch && currentQ.options.length === 0) { currentQ.textEN = enQMatch[1].trim(); continue; }
    const enOptMatch = line.match(/^EN[\)\.\-:\s]*[\(\[]?([A-E1-4])[\)\]]?\s*(.+)/i);
    if (enOptMatch) {
      if (!currentQ.optionsEN) currentQ.optionsEN = [];
      currentQ.optionsEN.push(enOptMatch[2].trim());
      continue;
    }

    // ── Explanation ──────────────────────────────────────────────────────
    const expMatch = line.match(/^(?:explanation|व्याख्या|हल|स्पष्टीकरण)\s*[:\-]\s*(.+)/i);
    if (expMatch) { currentQ.explanation = expMatch[1].trim(); continue; }

    // ── Continuation line — subjective answer, or question text ─────────
    if (currentQ.qType === 'subjective') {
      currentQ.modelAnswer = (currentQ.modelAnswer ? currentQ.modelAnswer + " " : "") + line;
    } else if (currentQ.options.length === 0) {
      currentQ.text += " " + line;
    }
  }
  pushCurrent();
  return questions;
}

function bulkLog(msg) {
  const box = document.getElementById('bulk-upload-log');
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML += `<div>${__sx(msg)}</div>`;
  box.scrollTop = box.scrollHeight;
}

// ══════════════════════════════════════════════════════════════
//  BULK UPLOAD v2 — Preview, Duplicate Check, Edit, Progress, Retry
// ══════════════════════════════════════════════════════════════

function downloadBulkCSVTemplate() {
  const headers = ["Question(HI)", "OptionA", "OptionB", "OptionC", "OptionD", "Answer", "Explanation"];
  const sample = ["भारत की राजधानी क्या है?", "दिल्ली", "मुंबई", "पटना", "जयपुर", "A", "दिल्ली भारत की राजधानी है।"];
  const csv = [headers.join(","), sample.map(csvEscapeBulk).join(",")].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bulk-upload-template.csv";
  a.click();
}
function csvEscapeBulk(val) {
  const s = String(val ?? "").replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}
function parseCSVLine(line) {
  const out = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}
function tryParseAsCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;
  const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  if (!header.some(h => h.includes("question"))) return null; // not CSV-template formatted
  const qIdx = header.findIndex(h => h.includes("question"));
  const ansIdx = header.findIndex(h => h.includes("answer"));
  const expIdx = header.findIndex(h => h.includes("explan"));
  const optIdxs = header.map((h, i) => h.startsWith("option") ? i : -1).filter(i => i >= 0);
  const ansMap = { a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line);
    const opts = optIdxs.map(i => (cols[i] || "").trim()).filter(Boolean);
    const ansRaw = (cols[ansIdx] || "a").trim().toLowerCase();
    return {
      text: (cols[qIdx] || "").trim(),
      options: opts,
      answer: ansMap[ansRaw] ?? 0,
      explanation: (cols[expIdx] || "").trim()
    };
  }).filter(q => q.text && q.options.length >= 2);
}

let bulkSelectedImages = [];   // [{file, name}]

function handleBulkImagesSelected(fileList) {
  bulkSelectedImages = Array.from(fileList || []).map(f => ({ file: f, name: f.name }));
  const statusEl = document.getElementById('bulk-images-status');
  statusEl.style.display = 'block';
  statusEl.textContent = `📷 ${bulkSelectedImages.length} image(s) select hui. Preview karne par auto-match hoga.`;
}

function extractNumberFromFilename(name) {
  const m = name.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function autoMatchBulkImages() {
  bulkParsedQuestions.forEach((q, i) => {
    if (q.imageFile) return; // already manually attached
    const match = bulkSelectedImages.find(img => extractNumberFromFilename(img.name) === (i + 1));
    if (match) { q.imageFile = match.file; q.imagePreviewUrl = URL.createObjectURL(match.file); }
  });
}

function attachImageToBulkRow(rowIdx, fileInput) {
  const file = fileInput.files[0];
  if (!file) return;
  bulkParsedQuestions[rowIdx].imageFile = file;
  bulkParsedQuestions[rowIdx].imagePreviewUrl = URL.createObjectURL(file);
  renderBulkPreviewTable();
}

function removeImageFromBulkRow(rowIdx) {
  bulkParsedQuestions[rowIdx].imageFile = null;
  bulkParsedQuestions[rowIdx].imagePreviewUrl = null;
  renderBulkPreviewTable();
}

// Image ko resize + compress karke ek base64 data-URI string mein badalte
// hain (Canvas se), taaki Firestore doc ke andar seedha save ho sake.
// ── Firebase Storage kyun use nahi kar rahe: ──
// Pehle ye function Firebase Storage (`firebase.storage()`) use karta tha,
// lekin naye Firebase projects mein (Oct 2024 se) Storage sirf paid
// "Blaze" plan par kaam karta hai — free "Spark" plan par upload silently
// fail ho jaata hai. Isi wajah se "image attach karte hi question upload
// nahi hota tha". Base64-in-Firestore approach bilkul free plan par bhi
// chalta hai, aur app mein already isi tarah images handle hoti hain
// (jaise AI Question Generator mein) — isliye consistent bhi hai.
function compressImageToDataUrl(file, maxDim, quality) {
  maxDim = maxDim || 900;
  quality = quality || 0.72;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Image padhi nahi gayi'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image load nahi hui'));
      img.onload = () => {
        let width = img.width, height = img.height;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) { reject(e); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadBulkImageIfAny(q, idx) {
  if (!q.imageFile) return "";
  try {
    return await compressImageToDataUrl(q.imageFile);
  } catch (e) {
    bulkLog(`⚠️ Q${idx + 1}: Image process nahi ho payi, question bina image ke save hoga — ${escHtml(e.message || String(e))}`);
    return "";
  }
}

window.handleBulkImagesSelected = handleBulkImagesSelected;
window.attachImageToBulkRow = attachImageToBulkRow;
window.removeImageFromBulkRow = removeImageFromBulkRow;

function normalizeQText(t) {
  return (t || "").toLowerCase().replace(/[^\u0900-\u097Fa-z0-9]+/g, " ").trim();
}

function isDuplicateQuestion(text) {
  if (typeof questionBank === "undefined" || !Array.isArray(questionBank)) return false;
  const norm = normalizeQText(text);
  if (!norm) return false;
  return questionBank.some(q => normalizeQText(q.textHI || q.text || "") === norm);
}

let bulkParsedQuestions = [];   // current preview state
let bulkFailedQuestions = [];   // failed-on-upload items, for retry/export
let bulkInputMode = 'combined'; // 'combined' | 'separate'

function setBulkInputMode(mode) {
  bulkInputMode = mode;
  const combinedBtn = document.getElementById('bulk-mode-combined-btn');
  const separateBtn = document.getElementById('bulk-mode-separate-btn');
  const combinedPanel = document.getElementById('bulk-combined-panel');
  const separatePanel = document.getElementById('bulk-separate-panel');
  if (combinedPanel) combinedPanel.classList.toggle('hidden', mode !== 'combined');
  if (separatePanel) separatePanel.classList.toggle('hidden', mode !== 'separate');
  if (combinedBtn) combinedBtn.className = mode === 'combined' ? 'btn-primary' : 'btn-secondary';
  if (separateBtn) separateBtn.className = mode === 'separate' ? 'btn-primary' : 'btn-secondary';
}
window.setBulkInputMode = setBulkInputMode;

// ── Separate Boxes parser ──────────────────────────────────────────────
// Questions/Options/Answer/Explanation alag-alag textareas se, line-by-line
// match karke, wahi { text, options, answer, explanation } shape banata hai
// jo parseBulkQuestions() (combined mode) banata hai — isliye neeche ka
// poora preview/duplicate-check/edit/upload pipeline bina kisi badlaav ke
// dono modes ke liye kaam karta hai.
const SEP_ANSWER_MAP = { 'क':0,'ख':1,'ग':2,'घ':3,'ङ':4,'A':0,'B':1,'C':2,'D':3,'E':4,'अ':0,'ब':1,'स':2,'द':3,'1':0,'2':1,'3':2,'4':3 };

function parseSeparateBoxesQuestions() {
  const qRaw   = (document.getElementById('bulk-sep-questions')?.value || '');
  const aRaw   = (document.getElementById('bulk-sep-opt-a')?.value || '');
  const bRaw   = (document.getElementById('bulk-sep-opt-b')?.value || '');
  const cRaw   = (document.getElementById('bulk-sep-opt-c')?.value || '');
  const dRaw   = (document.getElementById('bulk-sep-opt-d')?.value || '');
  const ansRaw = (document.getElementById('bulk-sep-answers')?.value || '');
  const expRaw = (document.getElementById('bulk-sep-explanations')?.value || '');

  const qLines   = qRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const aLines   = aRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const bLines   = bRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const cLines   = cRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const dLines   = dRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const ansLines = ansRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const expLines = expRaw.split('\n').map(l => l.trim()).filter(Boolean);

  if (!qLines.length) { alert('Pehle Questions box mein sawaal likhein.'); return []; }

  const checkLen = (lines, boxName) => {
    if (lines.length !== qLines.length) {
      alert(`⚠️ Line count match nahi ho raha!\n\nQuestions box mein ${qLines.length} lines hain, lekin ${boxName} box mein ${lines.length} lines hain.\n\nHar sawaal ke liye ek hi line honi chahiye, sabhi boxes mein same number of lines.`);
      return false;
    }
    return true;
  };
  if (!checkLen(aLines, 'Option A')) return [];
  if (!checkLen(bLines, 'Option B')) return [];
  // Option C aur D optional hain (2-option ya 3-option sawaal ke liye) —
  // sirf tab check karo jab box mein kuch likha ho.
  if (cLines.length && !checkLen(cLines, 'Option C')) return [];
  if (dLines.length && !checkLen(dLines, 'Option D')) return [];
  if (!checkLen(ansLines, 'Answer')) return [];
  if (expLines.length && !checkLen(expLines, 'Explanation')) return [];

  const questions = [];
  for (let i = 0; i < qLines.length; i++) {
    const text = qLines[i].replace(/^\d+[\.)\-\s]\s*/, ''); // leading "1. " numbering hata do agar ho
    const options = [aLines[i], bLines[i], cLines[i] || "", dLines[i] || ""].filter((o, idx) => idx < 2 || o);
    if (options.length < 2) {
      alert(`⚠️ Sawaal ${i + 1} ("${text.slice(0, 40)}...") ke Option A/B khaali hain.\n\nKam se kam Option A aur Option B bharna zaroori hai.`);
      return [];
    }
    const ansToken = ansLines[i];
    let answer = SEP_ANSWER_MAP[ansToken] ?? SEP_ANSWER_MAP[ansToken.toUpperCase()];
    if (answer === undefined) {
      // Letter/number se match nahi hua — shayad admin ne seedha sahi option ka text likha ho
      const idx = options.findIndex(o => o.toLowerCase() === ansToken.toLowerCase());
      answer = idx >= 0 ? idx : 0;
    }
    questions.push({
      text,
      options,
      answer,
      explanation: expLines[i] || ""
    });
  }
  return questions;
}

function previewBulkQuestions() {
  const classIdChosen = (document.getElementById('bulk-class-select')?.value || '').trim();
  if (!classIdChosen) { alert('⚠️ Kripya pehle Class chunein — kis Class ke liye ye questions hain, ye batana zaroori hai.'); return; }
  let parsed;
  if (bulkInputMode === 'separate') {
    parsed = parseSeparateBoxesQuestions();
    if (!parsed.length) return; // parseSeparateBoxesQuestions already alerted the specific issue
  } else {
    const rawText = (document.getElementById('bulk-raw-text')?.value || '').trim();
    if (!rawText) { alert('Pehle questions paste karo.'); return; }
    parsed = tryParseAsCSV(rawText) || parseBulkQuestions(rawText);
    if (!parsed.length) {
      alert('❌ Koi valid question nahi mila! Format check karo.');
      return;
    }
  }

  // Mark duplicates + quality issues
  bulkParsedQuestions = parsed.map(q => {
    const qType = q.qType === 'subjective' ? 'subjective' : 'mcq';
    while (q.options.length < 4) q.options.push("");
    const issues = [];
    if (qType === 'subjective') {
      if (q.marks == null) issues.push("Marks nahi mila");
      if (!q.modelAnswer || !q.modelAnswer.trim()) issues.push("Model answer nahi mila");
    } else {
      if (q.options.filter(o => !o.trim()).length > 0 && q.options.filter(Boolean).length < 4) issues.push("Khaali option");
      if (q.answer == null || q.answer < 0 || q.answer > 3 || !q.options[q.answer]) issues.push("Answer galat/khaali option se match nahi");
    }
    if (!q.text || q.text.length < 5) issues.push("Question text bahut chhota/khaali");
    return { ...q, qType, marks: q.marks ?? null, modelAnswer: q.modelAnswer || '', isDuplicate: isDuplicateQuestion(q.text), include: true, issues };
  });

  renderBulkPreviewTable();
  autoMatchBulkImages();
  renderBulkPreviewTable();
  document.getElementById('bulk-preview-area').style.display = 'block';
  const upBtn = document.getElementById('bulk-upload-btn');
  upBtn.disabled = false;
  upBtn.style.opacity = '1';
  document.getElementById('bulk-failed-area').style.display = 'none';
  document.getElementById('bulk-upload-log').style.display = 'none';
  document.getElementById('bulk-upload-log').innerHTML = '';
  if (window.renderMathIn) requestAnimationFrame(() => window.renderMathIn(document.getElementById('bulk-preview-tbody')));
}

function renderBulkPreviewTable() {
  const dupCount = bulkParsedQuestions.filter(q => q.isDuplicate).length;
  document.getElementById('bulk-preview-summary').textContent =
    `${bulkParsedQuestions.length} questions mile` + (dupCount ? ` · ⚠️ ${dupCount} possible duplicate` : '');

  const tbody = document.getElementById('bulk-preview-tbody');
  tbody.innerHTML = bulkParsedQuestions.map((q, i) => {
    const isSub = q.qType === 'subjective';
    const optsHtml = isSub ? '' : q.options.map((opt, oi) =>
      `<div style="display:flex;gap:6px;align-items:center;margin-top:3px;">
         <span style="color:#94a3b8;font-size:.75rem;">${String.fromCharCode(65 + oi)}.</span>
         <span contenteditable="true" data-row="${i}" data-opt="${oi}" class="bulk-opt-edit" style="flex:1;border-bottom:1px dashed #cbd5e1;padding:1px 3px;">${escHtml(opt)}</span>
       </div>`
    ).join('');
    const modelAnswerHtml = isSub ? `
      <div style="margin-top:6px;display:flex;gap:6px;align-items:baseline;">
        <span style="color:#94a3b8;font-size:.75rem;">Marks:</span>
        <span contenteditable="true" data-row="${i}" class="bulk-marks-edit" style="border-bottom:1px dashed #cbd5e1;padding:1px 3px;min-width:24px;">${q.marks ?? ''}</span>
      </div>
      <div style="margin-top:3px;">
        <span style="color:#94a3b8;font-size:.75rem;">Model answer:</span>
        <div contenteditable="true" data-row="${i}" class="bulk-modelanswer-edit" style="border-bottom:1px dashed #cbd5e1;padding:1px 3px;">${escHtml(q.modelAnswer || '')}</div>
      </div>` : '';
    return `<tr data-row="${i}" style="border-top:1px solid #e2e8f0;${q.isDuplicate ? 'background:#fff7ed;' : ''}">
      <td style="padding:6px;text-align:center;"><input type="checkbox" class="bulk-row-check" data-row="${i}" ${q.include ? 'checked' : ''} onchange="bulkParsedQuestions[${__sj(i)}].include=this.checked" /></td>
      <td style="padding:6px;color:#64748b;">${i + 1}${isSub ? '<div style="color:#7c3aed;font-size:.72rem;margin-top:2px;">📝 Subjective</div>' : ''}</td>
      <td style="padding:6px;">
        <div contenteditable="true" data-row="${i}" data-field="text" class="bulk-text-edit" style="font-weight:600;border-bottom:1px dashed #cbd5e1;padding:1px 3px;">${escHtml(q.text)}</div>
        ${optsHtml}
        ${modelAnswerHtml}
      </td>
      <td style="padding:6px;">
        ${isSub ? '—' : `<select data-row="${i}" class="bulk-answer-select" onchange="bulkParsedQuestions[${__sj(i)}].answer=parseInt(this.value)">
          ${[0,1,2,3].map(oi => `<option value="${oi}" ${q.answer === oi ? 'selected' : ''}>${String.fromCharCode(65 + oi)}</option>`).join('')}
        </select>`}
      </td>
      <td style="padding:6px;">
        ${q.imagePreviewUrl
          ? `<img src="${q.imagePreviewUrl}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #cbd5e1;display:block;margin-bottom:4px;" />
             <button type="button" onclick="removeImageFromBulkRow(${__sj(i)})" style="font-size:.7rem;color:#dc2626;background:none;border:none;cursor:pointer;padding:0;">✕ Remove</button>`
          : `<label style="font-size:.74rem;color:#0ea5e9;cursor:pointer;">📷 Attach<input type="file" accept="image/*" style="display:none;" onchange="attachImageToBulkRow(${__sj(i)}, this)" /></label>`
        }
      </td>
      <td style="padding:6px;">
        ${q.isDuplicate ? '<div style="color:#c2410c;">⚠️ Duplicate?</div>' : '<div style="color:#16a34a;">✓ New</div>'}
        ${(q.issues && q.issues.length) ? q.issues.map(iss => `<div style="color:#b91c1c;font-size:.74rem;">⚠️ ${iss}</div>`).join('') : ''}
      </td>
    </tr>`;
  }).join('');

  // wire up contenteditable edits back into bulkParsedQuestions
  tbody.querySelectorAll('.bulk-text-edit').forEach(el => {
    el.addEventListener('blur', () => { bulkParsedQuestions[el.dataset.row].text = el.textContent.trim(); });
  });
  tbody.querySelectorAll('.bulk-opt-edit').forEach(el => {
    el.addEventListener('blur', () => { bulkParsedQuestions[el.dataset.row].options[el.dataset.opt] = el.textContent.trim(); });
  });
  tbody.querySelectorAll('.bulk-marks-edit').forEach(el => {
    el.addEventListener('blur', () => { const n = parseInt(el.textContent.trim()); bulkParsedQuestions[el.dataset.row].marks = isNaN(n) ? null : n; });
  });
  tbody.querySelectorAll('.bulk-modelanswer-edit').forEach(el => {
    el.addEventListener('blur', () => { bulkParsedQuestions[el.dataset.row].modelAnswer = el.textContent.trim(); });
  });
}

function toggleAllBulkRows(checked) {
  bulkParsedQuestions.forEach(q => q.include = checked);
  document.querySelectorAll('.bulk-row-check').forEach(cb => cb.checked = checked);
}

function setBulkProgress(done, total) {
  const wrap = document.getElementById('bulk-progress-wrap');
  wrap.style.display = total ? 'block' : 'none';
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('bulk-progress-bar').style.width = pct + '%';
  document.getElementById('bulk-progress-text').textContent = `${done} / ${total}`;
}

let bulkLastUploadedIds = [];

async function uploadOneBulkQuestion(q, subject, chapter, difficulty, classId, idx, serial) {
  // v34: Doc ID ab readable format mein hai — Class + Chapter + Serial,
  // jaise "class10-Number-System-1". `serial` confirmBulkUpload() se
  // aata hai (poore batch ke liye ek baar compute hota hai, phir har
  // question ke liye ek-ek karke badhta hai).
  const docId = window.SubjectResolver.buildQuestionDocId(classId, chapter, serial);
  const imageUrl = await uploadBulkImageIfAny(q, idx);
  const isSub = q.qType === 'subjective';
  let qObj = {
    subject, chapter, difficulty, classId,
    textHI: q.text, textEN: q.textEN || "", text: q.text,
    optionsHI: isSub ? ["", "", "", ""] : q.options, optionsEN: q.optionsEN || ["", "", "", ""], options: isSub ? ["", "", "", ""] : q.options,
    answer: isSub ? 0 : q.answer,
    explanationHI: q.explanation || "", explanationEN: "", explanation: q.explanation || "",
    qType: isSub ? 'subjective' : 'mcq',
    marks: isSub ? (q.marks ?? null) : null,
    modelAnswer: isSub ? (q.modelAnswer || '') : '',
    image: imageUrl || "",
    seededBy: "BulkUploadUI"
  };
  if (window.autoFormatMathFields) qObj = window.autoFormatMathFields(qObj);
  await window.saveBankOnline(docId, qObj);
  // Firestore ka onSnapshot listener wapas aane mein thoda time (aur kabhi
  // network lag) lagta hai — tab tak ke liye local questionBank array mein
  // bhi turant push kar dete hain, taaki upload khatam hote hi list turant
  // (bina Refresh button dabayein) update dikhe. deleteBankQuestion() mein
  // bhi bilkul yahi pattern already use ho raha hai.
  if (typeof questionBank !== "undefined") {
    questionBank = questionBank.filter(x => x.id !== docId);
    questionBank.push({ id: docId, ...qObj });
    window.questionBank = questionBank;
  }
  return docId;
}

async function confirmBulkUpload() {
  const subject = (document.getElementById('bulk-subject')?.value || '').trim() || 'General';
  const chapter = (document.getElementById('bulk-chapter')?.value || '').trim() || 'General';
  const difficulty = document.getElementById('bulk-difficulty')?.value || 'medium';
  const classId = (document.getElementById('bulk-class-select')?.value || '').trim();
  // Class ab mandatory hai (v32) — bina iske questionBank mein koi bhi
  // naya question save nahi hota, taaki har question hamesha kisi na
  // kisi Class se tagged rahe (previewBulkQuestions() mein bhi wahi
  // check hai, ye yahan ek dusri safety-net hai — kabhi kisi ne seedha
  // confirmBulkUpload() call kar diya bina Preview ke to bhi bach jaaye).
  if (!classId) { alert('⚠️ Kripya Class chunein — kis Class ke liye ye questions hain, ye batana zaroori hai.'); return; }
  // v141: institute ki allowed classes ke bahar upload mat hone do (upload ho jata tha, par bank me dikhta nahi tha)
  try {
    var _allowedCls = (typeof getCurrentAdminAllowedClasses === 'function') ? getCurrentAdminAllowedClasses() : null;
    if (_allowedCls && _allowedCls.length && _allowedCls.indexOf(classId) < 0) {
      alert('⚠️ "' + classId + '" aapke institute ke liye allowed nahi hai, isliye ye questions bank me dikhte nahi. Allowed classes: ' + _allowedCls.join(', ') + '. Owner se class enable karwayein ya sahi class chunein.');
      return;
    }
  } catch (e) {}
  if (typeof saveCustomSubject === 'function' && subject) saveCustomSubject(subject);
  if (typeof saveCustomChapter === 'function' && subject && chapter) saveCustomChapter(subject, chapter);

  const toUpload = bulkParsedQuestions.filter(q => q.include);
  if (!toUpload.length) { alert('Koi question select nahi hai upload ke liye.'); return; }

  const btn = document.getElementById('bulk-upload-btn');
  const prevBtn = document.getElementById('bulk-preview-btn');
  const logBox = document.getElementById('bulk-upload-log');
  logBox.style.display = 'block'; logBox.innerHTML = '';
  btn.disabled = true; btn.textContent = '⏳ Uploading...';
  prevBtn.disabled = true;
  bulkFailedQuestions = [];
  document.getElementById('bulk-failed-area').style.display = 'none';

  let successCount = 0, failCount = 0;
  const uploadedIds = [];
  // v34: Poore batch ke liye Class+Chapter same hai, isliye serial number
  // ek hi baar compute karke phir har question ke liye badhate jaate hain
  // (jaise chapter mein 5 questions pehle se hain to ye batch 6,7,8...
  // se shuru hoga).
  let nextSerial = window.SubjectResolver.nextSerialForGroup(questionBank, classId, chapter);
  setBulkProgress(0, toUpload.length);
  for (let i = 0; i < toUpload.length; i++) {
    const q = toUpload[i];
    try {
      const docId = await uploadOneBulkQuestion(q, subject, chapter, difficulty, classId, i, nextSerial++);
      uploadedIds.push(docId);
      successCount++;
      q._uploaded = true; // preview table se hatane ke liye mark kar rahe hain
      bulkLog(`✔️ Q${i + 1} upload ho gaya: ${escHtml(q.text.substring(0, 40))}...`);
    } catch (e) {
      failCount++;
      bulkFailedQuestions.push(q);
      bulkLog(`❌ Q${i + 1} fail ho gaya: ${escHtml(e.message || String(e))}`);
    }
    setBulkProgress(i + 1, toUpload.length);
  }

  bulkLog(`<br/>🎉 <strong>Upload Complete!</strong> Successful: ${successCount}, Failed: ${failCount}`);
  btn.disabled = false; btn.textContent = '🚀 Confirm & Upload';
  prevBtn.disabled = false;
  if (failCount) document.getElementById('bulk-failed-area').style.display = 'block';
  if (uploadedIds.length) {
    bulkLastUploadedIds = uploadedIds;
    document.getElementById('bulk-undo-btn').style.display = 'inline-block';
  }
  // Jo questions successfully upload ho gaye unhe preview table se hata do
  // — pehle yahan table refresh hi nahi hota tha, isliye upload complete ho
  // jaane ke baad bhi wahi purana row "✓ New" status ke saath dikhta rehta
  // tha, jaise kuch hua hi na ho.
  bulkParsedQuestions = bulkParsedQuestions.filter(q => !q._uploaded);
  renderBulkPreviewTable();
  if (typeof renderBank === 'function') renderBank();
  if (!bulkParsedQuestions.length) {
    // Sab kuch upload ho gaya — input boxes bhi clear kar do taaki galti se
    // dobara Preview dabane par same purana text phir se process na ho.
    ['bulk-raw-text','bulk-sep-questions','bulk-sep-opt-a','bulk-sep-opt-b','bulk-sep-opt-c','bulk-sep-opt-d','bulk-sep-answers','bulk-sep-explanations'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }
}

async function undoLastBulkUpload() {
  if (!bulkLastUploadedIds.length) return;
  if (!confirm(`Last batch ke ${bulkLastUploadedIds.length} questions delete (Recycle Bin me move) karna hai?`)) return;
  const btn = document.getElementById('bulk-undo-btn');
  btn.disabled = true; btn.textContent = '⏳ Undo ho raha hai...';
  let ok = 0, fail = 0;
  for (const id of bulkLastUploadedIds) {
    try { await window.deleteBankQuestion(id, true); ok++; }
    catch (e) { fail++; }
  }
  bulkLog(`<br/>↩️ <strong>Undo Complete!</strong> Removed: ${ok}, Failed: ${fail}`);
  bulkLastUploadedIds = [];
  btn.style.display = 'none';
  btn.disabled = false; btn.textContent = '↩️ Undo Last Upload';
  if (typeof renderBank === 'function') renderBank();
}
window.undoLastBulkUpload = undoLastBulkUpload;
window.downloadBulkCSVTemplate = downloadBulkCSVTemplate;

async function retryFailedBulk() {
  if (!bulkFailedQuestions.length) return;
  const subject = (document.getElementById('bulk-subject')?.value || '').trim() || 'General';
  const chapter = (document.getElementById('bulk-chapter')?.value || '').trim() || 'General';
  const difficulty = document.getElementById('bulk-difficulty')?.value || 'medium';
  const classId = (document.getElementById('bulk-class-select')?.value || '').trim();
  if (!classId) { alert('⚠️ Kripya Class chunein — retry ke liye bhi Class zaroori hai.'); return; }
  const retryList = bulkFailedQuestions; bulkFailedQuestions = [];
  document.getElementById('bulk-failed-area').style.display = 'none';
  setBulkProgress(0, retryList.length);
  let ok = 0, fail = 0;
  let nextSerial = window.SubjectResolver.nextSerialForGroup(questionBank, classId, chapter);
  for (let i = 0; i < retryList.length; i++) {
    try {
      await uploadOneBulkQuestion(retryList[i], subject, chapter, difficulty, classId, i, nextSerial++);
      ok++;
      bulkLog(`✔️ Retry Q${i + 1} ho gaya.`);
    } catch (e) {
      fail++;
      bulkFailedQuestions.push(retryList[i]);
      bulkLog(`❌ Retry Q${i + 1} phir fail: ${escHtml(e.message || String(e))}`);
    }
    setBulkProgress(i + 1, retryList.length);
  }
  bulkLog(`<br/>🔁 <strong>Retry Complete!</strong> Successful: ${ok}, Still Failed: ${fail}`);
  if (fail) document.getElementById('bulk-failed-area').style.display = 'block';
  if (typeof renderBank === 'function') renderBank();
}

function exportFailedBulk() {
  if (!bulkFailedQuestions.length) return;
  const lines = bulkFailedQuestions.map((q, i) => {
    const opts = q.options.map((o, oi) => `(${'कखगघ'[oi] || String.fromCharCode(65 + oi)}) ${o}`).join('\n');
    return `प्रश्‍न ${i + 1}. ${q.text}\n${opts}\nउत्तर– (${'कखगघ'[q.answer] || 'क'})\n`;
  }).join('\n');
  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'failed-bulk-questions.txt';
  a.click();
}

window.parseBulkQuestions = parseBulkQuestions;
window.previewBulkQuestions = previewBulkQuestions;
window.confirmBulkUpload = confirmBulkUpload;
window.toggleAllBulkRows = toggleAllBulkRows;
window.retryFailedBulk = retryFailedBulk;
window.exportFailedBulk = exportFailedBulk;

// ══════════════════════════════════════════════════════════════
//  MULTI-FORMAT FILE UPLOAD — PDF · DOCX · TXT · CSV · JSON · Image
// ══════════════════════════════════════════════════════════════

// Drag-drop support
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const zone = document.getElementById('bulk-drop-zone');
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.background = '#e0f2fe'; zone.style.borderColor = '#0ea5e9'; });
    zone.addEventListener('dragleave', () => { zone.style.background = '#f8fafc'; zone.style.borderColor = '#94a3b8'; });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.style.background = '#f8fafc';
      zone.style.borderColor = '#94a3b8';
      const file = e.dataTransfer.files[0];
      if (file) handleBulkFileUpload(file);
    });
  });
})();

function bulkFileStatus(msg, ok) {
  const el = document.getElementById('bulk-file-status');
  if (!el) return;
  el.style.display = 'block';
  el.style.color = ok === false ? '#dc2626' : '#0f766e';
  el.textContent = msg;
}

async function handleBulkFileUpload(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  bulkFileStatus('⏳ File padh raha hoon: ' + file.name + '…');

  try {
    let extractedText = '';

    /* ── TXT ─────────────────────────────────────── */
    if (ext === 'txt') {
      extractedText = await file.text();
    }

    /* ── CSV ─────────────────────────────────────── */
    else if (ext === 'csv') {
      const raw = await file.text();
      extractedText = csvToQuestionText(raw);
    }

    /* ── JSON ────────────────────────────────────── */
    else if (ext === 'json') {
      const raw = await file.text();
      extractedText = jsonToQuestionText(raw);
    }

    /* ── PDF ─────────────────────────────────────── */
    else if (ext === 'pdf') {
      if (!window.PdfImport) throw new Error('pdf-import.js load nahi hua. Page refresh karein.');
      const result = await window.PdfImport.extractTextFromPdf(file);
      extractedText = result;
    }

    /* ── DOCX ────────────────────────────────────── */
    else if (ext === 'docx' || ext === 'doc') {
      extractedText = await docxToText(file);
    }

    /* ── Images (JPG/PNG/WEBP) — OCR via Tesseract ── */
    else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      extractedText = await imageToText(file);
    }

    else {
      // Unknown: try reading as plain text anyway
      try { extractedText = await file.text(); }
      catch (_) { throw new Error('Ye format abhi support nahi hota: .' + ext); }
    }

    if (!extractedText.trim()) throw new Error('File se koi text nahi mila.');

    document.getElementById('bulk-raw-text').value = extractedText.trim();
    const lineCount = extractedText.trim().split('\n').filter(Boolean).length;
    bulkFileStatus(`✅ ${file.name} padh liya (${lineCount} lines). Neeche "Start Bulk Upload" dabayein.`, true);

    // highlight textarea briefly
    const ta = document.getElementById('bulk-raw-text');
    ta.style.border = '2px solid #0ea5e9';
    setTimeout(() => ta.style.border = '', 2000);

  } catch (err) {
    bulkFileStatus('❌ ' + (err.message || 'File padhne mein dikkat aayi.'), false);
    console.error('[BulkFileUpload]', err);
  }
}

/* ── CSV → Question Text ─────────────────────────── */
function csvToQuestionText(raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return '';

  // Detect separator
  const sep = lines[0].includes('\t') ? '\t' : ',';

  // Try to parse as question CSV: Q, A, B, C, D, Ans, Explanation
  const header = lines[0].split(sep).map(h => h.replace(/^"|"$/g, '').toLowerCase().trim());
  const qIdx = header.findIndex(h => /^q|question|text|प्रश्न/.test(h));

  if (qIdx === -1) {
    // No header match — just join all cells as plain text
    return lines.join('\n');
  }

  const aIdx = header.findIndex(h => /^a$|^option.?a|^opt.?1/.test(h));
  const bIdx = header.findIndex(h => /^b$|^option.?b|^opt.?2/.test(h));
  const cIdx = header.findIndex(h => /^c$|^option.?c|^opt.?3/.test(h));
  const dIdx = header.findIndex(h => /^d$|^option.?d|^opt.?4/.test(h));
  const ansIdx = header.findIndex(h => /^ans|^answer|^correct/.test(h));
  const expIdx = header.findIndex(h => /^exp|^expl|^explanation|^व्याख्या/.test(h));

  const output = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], sep);
    const get = idx => (idx !== -1 && cols[idx] ? cols[idx].replace(/^"|"$/g, '').trim() : '');
    const qText = get(qIdx);
    if (!qText) continue;
    output.push(`${i}. ${qText}`);
    if (aIdx !== -1) output.push(`A) ${get(aIdx)}`);
    if (bIdx !== -1) output.push(`B) ${get(bIdx)}`);
    if (cIdx !== -1) output.push(`C) ${get(cIdx)}`);
    if (dIdx !== -1) output.push(`D) ${get(dIdx)}`);
    if (ansIdx !== -1 && get(ansIdx)) output.push(`Ans: ${get(ansIdx)}`);
    if (expIdx !== -1 && get(expIdx)) output.push(`Explanation: ${get(expIdx)}`);
    output.push('');
  }
  return output.join('\n');
}

function splitCsvLine(line, sep) {
  // Handles quoted fields
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ; continue; }
    if (line[i] === sep && !inQ) { result.push(cur); cur = ''; continue; }
    cur += line[i];
  }
  result.push(cur);
  return result;
}

/* ── JSON → Question Text ────────────────────────── */
function jsonToQuestionText(raw) {
  let data;
  try { data = JSON.parse(raw); } catch (_) { return raw; }

  // If array of question objects
  if (Array.isArray(data)) {
    const output = [];
    data.forEach((item, i) => {
      const qText = item.question || item.text || item.textHI || item.q || '';
      if (!qText) return;
      output.push(`${i + 1}. ${qText}`);
      const opts = item.options || item.optionsHI || item.choices || [];
      const letters = ['A', 'B', 'C', 'D'];
      opts.forEach((o, j) => output.push(`${letters[j]}) ${o}`));
      const ans = item.answer !== undefined ? item.answer : (item.correct !== undefined ? item.correct : '');
      if (ans !== '') {
        const ansLetter = typeof ans === 'number' ? letters[ans] : String(ans);
        output.push(`Ans: ${ansLetter}`);
      }
      const exp = item.explanation || item.explanationHI || '';
      if (exp) output.push(`Explanation: ${exp}`);
      output.push('');
    });
    return output.join('\n');
  }

  // Nested object — flatten values
  return JSON.stringify(data, null, 2);
}

/* ── DOCX → Plain Text ───────────────────────────── */
async function docxToText(file) {
  // Use mammoth.js from CDN if available, else load it
  if (!window.mammoth) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
  }
  if (!window.mammoth) throw new Error('mammoth.js load nahi hua. Internet check karein.');
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

/* ── Image → Text (OCR via Tesseract.js) ─────────── */
async function imageToText(file) {
  if (!window.Tesseract) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js');
  }
  if (!window.Tesseract) throw new Error('Tesseract.js load nahi hua. Internet check karein.');

  bulkFileStatus('🔍 Image se text nikaal raha hoon (OCR)… thoda wait karein…');

  const { data: { text } } = await window.Tesseract.recognize(file, 'hin+eng', {
    logger: m => {
      if (m.status === 'recognizing text') {
        bulkFileStatus(`🔍 OCR: ${Math.round((m.progress || 0) * 100)}% complete…`);
      }
    }
  });
  return text;
}

/* ── Script loader helper ────────────────────────── */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Script load failed: ' + src));
    document.head.appendChild(s);
  });
}

window.handleBulkFileUpload = handleBulkFileUpload;

// ══════════════════════════════════════════════════════
//  SMART SUBJECT + CHAPTER SYSTEM v3 (Delete support)
// ══════════════════════════════════════════════════════
var BUILTIN_SUBJECTS = window.SubjectResolver ? window.SubjectResolver.STANDARD_SUBJECTS : [
  "Mathematics","Reasoning","English","General Awareness",
  "History","Geography","Hindi","Science","Social Science",
  "Physics","Chemistry","Biology","Economics","Civics"
];
var BUILTIN_CHAPTERS = window.SubjectResolver ? window.SubjectResolver.SUBJECT_CHAPTERS : {};

function getCustomSubjects() { try { return JSON.parse(localStorage.getItem('savya_custom_subjects')||'[]'); } catch(e){return[];} }
function getCustomChapters(s) { try { var a=JSON.parse(localStorage.getItem('savya_custom_chapters')||'{}'); return a[s]||[]; } catch(e){return[];} }
function getDeletedSubjects() { try { return JSON.parse(localStorage.getItem('savya_deleted_subjects')||'[]'); } catch(e){return[];} }
function getDeletedChapters(s) { try { var a=JSON.parse(localStorage.getItem('savya_deleted_chapters')||'{}'); return a[s]||[]; } catch(e){return[];} }

function saveCustomSubject(subj) {
  if (!subj) return;
  var del=getDeletedSubjects(), di=del.indexOf(subj);
  if(di>-1){del.splice(di,1);localStorage.setItem('savya_deleted_subjects',JSON.stringify(del));}
  var list=getCustomSubjects();
  if(!list.includes(subj)){list.push(subj);localStorage.setItem('savya_custom_subjects',JSON.stringify(list));}
}
function saveCustomChapter(subject,chapter) {
  if(!subject||!chapter)return;
  try {
    var delAll=JSON.parse(localStorage.getItem('savya_deleted_chapters')||'{}');
    if(delAll[subject]){delAll[subject]=delAll[subject].filter(function(c){return c!==chapter;});localStorage.setItem('savya_deleted_chapters',JSON.stringify(delAll));}
    var all=JSON.parse(localStorage.getItem('savya_custom_chapters')||'{}');
    if(!all[subject])all[subject]=[];
    if(!all[subject].includes(chapter)){all[subject].push(chapter);localStorage.setItem('savya_custom_chapters',JSON.stringify(all));}
  }catch(e){}
}
function deleteSubject(subj) {
  var list=getCustomSubjects().filter(function(s){return s!==subj;});
  localStorage.setItem('savya_custom_subjects',JSON.stringify(list));
  if(BUILTIN_SUBJECTS.includes(subj)){var del=getDeletedSubjects();if(!del.includes(subj)){del.push(subj);localStorage.setItem('savya_deleted_subjects',JSON.stringify(del));}}
}
function deleteChapter(subject,chapter) {
  try{var all=JSON.parse(localStorage.getItem('savya_custom_chapters')||'{}');if(all[subject]){all[subject]=all[subject].filter(function(c){return c!==chapter;});localStorage.setItem('savya_custom_chapters',JSON.stringify(all));}}catch(e){}
  if((BUILTIN_CHAPTERS[subject]||[]).includes(chapter)){try{var d=JSON.parse(localStorage.getItem('savya_deleted_chapters')||'{}');if(!d[subject])d[subject]=[];if(!d[subject].includes(chapter)){d[subject].push(chapter);localStorage.setItem('savya_deleted_chapters',JSON.stringify(d));}}catch(e){}}
}
// Actual question bank (Firestore se load hua) ke andar jo subjects/chapters
// already istemal ho rahe hain, unhe bhi list mein shamil karte hain — sirf
// builtin + is browser ke localStorage cache par depend nahi karte. Isse
// dusre device/browser se ya seeder script se add hue subjects/chapters bhi
// dropdown mein "existing" ke roop mein dikhte hain.
// v35: har helper ab optional `classId` leta hai — diya gaya ho to sirf
// usi Class ke questions se Subject/Chapter list banti hai (Class → Subject
// → Chapter cascading). classId khaali ho to purana behavior (poora bank)
// hi milta hai — taaki jin jagah abhi tak Class select hi nahi hui, wahan
// kuch na tootey.
function getBankSubjectsFromData(classId) {
  if (typeof questionBank === 'undefined' || !Array.isArray(questionBank)) return [];
  var resolve = (typeof getQuestionSubject === 'function') ? getQuestionSubject : function(q){ return (q && q.subject) || ''; };
  var pool = classId ? questionBank.filter(function(q){ return q && q.classId === classId; }) : questionBank;
  return [...new Set(pool.map(resolve).filter(Boolean))];
}
function getBankChaptersFromData(subject, classId) {
  if (typeof questionBank === 'undefined' || !Array.isArray(questionBank)) return [];
  var resolve = (typeof getQuestionSubject === 'function') ? getQuestionSubject : function(q){ return (q && q.subject) || ''; };
  var pool = classId ? questionBank.filter(function(q){ return q && q.classId === classId; }) : questionBank;
  return [...new Set(pool.filter(function(q){ return resolve(q) === subject; }).map(function(q){ return q.chapter; }).filter(Boolean))];
}

function getAllSubjects(classId) {
  var del=getDeletedSubjects();
  return getBankSubjectsFromData(classId).filter(function(s){return!del.includes(s);}).sort(function(a,b){
    var ai=BUILTIN_SUBJECTS.indexOf(a), bi=BUILTIN_SUBJECTS.indexOf(b);
    if(ai>=0&&bi>=0) return ai-bi;
    if(ai>=0) return -1;
    if(bi>=0) return 1;
    return a.localeCompare(b);
  });
}
function getAllChapters(subject, classId) {
  var del=getDeletedChapters(subject);
  return getBankChaptersFromData(subject, classId).filter(function(c){return!del.includes(c);}).sort();
}

function populateBankSubjectDropdown(sel_val, classId) {
  var sel=document.getElementById('bank-subject-select'); if(!sel)return;
  var placeholder = classId ? '-- Subject chunein --' : '-- Pehle Class chunein --';
  sel.innerHTML='<option value="">'+placeholder+'</option>';
  sel.disabled = !classId;
  getAllSubjects(classId).forEach(function(s){var o=document.createElement('option');o.value=s;o.textContent=s;if(s===sel_val)o.selected=true;sel.appendChild(o);});
}
function populateBankChapterDropdown(subject,sel_val,classId) {
  var sel=document.getElementById('bank-chapter-select'); if(!sel)return;
  sel.innerHTML='<option value="">-- Chapter chunein --</option>';
  sel.disabled = !classId;
  getAllChapters(subject||'', classId).forEach(function(ch){var o=document.createElement('option');o.value=ch;o.textContent=ch;if(ch===sel_val)o.selected=true;sel.appendChild(o);});
}
function currentBankClassId() {
  var el = document.getElementById('bank-classid');
  return (el && el.value) || '';
}
function onBankClassIdChange() {
  var classId = currentBankClassId();
  // Class badalte hi Subject/Chapter selection reset — purani Class ka
  // Subject/Chapter is naye Class mein maujood na bhi ho sakta hai.
  document.getElementById('bank-subject').value = '';
  document.getElementById('bank-chapter').value = '';
  populateBankSubjectDropdown('', classId);
  populateBankChapterDropdown('', '', classId);
}
function onBankSubjectSelectChange() {
  var sel=document.getElementById('bank-subject-select'),inp=document.getElementById('bank-subject');
  if(sel.value){inp.value=sel.value;populateBankChapterDropdown(sel.value,'',currentBankClassId());document.getElementById('bank-chapter').value='';document.getElementById('bank-chapter-select').value='';}
  if (window.updateMathPreview) window.updateMathPreview();
}
function onBankChapterSelectChange() {
  var sel=document.getElementById('bank-chapter-select'),inp=document.getElementById('bank-chapter');
  if(sel.value)inp.value=sel.value;
}
function onBankSubjectInputChange() {
  var classId = currentBankClassId();
  var val=(document.getElementById('bank-subject').value||'').trim();
  document.getElementById('bank-subject-select').value=getAllSubjects(classId).includes(val)?val:'';
  populateBankChapterDropdown(val,'',classId);
  document.getElementById('bank-chapter').value='';
  document.getElementById('bank-chapter-select').value='';
}
window.setBankSubject=function(subject){
  var classId = currentBankClassId();
  var inp=document.getElementById('bank-subject'),sel=document.getElementById('bank-subject-select');
  if(inp)inp.value=subject||'';
  populateBankSubjectDropdown(subject, classId);populateBankChapterDropdown(subject||'','',classId);
  if(sel&&subject)sel.value=subject;
  if (window.updateMathPreview) window.updateMathPreview();
};

// ── Class dropdowns (v32) — Bulk Upload tab (mandatory, koi default nahi
// hai taaki har bulk upload se pehle admin ko active choice karni pade)
// aur Bank Edit modal (existing question ki Class dikhane/badalne ke
// liye), dono yahi ek hi shared list use karte hain. SAVYA_CLASS_OPTIONS
// owner-panel.js mein define hoti hai (Owner Panel ki "Allowed Classes"
// wali hi list — Class 9/10/11/12), isliye poore app mein ek hi jagah se
// Class options control hote hain.
function fillClassSelectOptions(sel, sel_val) {
  if (!sel) return;
  var opts = window.SAVYA_CLASS_OPTIONS || [
    { id: "class_9", label: "Class 9" }, { id: "class_10", label: "Class 10" },
    { id: "class_11", label: "Class 11" }, { id: "class_12", label: "Class 12" }
  ];
  // v141: sirf wahi Classes dikhao jo is institute ke liye allowed hain — warna question
  // upload to ho jata tha par Question Bank me kabhi dikhta nahi tha (class filter hide kar deta hai).
  try {
    var _al = (typeof getCurrentAdminAllowedClasses === 'function') ? getCurrentAdminAllowedClasses() : null;
    if (_al && _al.length) opts = opts.filter(function (c) { return _al.indexOf(c.id) >= 0 || c.id === sel_val; });
  } catch (e) {}
  sel.innerHTML = '<option value="">-- Class chunein --</option>';
  opts.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c.id; o.textContent = c.label;
    if (c.id === sel_val) o.selected = true;
    sel.appendChild(o);
  });
}
function populateBulkClassDropdown(sel_val) {
  fillClassSelectOptions(document.getElementById('bulk-class-select'), sel_val);
}
function populateBankClassDropdown(sel_val) {
  fillClassSelectOptions(document.getElementById('bank-classid'), sel_val);
}
// ── Bulk Upload: Subject/Chapter dropdowns (existing subjects/chapters dikhane ke liye) ──
// v35: Class → Subject → Chapter cascading — Class chune bina Subject/
// Chapter dropdown disabled rehte hain (khaali "-- Pehle Class chunein --"),
// taaki admin ko sabse pehle Class chunni hi pade.
function currentBulkClassId() {
  var el = document.getElementById('bulk-class-select');
  return (el && el.value) || '';
}
function populateBulkSubjectDropdown(sel_val, classId) {
  var sel=document.getElementById('bulk-subject-select'); if(!sel)return;
  var placeholder = classId ? '-- Subject chunein --' : '-- Pehle Class chunein --';
  sel.innerHTML='<option value="">'+placeholder+'</option>';
  sel.disabled = !classId;
  getAllSubjects(classId).forEach(function(s){var o=document.createElement('option');o.value=s;o.textContent=s;if(s===sel_val)o.selected=true;sel.appendChild(o);});
}
function populateBulkChapterDropdown(subject,sel_val,classId) {
  var sel=document.getElementById('bulk-chapter-select'); if(!sel)return;
  sel.innerHTML='<option value="">-- Chapter chunein --</option>';
  sel.disabled = !classId;
  getAllChapters(subject||'', classId).forEach(function(ch){var o=document.createElement('option');o.value=ch;o.textContent=ch;if(ch===sel_val)o.selected=true;sel.appendChild(o);});
}
function onBulkClassSelectChange() {
  var classId = currentBulkClassId();
  // Class badalte hi Subject/Chapter reset — dusri Class ke chapter is
  // Class mein galti se na lag jaayein.
  document.getElementById('bulk-subject').value = '';
  document.getElementById('bulk-chapter').value = '';
  var hint = document.getElementById('bulk-subject-hint');
  if (hint) hint.innerHTML = '';
  populateBulkSubjectDropdown('', classId);
  populateBulkChapterDropdown('', '', classId);
}
function onBulkSubjectSelectChange() {
  var sel=document.getElementById('bulk-subject-select'),inp=document.getElementById('bulk-subject');
  if(sel.value){
    inp.value=sel.value;
    populateBulkChapterDropdown(sel.value,'',currentBulkClassId());
    document.getElementById('bulk-chapter').value='';
    document.getElementById('bulk-chapter-select').value='';
  }
}
function onBulkChapterSelectChange() {
  var sel=document.getElementById('bulk-chapter-select'),inp=document.getElementById('bulk-chapter');
  if(sel.value)inp.value=sel.value;
}
function refreshExistingSubjectChapterDropdowns() {
  var bankSubjInp=document.getElementById('bank-subject');
  var bulkSubjInp=document.getElementById('bulk-subject');
  if(document.getElementById('bank-subject-select')){
    var bClass=currentBankClassId();
    var bSubj=(bankSubjInp&&bankSubjInp.value||'').trim();
    populateBankSubjectDropdown(bSubj, bClass);
    populateBankChapterDropdown(bSubj,(document.getElementById('bank-chapter')||{}).value, bClass);
  }
  if(document.getElementById('bulk-subject-select')){
    var kClass=currentBulkClassId();
    var kSubj=(bulkSubjInp&&bulkSubjInp.value||'').trim();
    populateBulkSubjectDropdown(kSubj, kClass);
    populateBulkChapterDropdown(kSubj,(document.getElementById('bulk-chapter')||{}).value, kClass);
  }
}
function levenshtein(a, b) {
  a = (a || '').toLowerCase(); b = (b || '').toLowerCase();
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}
function findCloseSubjectMatch(val, classId) {
  if (!val || val.length < 3) return null;
  const all = getAllSubjects(classId);
  if (all.includes(val)) return null; // exact match, no need
  let best = null, bestDist = 99;
  all.forEach(s => { const d = levenshtein(s, val); if (d < bestDist) { bestDist = d; best = s; } });
  return (best && bestDist > 0 && bestDist <= 2) ? best : null;
}
function onBulkSubjectInputChange() {
  var classId = currentBulkClassId();
  var val=(document.getElementById('bulk-subject').value||'').trim();
  document.getElementById('bulk-subject-select').value=getAllSubjects(classId).includes(val)?val:'';
  populateBulkChapterDropdown(val,'',classId);
  var hint = document.getElementById('bulk-subject-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'bulk-subject-hint';
    hint.style = 'font-size:.78rem;color:#b45309;margin-top:2px;';
    document.getElementById('bulk-subject').parentNode.parentNode.appendChild(hint);
  }
  const close = findCloseSubjectMatch(val, classId);
  hint.innerHTML = close
    ? `⚠️ Kya aapka matlab tha <a href="javascript:void(0)" onclick="document.getElementById('bulk-subject').value='${__sj(close)}';onBulkSubjectInputChange();" style="color:#0ea5e9;text-decoration:underline;">${close}</a>? (existing subject)`
    : '';
}
document.addEventListener('DOMContentLoaded', function(){
  populateBulkClassDropdown(); // koi sel_val nahi — blank hi rehta hai, admin ko khud chunna hoga
  // Class abhi tak nahi chuni gayi — Subject/Chapter dropdown khaali/
  // disabled shuru hote hain, jab tak admin Class na chun le.
  populateBulkSubjectDropdown('', '');
  populateBulkChapterDropdown('', '', '');
  document.getElementById('bulk-subject').value = '';
  document.getElementById('bulk-chapter').value = '';
});
var bulkUploadTabBtn=document.getElementById('bulk-upload-tab');
if(bulkUploadTabBtn){
  bulkUploadTabBtn.addEventListener('click', function(){
    var classId = currentBulkClassId();
    var s=document.getElementById('bulk-subject').value||'';
    populateBulkSubjectDropdown(s, classId);
    populateBulkChapterDropdown(s, '', classId);
  });
}

// ── Manage Panel (Delete UI) ──
function openManagePanel(){
  var panel=document.getElementById('manage-sc-panel');
  if(panel){renderManagePanel();panel.style.display='flex';return;}
  var ov=document.createElement('div');
  ov.id='manage-sc-panel';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  ov.innerHTML=`<div style="background:#fff;border-radius:16px;max-width:600px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;">
    <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#1e1b4b,#3730a3);">
      <h3 style="margin:0;color:#fff;font-size:1rem;">🗂️ Subject &amp; Chapter — Manage / Delete</h3>
      <button onclick="closeManagePanel()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1rem;">✕</button>
    </div>
    <div style="padding:12px 18px;border-bottom:1px solid #e5e7eb;background:#f8fafc;">
      <label style="font-size:.82rem;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Chapter delete karne ke liye pehle Subject chunein:</label>
      <select id="manage-subject-sel" onchange="renderManageChapters()" style="width:100%;padding:7px 11px;border:1.5px solid #d1d5db;border-radius:8px;font-size:.88rem;"></select>
    </div>
    <div id="manage-panel-body" style="overflow-y:auto;flex:1;padding:16px 18px;"></div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',function(e){if(e.target===ov)closeManagePanel();});
  renderManagePanel();
}
function closeManagePanel(){var p=document.getElementById('manage-sc-panel');if(p)p.style.display='none';}
function renderManagePanel(){
  var msel=document.getElementById('manage-subject-sel'); if(!msel)return;
  var cur=msel.value;
  msel.innerHTML='<option value="">-- Subject chunein --</option>';
  getAllSubjects().forEach(function(s){var o=document.createElement('option');o.value=s;o.textContent=s;if(s===cur)o.selected=true;msel.appendChild(o);});
  renderManageSubjectList(); renderManageChapters();
}
function renderManageSubjectList(){
  var body=document.getElementById('manage-panel-body'); if(!body)return;
  var subjects=getAllSubjects(), customList=getCustomSubjects();
  var html='<div style="margin-bottom:18px;"><div style="font-weight:700;color:#1e293b;font-size:.9rem;margin-bottom:10px;display:flex;align-items:center;gap:6px;">📚 All Subjects <span style="background:#dbeafe;color:#1e40af;font-size:.75rem;padding:2px 8px;border-radius:20px;">'+subjects.length+'</span><span style="font-size:.73rem;color:#6b7280;"> — ✕ se delete karo</span></div><div style="display:flex;flex-wrap:wrap;gap:7px;">';
  subjects.forEach(function(s){
    var isC=customList.includes(s),bg=isC?'#fef9c3':'#eff6ff',bdr=isC?'#fbbf24':'#93c5fd',clr=isC?'#78350f':'#1e40af';
    html+='<span style="display:inline-flex;align-items:center;gap:5px;background:'+bg+';border:1.5px solid '+bdr+';border-radius:20px;padding:5px 10px 5px 12px;font-size:.82rem;font-weight:600;color:'+clr+';">'+s+(isC?' <span style="font-size:.68rem;opacity:.65;">(custom)</span>':'')+' <button onclick="confirmDeleteSubject(\''+s.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\''+')" style="background:#ef4444;border:none;color:#fff;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:.68rem;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button></span>';
  });
  html+='</div></div>';
  body.innerHTML=html+'<div id="manage-chapter-section"></div>';
}
function renderManageChapters(){
  var msel=document.getElementById('manage-subject-sel'),section=document.getElementById('manage-chapter-section');
  if(!msel||!section)return;
  var subject=msel.value;
  if(!subject){section.innerHTML='<p style="color:#9ca3af;font-size:.84rem;text-align:center;padding:12px 0;">Upar subject chunein — us subject ke chapters dikhenge</p>';return;}
  var chapters=getAllChapters(subject),customChaps=getCustomChapters(subject);
  var html='<div style="font-weight:700;color:#1e293b;font-size:.9rem;margin-bottom:10px;display:flex;align-items:center;gap:6px;">📖 &ldquo;'+subject+'&rdquo; Chapters <span style="background:#dcfce7;color:#166534;font-size:.75rem;padding:2px 8px;border-radius:20px;">'+chapters.length+'</span></div>';
  if(!chapters.length){section.innerHTML=html+'<p style="color:#9ca3af;font-size:.84rem;">Koi chapter nahi mila.</p>';return;}
  html+='<div style="display:flex;flex-direction:column;gap:5px;">';
  chapters.forEach(function(ch){
    var isC=customChaps.includes(ch);
    html+='<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:'+(isC?'#fef9c3':'#f8fafc')+';border:1px solid '+(isC?'#fbbf24':'#e2e8f0')+';border-radius:8px;gap:8px;"><span style="font-size:.84rem;color:#1e293b;flex:1;">'+ch+(isC?' <span style="font-size:.7rem;color:#b45309;font-weight:600;">(custom)</span>':'')+'</span><button onclick="confirmDeleteChapter(\''+subject.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\',\''+ch.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\''+')" style="background:linear-gradient(135deg,#dc2626,#b91c1c);border:none;color:#fff;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:.78rem;font-weight:600;white-space:nowrap;flex-shrink:0;">🗑️ Delete</button></div>';
  });
  html+='</div>';
  section.innerHTML=html;
}
function confirmDeleteSubject(subj){
  if(!confirm('Delete "'+subj+'" subject?\n\nDropdown se hat jaayega. Existing questions safe rahenge.'))return;
  deleteSubject(subj);
  var classId = currentBankClassId();
  var cur=(document.getElementById('bank-subject')||{}).value;
  populateBankSubjectDropdown(cur===subj?'':cur, classId);
  if(cur===subj&&document.getElementById('bank-subject')){document.getElementById('bank-subject').value='';populateBankChapterDropdown('','',classId);}
  renderManagePanel();
}
function confirmDeleteChapter(subject,chapter){
  if(!confirm('Delete "'+chapter+'" chapter?\n\nDropdown se hat jaayega. Existing questions safe rahenge.'))return;
  deleteChapter(subject,chapter);
  var classId = currentBankClassId();
  var cur=(document.getElementById('bank-chapter')||{}).value;
  populateBankChapterDropdown(subject,cur===chapter?'':cur, classId);
  if(cur===chapter&&document.getElementById('bank-chapter'))document.getElementById('bank-chapter').value='';
  renderManagePanel();
}

// ══════════════════════════════════════════════════════
//  DUPLICATE QUESTION DETECTOR (exact + fuzzy) + MERGE
// ══════════════════════════════════════════════════════
function normalizeText(t) {
  return (t || '').toLowerCase().replace(/\s+/g,' ').replace(/[।,.\-–—?!""''()]/g,'').trim();
}
function wordSet(t) {
  return new Set(normalizeText(t).split(' ').filter(Boolean));
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  var inter = 0;
  a.forEach(function(w){ if (b.has(w)) inter++; });
  var union = a.size + b.size - inter;
  return union ? inter / union : 0;
}
// ── Options bhi compare karne ke liye helpers (sirf question text kaafi nahi) ──
function getQuestionOptions(q) {
  var hi = Array.isArray(q.optionsHI) ? q.optionsHI.filter(Boolean) : [];
  var en = Array.isArray(q.optionsEN) ? q.optionsEN.filter(Boolean) : [];
  return hi.length >= en.length ? hi : en; // jismein zyada options bhare hain wahi use karo
}
// Order-independent exact key — same 4 options kisi bhi order mein ho, phir bhi match maanenge.
function normalizeOptionsKey(q) {
  var opts = getQuestionOptions(q).map(normalizeText).filter(Boolean).sort();
  return opts.join('|');
}
// Fuzzy comparison ke liye options ke saare words ka ek combined set.
function optionsWordSet(q) {
  return wordSet(getQuestionOptions(q).join(' '));
}
function scoreQuestionCompleteness(q) {
  var s = 0;
  if (q.textEN) s++;
  if (q.textHI) s++;
  if (q.explanation || q.explanationEN || q.explanationHI) s++;
  if (Array.isArray(q.optionsEN) && q.optionsEN.filter(Boolean).length >= 4) s++;
  if (Array.isArray(q.optionsHI) && q.optionsHI.filter(Boolean).length >= 4) s++;
  if (q.chapter) s++;
  if (q.difficulty) s++;
  return s;
}
function pickBestInGroup(group) {
  var best = group[0];
  for (var i = 1; i < group.length; i++) {
    var a = scoreQuestionCompleteness(group[i]), b = scoreQuestionCompleteness(best);
    if (a > b || (a === b && String(group[i].id) < String(best.id))) best = group[i];
  }
  return best;
}
function findDuplicates() {
  var bank = (window.questionBank || []).filter(function(q){ return q && !q._test; });

  // ── Exact pass: ab key mein question text + (order-independent) options dono shamil hain.
  // Sirf question text same hone se duplicate nahi maanenge — options bhi same hone chahiye.
  var exactGroups = {};
  bank.forEach(function(q) {
    var textKey = normalizeText(q.textHI || q.textEN || q.text);
    if (!textKey) return;
    var optKey = normalizeOptionsKey(q);
    var key = textKey + '::' + optKey;
    if (!exactGroups[key]) exactGroups[key] = [];
    exactGroups[key].push(q);
  });
  var result = [];
  var usedIds = {};
  Object.values(exactGroups).forEach(function(g) {
    if (g.length > 1) {
      result.push({ type: 'exact', items: g });
      g.forEach(function(q){ usedIds[q.id] = true; });
    }
  });

  // Fuzzy pass: only among questions not already grouped, bucketed by subject+chapter to limit comparisons.
  // Ab do questions tabhi "similar" maane jaayenge jab unka text bhi milta ho AUR unke options bhi milte-julte hon.
  var TEXT_THRESHOLD = 0.82;
  var OPTIONS_THRESHOLD = 0.6; // options mein chhota-mota farak (typo/order) chalega, par pura alag set nahi
  var remaining = bank.filter(function(q){ return !usedIds[q.id]; });
  var buckets = {};
  remaining.forEach(function(q) {
    var subj = (window.getQuestionSubject ? window.getQuestionSubject(q) : (q.subject || '?'));
    var key = subj + '||' + (q.chapter || '?');
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(q);
  });
  Object.values(buckets).forEach(function(list) {
    var visited = new Array(list.length).fill(false);
    var textSets = list.map(function(q){ return wordSet(q.textHI || q.textEN || q.text); });
    var optSets = list.map(optionsWordSet);
    for (var i = 0; i < list.length; i++) {
      if (visited[i] || usedIds[list[i].id]) continue;
      var group = [list[i]];
      for (var j = i + 1; j < list.length; j++) {
        if (visited[j] || usedIds[list[j].id]) continue;
        var textMatch = textSets[i].size && jaccard(textSets[i], textSets[j]) >= TEXT_THRESHOLD;
        if (!textMatch) continue;
        // Agar dono taraf options data maujood hai to unhe bhi milaan karo;
        // agar kisi ek question ke options record nahi hain, to purane (text-only) tareeke par bharosa karo.
        var bothHaveOptions = optSets[i].size > 0 && optSets[j].size > 0;
        var optionsMatch = !bothHaveOptions || jaccard(optSets[i], optSets[j]) >= OPTIONS_THRESHOLD;
        if (optionsMatch) {
          group.push(list[j]);
          visited[j] = true;
        }
      }
      if (group.length > 1) {
        result.push({ type: 'fuzzy', items: group });
        group.forEach(function(q){ usedIds[q.id] = true; });
      }
      visited[i] = true;
    }
  });
  return result;
}

var lastDupGroups = [];
var autoDupInProgress = false;
var autoDupDebounceTimer = null;


function showDuplicateReport() {
  lastDupGroups = findDuplicates();
  renderDupReportPanel();
}

// ── AUTOMATIC background merge DISABLED — duplicate check ab sirf manual hai. ──
// Automatic detection kabhi kabhi galat questions ko duplicate maan leta tha,
// isliye ab yeh sirf "🔁 Duplicates Check" button se (showDuplicateReport) chalega,
// jahan aap khud dekh kar merge karoge.
function scheduleAutoDuplicateCheck() {
  // no-op: silent auto-merge disabled on purpose
}




window.scheduleAutoDuplicateCheck = scheduleAutoDuplicateCheck;


async function autoMergeAllDuplicates() {
  if (autoDupInProgress) { alert('Automatic merge already chal raha hai, thoda wait karo.'); return; }
  lastDupGroups = findDuplicates();
  if (!lastDupGroups.length) { alert('Koi duplicate nahi mila jise merge karein.'); return; }
  var totalRemove = lastDupGroups.reduce(function(n, g){ return n + g.items.length - 1; }, 0);
  if (!confirm('🤖 Auto-Merge: ' + lastDupGroups.length + ' group(s) mein se best question rakha jaayega aur ' + totalRemove + ' duplicate(s) Recycle Bin mein move ho jaayenge.\n\nContinue karein?')) return;
  var btn = document.getElementById('dup-automerge-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Merging...'; }
  autoDupInProgress = true;
  for (var i = 0; i < lastDupGroups.length; i++) {
    var group = lastDupGroups[i].items;
    var keep = pickBestInGroup(group);
    var removeIds = group.filter(function(q){ return q.id !== keep.id; }).map(function(q){ return q.id; });
    try { await window.mergeDuplicateGroup(keep.id, removeIds); } catch (e) { console.warn('Merge failed for group', e); }
  }
  autoDupInProgress = false;
  alert('✅ Auto-merge complete! Duplicates Recycle Bin mein move ho gaye.');
  lastDupGroups = findDuplicates();
  renderDupReportPanel();
  if (typeof renderBank === 'function') renderBank();
}

async function mergeOneGroup(groupIndex) {
  if (autoDupInProgress) { alert('Automatic merge already chal raha hai, thoda wait karo.'); return; }
  var group = lastDupGroups[groupIndex];
  if (!group) return;
  var panel = document.getElementById('dup-report-panel');
  var checked = panel.querySelector('input[name="keep-' + groupIndex + '"]:checked');
  if (!checked) { alert('Pehle ek question select karo jise rakhna hai.'); return; }
  var keepId = checked.value;
  var removeIds = group.items.filter(function(q){ return String(q.id) !== String(keepId); }).map(function(q){ return q.id; });
  if (!confirm(removeIds.length + ' duplicate(s) Recycle Bin mein move honge, sirf selected question rahega.\n\nContinue?')) return;
  var res = await window.mergeDuplicateGroup(keepId, removeIds);
  alert('✅ Merged! ' + res.ok + ' duplicate(s) hata diye.');
  lastDupGroups = findDuplicates();
  renderDupReportPanel();
  if (typeof renderBank === 'function') renderBank();
}

function renderDupReportPanel() {
  var dups = lastDupGroups;
  var old = document.getElementById('dup-report-panel');
  var ov = old || document.createElement('div');
  ov.id = 'dup-report-panel';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';

  var bodyHtml = '';
  if (!dups.length) {
    bodyHtml = '<div style="text-align:center;padding:32px 20px;"><div style="font-size:3rem;margin-bottom:12px;">✅</div><div style="font-size:1.1rem;font-weight:700;color:#166534;">Koi duplicate nahi mila!</div><div style="color:#6b7280;font-size:.88rem;margin-top:6px;">Sabhi questions unique hain.</div></div>';
  } else {
    var totalRemove = dups.reduce(function(n, g){ return n + g.items.length - 1; }, 0);
    bodyHtml = '<div style="background:#fef3c7;border:1.5px solid #fbbf24;border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:.84rem;color:#92400e;font-weight:600;">⚠️ ' + dups.length + ' duplicate group' + (dups.length > 1 ? 's' : '') + ' mili (' + totalRemove + ' extra copies) — neeche details dekhen</div>';
    bodyHtml += '<button id="dup-automerge-btn" onclick="autoMergeAllDuplicates()" style="width:100%;margin-bottom:14px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:.85rem;cursor:pointer;font-weight:700;">🤖 Auto-Merge All (best wala rakho, baaki Recycle Bin mein)</button>';
    dups.forEach(function(group, gi) {
      var items = group.items;
      var best = pickBestInGroup(items);
      var badge = group.type === 'exact' ? '<span style="background:#dc2626;color:#fff;border-radius:20px;padding:1px 8px;font-size:.7rem;">EXACT</span>' : '<span style="background:#d97706;color:#fff;border-radius:20px;padding:1px 8px;font-size:.7rem;">SIMILAR</span>';
      bodyHtml += '<div style="border:1.5px solid #fca5a5;border-radius:10px;margin-bottom:12px;overflow:hidden;">';
      bodyHtml += '<div style="background:linear-gradient(135deg,#fee2e2,#fecaca);padding:8px 12px;font-weight:700;font-size:.84rem;color:#991b1b;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">🔁 Group ' + (gi + 1) + ' ' + badge + ' <span style="background:#dc2626;color:#fff;border-radius:20px;padding:1px 8px;font-size:.75rem;">' + items.length + ' copies</span></div>';
      items.forEach(function(q, qi) {
        var subj = (window.getQuestionSubject ? window.getQuestionSubject(q) : (q.subject || '?'));
        var txt = q.textHI || q.textEN || q.text || '(no text)';
        var isBest = q.id === best.id;
        bodyHtml += '<label style="display:flex;gap:8px;align-items:flex-start;padding:8px 12px;border-top:' + (qi > 0 ? '1px solid #fca5a5' : 'none') + ';background:' + (isBest ? '#f0fdf4' : (qi % 2 === 0 ? '#fff' : '#fff7f7')) + ';cursor:pointer;">';
        bodyHtml += '<input type="radio" name="keep-' + gi + '" value="' + escHtml(String(q.id)) + '" ' + (isBest ? 'checked' : '') + ' style="margin-top:4px;">';
        bodyHtml += '<div style="flex:1;">';
        bodyHtml += '<div style="font-size:.78rem;color:#6b7280;margin-bottom:3px;display:flex;gap:8px;flex-wrap:wrap;">';
        bodyHtml += '<span style="background:#eff6ff;color:#1e40af;border-radius:4px;padding:1px 6px;font-weight:600;">' + escHtml(subj) + '</span>';
        bodyHtml += '<span style="background:#f0fdf4;color:#166534;border-radius:4px;padding:1px 6px;font-weight:600;">' + escHtml(q.chapter || '?') + '</span>';
        bodyHtml += '<span style="color:#9ca3af;font-size:.73rem;">ID: ' + escHtml(String(q.id || '?')) + '</span>';
        if (isBest) bodyHtml += '<span style="background:#16a34a;color:#fff;border-radius:4px;padding:1px 6px;font-weight:700;">⭐ Suggested keep</span>';
        bodyHtml += '</div>';
        bodyHtml += '<div style="font-size:.84rem;color:#1e293b;">' + escHtml(txt.substring(0, 140)) + (txt.length > 140 ? '...' : '') + '</div>';
        bodyHtml += '</div></label>';
      });
      bodyHtml += '<div style="padding:8px 12px;background:#fff;border-top:1px solid #fca5a5;">';
      bodyHtml += '<button onclick="mergeOneGroup(' + gi + ')" style="background:linear-gradient(135deg,#059669,#047857);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:.8rem;cursor:pointer;font-weight:700;">✅ Merge Group ' + (gi + 1) + ' (selected wala rakho)</button>';
      bodyHtml += '</div>';
      bodyHtml += '</div>';
    });
  }

  ov.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:640px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;">'
    + '<div style="padding:16px 20px;background:linear-gradient(135deg,#92400e,#b45309);display:flex;align-items:center;justify-content:space-between;">'
    + '<div><h3 style="margin:0;color:#fff;font-size:1rem;">🔁 Duplicate Questions Report</h3>'
    + '<div style="color:#fde68a;font-size:.78rem;margin-top:2px;">Total bank: ' + (window.questionBank || []).length + ' questions</div></div>'
    + '<button onclick="document.getElementById(\'dup-report-panel\').remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1rem;">✕</button>'
    + '</div>'
    + '<div style="overflow-y:auto;flex:1;padding:16px 18px;">' + bodyHtml + '</div>'
    + '</div>';
  if (!old) {
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if (e.target === ov) ov.remove(); });
  }
}

// ── Init ──
document.addEventListener('DOMContentLoaded',function(){
  var si=document.getElementById('bank-subject');
  if(si)si.addEventListener('input',onBankSubjectInputChange);
  var bf=document.getElementById('bank-form');
  if(bf){bf.addEventListener('submit',function(){
    var subj=(document.getElementById('bank-subject').value||'').trim();
    var chap=(document.getElementById('bank-chapter').value||'').trim();
    if(subj)saveCustomSubject(subj);
    if(subj&&chap)saveCustomChapter(subj,chap);
    var classId = currentBankClassId();
    setTimeout(function(){populateBankSubjectDropdown(subj,classId);populateBankChapterDropdown(subj,chap,classId);},300);
  },true);}
  // Modal khulte hi populateBankForm() Class ke hisaab se sahi values bhar
  // deta hai — yahan sirf ek safe empty/disabled starting state hai.
  populateBankSubjectDropdown('', '');
  populateBankChapterDropdown('', '', '');
});
