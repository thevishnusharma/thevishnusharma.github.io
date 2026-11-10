/* ============================================================
   The Vishnu Sharma — PAPER SETS (v229)  ·  Multiple Sets A–E
   ------------------------------------------------------------
   Ek hi jagah ka "pure logic" (koi DOM / Firebase nahi):
     • Paper Generator (qgen-sets.js)  -> sets banata, preview/print me dikhata
     • Admin sync (script.js)          -> publish par har set ki answer key nikalta
   Dono SAME functions use karte hain, isliye Paper me jo order/option
   order dikhta hai aur OMR key me jo answer jata hai wo kabhi alag nahi hota.

   Data format (test document me `qSets` field):
     {
       v: 1,
       n: 3,                      // kul sets (2..5). Set A = original paper
       optShuffle: true|false,    // options ka order bhi badla gaya?
       qids: [id, id, ...],       // original (Set A) order ke question ids — match check
       seg:  [12, 8, ...],        // section sizes (shuffle section ke andar hi hota hai)
       sets: {
         B: { o: [3,0,2,1,...],   // o[k] = Set B me k-th position par ORIGINAL question ka index
              p: ["2013","", ...] // p[i] = ORIGINAL question i ka option order ("2013": naya A = purana C ...)
            },
         C: { ... }
       }
     }
   Subjective questions apni jagah par rehte hain aur OMR me nahi aate.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PaperSets = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var LETTERS = ["A", "B", "C", "D", "E"];
  var OPT_LETTERS = ["A", "B", "C", "D"];
  var MAX_SETS = 5;
  var IDENTITY = "0123";

  /* ---------- small helpers ---------- */
  function defaultRng() {
    try {
      var c = (typeof crypto !== "undefined" && crypto) || (typeof globalThis !== "undefined" && globalThis.crypto);
      if (c && c.getRandomValues) {
        var buf = new Uint32Array(1);
        return function () {
          c.getRandomValues(buf);
          return buf[0] / 4294967296;
        };
      }
    } catch (e) {}
    return Math.random;
  }

  function clampSets(n) {
    n = Math.floor(Number(n));
    if (!isFinite(n) || n < 1) return 1;
    return Math.min(MAX_SETS, n);
  }

  function shuffleInPlace(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function isPermutation(arr, n) {
    if (!Array.isArray(arr) || arr.length !== n) return false;
    var seen = new Array(n);
    for (var i = 0; i < n; i++) {
      var v = arr[i];
      if (typeof v !== "number" || v % 1 !== 0 || v < 0 || v >= n || seen[v]) return false;
      seen[v] = true;
    }
    return true;
  }

  function isOptPerm(p, nOpts) {
    if (typeof p !== "string" || p.length !== nOpts) return false;
    var seen = {};
    for (var i = 0; i < p.length; i++) {
      var c = p.charAt(i);
      if (c < "0" || c > String(nOpts - 1) || seen[c]) return false;
      seen[c] = true;
    }
    return true;
  }

  function isIdentityP(p) {
    return !p || p === IDENTITY;
  }

  /* ---------- answer normalisation (same rule as the old sync) ---------- */
  function normAns(v) {
    if (v === undefined || v === null || v === "") return null;
    var u = Number(v);
    return isFinite(u) && u % 1 === 0 && u >= 0 && u < OPT_LETTERS.length ? u : null;
  }

  /* ---------- "options ek-doosre par depend karte hain?" ----------
     "Sab sahi", "A aur B dono", "None of the above", "उपरोक्त सभी" ... jaise
     options wale question me option shuffle KABHI nahi hoga (sirf question
     order badal sakta hai). Zyada lock = zyada safe, isliye pattern broad hain. */
  var LOCK_RES = [
    /\b(all|both|none|neither|any|every)\s+(of\s+)?(the\s+)?(above|these|them|following|options?|choices?)\b/,
    /\babove\s+(all|both|none)\b/,
    /^\s*(all|none|both|neither|nota|aota)\s*\.?\s*$/,
    /\bboth\b/,
    /\b(all|none)\s+of\s+(the\s+)?(above|these|them)\b/,
    /\b[a-d]\b\s*\)?\s*(,|&|and|or|&amp;)\s*\(?\s*\b[a-d]\b/,
    /\b(option|options|choice)\s*[\(\[]?\s*[a-d1-4]\b/,
    /\b(correct|true)\s+(option|answer)s?\b/,
    /उपरोक्त|उपर्युक्त|उपरोक्‍त|उपर्युक्‍त|उपरलिखित|उक्त\s*सभी|ऊपर\s*(दिए|दिये|के|वाले)/,
    /(^|\s)(सभी|सब|दोनों|दोनो)(\s|$|[.,।)])/,
    /कोई\s*(भी\s*)?नहीं|कोई\s*(भी\s*)?नही/,
    /इनमें\s*से\s*(सभी|कोई|दोनों|दोनो)/,
    /[(\[]?\s*[कखगघ]\s*[)\]]?\s*(,|और|तथा|एवं|व|&)\s*[(\[]?\s*[कखगघ]\s*[)\]]?(\s|$|[.,।)])/,
    /(विकल्प|option)\s*[(\[]?\s*[कखगघa-d1-4]/i,
  ];

  function optText(s) {
    return String(s == null ? "" : s)
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function optsLocked(opts) {
    if (!Array.isArray(opts)) return true;
    if (opts.length !== 4) return true;
    for (var i = 0; i < opts.length; i++) {
      var t = optText(opts[i]);
      if (!t) return true; // khaali option -> shuffle na karein
      for (var r = 0; r < LOCK_RES.length; r++) if (LOCK_RES[r].test(t)) return true;
    }
    return false;
  }

  /* ---------- descriptors ----------
     desc = { qid, mcq:boolean, nOpts:int, lock:boolean, ans:int|null } */
  function descFromTestQuestion(q) {
    var opts = (q && (q.options || q.optionsHI || q.optionsEN || q.opts)) || [];
    var mcq = !(q && q.qType === "subjective");
    return {
      qid: q && (q.id !== undefined && q.id !== null ? q.id : q.firestoreId),
      mcq: mcq,
      nOpts: Array.isArray(opts) ? opts.length : 0,
      lock: mcq ? optsLocked(opts) : true,
      ans: mcq ? normAns(q.answer !== undefined && q.answer !== null ? q.answer : q.ans) : null,
    };
  }

  function normSeg(seg, N) {
    if (Array.isArray(seg) && seg.length) {
      var sum = 0,
        ok = true;
      for (var i = 0; i < seg.length; i++) {
        var s = seg[i];
        if (typeof s !== "number" || s % 1 !== 0 || s < 0) ok = false;
        else sum += s;
      }
      if (ok && sum === N) return seg.filter(function (x) { return x > 0; });
    }
    return [N];
  }

  function identityOrder(N) {
    var o = new Array(N);
    for (var i = 0; i < N; i++) o[i] = i;
    return o;
  }

  function sigOf(set) {
    return set.o.join(",") + "|" + set.p.join(",");
  }

  function makeSet(descs, seg, optShuffle, rng) {
    var N = descs.length;
    var o = identityOrder(N);
    var start = 0;
    for (var s = 0; s < seg.length; s++) {
      var end = start + seg[s];
      var slots = [];
      for (var i = start; i < end; i++) if (descs[i].mcq) slots.push(i);
      var picked = shuffleInPlace(slots.slice(), rng);
      for (var k = 0; k < slots.length; k++) o[slots[k]] = picked[k];
      start = end;
    }
    var p = new Array(N);
    for (var q = 0; q < N; q++) {
      var d = descs[q];
      if (!d.mcq) {
        p[q] = "";
        continue;
      }
      if (optShuffle && !d.lock && d.nOpts === 4) {
        var pm = [0, 1, 2, 3];
        for (var tries = 0; tries < 8; tries++) {
          shuffleInPlace(pm, rng);
          if (pm.join("") !== IDENTITY) break;
        }
        p[q] = pm.join("");
      } else p[q] = IDENTITY;
    }
    return { o: o, p: p };
  }

  /* ---------- validate ----------
     Persisted/in-memory qSets ko CURRENT questions se match karta hai.
     Koi bhi shak -> { ok:false } (tab keys kabhi nahi likhi jaati). */
  function validate(qs, descs) {
    function bad(reason) {
      return { ok: false, reason: reason };
    }
    if (!qs || typeof qs !== "object" || qs.v !== 1) return bad("sets ka data nahi mila");
    var N = descs.length;
    var n = Number(qs.n);
    if (!(n >= 2 && n <= MAX_SETS) || n % 1 !== 0) return bad("sets ki ginti galat hai");
    if (!Array.isArray(qs.qids) || qs.qids.length !== N) return bad("questions ki ginti badal gayi");
    for (var i = 0; i < N; i++) {
      var id = descs[i].qid;
      if (id === undefined || id === null || id === "") return bad("question id nahi hai");
      if (String(qs.qids[i]) !== String(id)) return bad("questions badal gaye ya unka order badal gaya");
    }
    var seg = qs.seg;
    var segSum = 0;
    if (!Array.isArray(seg) || !seg.length) return bad("section data nahi hai");
    for (var g = 0; g < seg.length; g++) {
      if (typeof seg[g] !== "number" || seg[g] % 1 !== 0 || seg[g] <= 0) return bad("section data galat hai");
      segSum += seg[g];
    }
    if (segSum !== N) return bad("section data questions se match nahi karta");
    var segOf = new Array(N),
      sIdx = 0,
      left = seg[0];
    for (var z = 0; z < N; z++) {
      while (left === 0 && sIdx < seg.length - 1) left = seg[++sIdx];
      segOf[z] = sIdx;
      left--;
    }
    if (!qs.sets || typeof qs.sets !== "object") return bad("sets ka data nahi mila");
    for (var s = 1; s < n; s++) {
      var L = LETTERS[s];
      var st = qs.sets[L];
      if (!st) return bad("Set " + L + " ka data nahi hai");
      if (!isPermutation(st.o, N)) return bad("Set " + L + " ka order galat hai");
      if (!Array.isArray(st.p) || st.p.length !== N) return bad("Set " + L + " ka option-order galat hai");
      for (var k = 0; k < N; k++) {
        var orig = st.o[k];
        if (!descs[k].mcq) {
          if (orig !== k) return bad("Set " + L + ": subjective question apni jagah par nahi hai");
        } else {
          if (!descs[orig].mcq) return bad("Set " + L + ": MCQ ki jagah galat question aaya");
          if (segOf[orig] !== segOf[k]) return bad("Set " + L + ": question apne section se bahar chala gaya");
        }
        var d = descs[k];
        var pp = st.p[k];
        if (!d.mcq) continue;
        if (isIdentityP(pp)) continue;
        if (d.nOpts !== 4 || !isOptPerm(pp, 4)) return bad("Set " + L + ": option-order galat hai (Q" + (k + 1) + ")");
        if (d.lock) return bad("Set " + L + ": Q" + (k + 1) + " ke options ab 'sab sahi/A aur B' type hain — option shuffle allowed nahi");
      }
    }
    return { ok: true };
  }

  /* ---------- generate ----------
     o = { n, optShuffle, seg, rng, existing }
     existing (valid qSets) diya ho to uske purane sets ASAAN rehte hain, sirf naye sets bante hain. */
  function generate(descs, o) {
    o = o || {};
    var N = descs.length;
    var n = clampSets(o.n);
    if (n < 2 || !N) return null;
    var rng = o.rng || defaultRng();
    var seg = normSeg(o.seg, N);
    var optShuffle = !!o.optShuffle;
    var out = {
      v: 1,
      n: n,
      optShuffle: optShuffle,
      qids: descs.map(function (d) {
        return String(d.qid);
      }),
      seg: seg.slice(),
      sets: {},
    };
    var seen = {};
    var ident = { o: identityOrder(N), p: descs.map(function (d) { return d.mcq ? IDENTITY : ""; }) };
    seen[sigOf(ident)] = true;
    var keep = null;
    if (o.existing && o.existing.optShuffle === optShuffle) {
      var v = validate(o.existing, descs);
      if (v.ok && JSON.stringify(o.existing.seg) === JSON.stringify(seg)) keep = o.existing;
    }
    for (var s = 1; s < n; s++) {
      var L = LETTERS[s];
      if (keep && s < keep.n && keep.sets[L]) {
        var kc = { o: keep.sets[L].o.slice(), p: keep.sets[L].p.slice() };
        out.sets[L] = kc;
        seen[sigOf(kc)] = true;
        continue;
      }
      var chosen = null;
      for (var t = 0; t < 40; t++) {
        var cand = makeSet(descs, seg, optShuffle, rng);
        if (!chosen) chosen = cand;
        if (!seen[sigOf(cand)]) {
          chosen = cand;
          break;
        }
      }
      out.sets[L] = chosen;
      seen[sigOf(chosen)] = true;
    }
    return out;
  }

  /* kya in questions se alag-alag sets ban bhi sakte hain? */
  function canDiffer(descs, optShuffle) {
    var mcq = 0,
      shufflable = 0;
    descs.forEach(function (d) {
      if (d.mcq) {
        mcq++;
        if (!d.lock && d.nOpts === 4) shufflable++;
      }
    });
    return mcq >= 2 || (!!optShuffle && shufflable >= 1);
  }

  function countLocked(descs) {
    var c = 0;
    descs.forEach(function (d) {
      if (d.mcq && d.lock) c++;
    });
    return c;
  }

  /* ---------- apply ---------- */
  function permuteOpts(opts, p) {
    if (!Array.isArray(opts) || isIdentityP(p)) return opts;
    var out = [];
    for (var j = 0; j < p.length; j++) out.push(opts[Number(p.charAt(j))]);
    return out;
  }

  function mapAnswer(ans, p) {
    var a = normAns(ans);
    if (a === null) return null;
    if (isIdentityP(p)) return a;
    var j = p.indexOf(String(a));
    return j >= 0 ? j : null;
  }

  function setOf(qs, letter) {
    if (!qs || letter === "A" || !qs.sets) return null;
    return qs.sets[letter] || null;
  }

  function orderOf(qs, letter, N) {
    var st = setOf(qs, letter);
    return st && st.o ? st.o : identityOrder(N);
  }

  function pOf(qs, letter, orig) {
    var st = setOf(qs, letter);
    return st && st.p ? st.p[orig] : "";
  }

  /* qs = [{mcq, ans}] ORIGINAL (Set A) order me. Return: us set ke OMR numbering ki key
     (sirf MCQ, printed order me) — ["C","A",null,...] */
  function answerKey(qSets, letter, qs, maxQ) {
    var N = qs.length;
    var o = orderOf(qSets, letter, N);
    var key = [];
    var limit = maxQ > 0 ? maxQ : 100;
    for (var k = 0; k < N; k++) {
      var orig = o[k];
      var q = qs[orig];
      if (!q || !q.mcq) continue;
      if (key.length >= limit) break;
      var idx = mapAnswer(q.ans, pOf(qSets, letter, orig));
      key.push(idx === null ? null : OPT_LETTERS[idx] || null);
    }
    return key;
  }

  function buildKeys(qSets, qs, maxQ) {
    var n = qSets && qSets.n >= 2 ? qSets.n : 1;
    var keys = {};
    for (var s = 0; s < n; s++) keys[LETTERS[s]] = answerKey(qSets, LETTERS[s], qs, maxQ);
    return keys;
  }

  /* Test (admin/draft) ke questions -> { descs, qs } */
  function fromTest(questions) {
    var descs = (questions || []).map(descFromTestQuestion);
    var qs = descs.map(function (d) {
      return { mcq: d.mcq, ans: d.ans };
    });
    return { descs: descs, qs: qs };
  }

  /* Persist ke liye saaf copy (sirf wahi fields jo format me hain) */
  function sanitize(qs) {
    if (!qs || qs.v !== 1) return null;
    var out = { v: 1, n: qs.n, optShuffle: !!qs.optShuffle, qids: qs.qids.map(String), seg: qs.seg.slice(), sets: {} };
    for (var s = 1; s < qs.n; s++) {
      var L = LETTERS[s];
      out.sets[L] = { o: qs.sets[L].o.slice(), p: qs.sets[L].p.slice() };
    }
    return out;
  }

  return {
    LETTERS: LETTERS,
    OPT_LETTERS: OPT_LETTERS,
    MAX_SETS: MAX_SETS,
    clampSets: clampSets,
    normAns: normAns,
    optsLocked: optsLocked,
    descFromTestQuestion: descFromTestQuestion,
    fromTest: fromTest,
    generate: generate,
    validate: validate,
    canDiffer: canDiffer,
    countLocked: countLocked,
    permuteOpts: permuteOpts,
    mapAnswer: mapAnswer,
    orderOf: orderOf,
    pOf: pOf,
    answerKey: answerKey,
    buildKeys: buildKeys,
    sanitize: sanitize,
    isIdentityP: isIdentityP,
  };
});
