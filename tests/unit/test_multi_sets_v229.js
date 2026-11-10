// v229 Multiple Sets: paper-sets.js logic + syncTestToExamManager + qgen-sets.js views (plain Node, no framework)
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const PS = require(path.join(ROOT, 'paper-sets.js'));
let pass = 0, fail = 0;
function T(name, fn) { try { fn(); console.log('  PASS ' + name); pass++; } catch (e) { console.log('  FAIL ' + name + '\n   ' + (e.message || e)); fail++; } }
async function TA(name, fn) { try { await fn(); console.log('  PASS ' + name); pass++; } catch (e) { console.log('  FAIL ' + name + '\n   ' + (e.message || e)); fail++; } }
function rngSeed(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function mkTest(rng, N) {
  const qs = [];
  for (let i = 0; i < N; i++) { const sub = rng() < 0.15; qs.push({ id: 'id' + i, qType: sub ? 'subjective' : 'mcq', options: [0,1,2,3].map(j => `q${i}-opt${j}`), answer: Math.floor(rng() * 4) }); }
  return qs;
}
function segs(rng, N) { const seg = []; let left = N; while (left > 0) { const s = 1 + Math.floor(rng() * Math.min(left, 15)); seg.push(s); left -= s; } return seg; }

(async () => {
  T('300 random papers: key letter == position of correct text in the printed set', () => {
    for (let t = 0; t < 300; t++) {
      const rng = rngSeed(t + 7), N = 1 + Math.floor(rng() * 60), q = mkTest(rng, N), seg = segs(rng, N);
      const { descs, qs } = PS.fromTest(q), n = 2 + Math.floor(rng() * 4);
      const g = PS.generate(descs, { n, optShuffle: rng() < .5, seg, rng });
      assert(PS.validate(g, descs).ok);
      const keys = PS.buildKeys(g, qs, 100);
      for (let s = 0; s < n; s++) {
        const L = PS.LETTERS[s], o = PS.orderOf(g, L, N), printed = [];
        for (let k = 0; k < N; k++) {
          const orig = o[k], x = q[orig];
          if (x.qType === 'subjective') { assert.strictEqual(orig, k); continue; }
          const opts = PS.permuteOpts(x.options, PS.pOf(g, L, orig));
          printed.push('ABCD'[opts.indexOf(x.options[x.answer])]);
        }
        printed.slice(0, 100).forEach((c, i) => assert.strictEqual(keys[L][i], c));
        let st = 0; for (const z of seg) { for (let k = st; k < st + z; k++) assert(o[k] >= st && o[k] < st + z); st += z; }
      }
      assert.deepStrictEqual(keys.A, qs.filter(x => x.mcq).map(x => x.ans === null ? null : 'ABCD'[x.ans]).slice(0, 100));
    }
  });
  T('option shuffle off -> options never permuted', () => {
    const rng = rngSeed(3), q = mkTest(rng, 20), { descs } = PS.fromTest(q);
    const g = PS.generate(descs, { n: 3, optShuffle: false, seg: [20], rng });
    ['B', 'C'].forEach(L => g.sets[L].p.forEach(p => assert(p === '' || p === '0123')));
  });
  T('locked options (sab sahi / both / उपरोक्त) never shuffled', () => {
    const q = [0,1,2,3,4,5].map(i => ({ id: 'i' + i, qType: 'mcq', options: ['a1','b1','c1', i % 2 ? 'All of the above' : 'उपरोक्त सभी'], answer: 3 }));
    const { descs } = PS.fromTest(q);
    const g = PS.generate(descs, { n: 5, optShuffle: true, seg: [6] });
    for (const L of ['B','C','D','E']) g.sets[L].p.forEach(p => assert.strictEqual(p, '0123'));
    assert.strictEqual(PS.optsLocked(['Delhi','Mumbai','Pune','Agra']), false);
    assert.strictEqual(PS.optsLocked(['x','y','z','Both A and B']), true);
    assert.strictEqual(PS.optsLocked(['क','ख','ग','इनमें से कोई नहीं']), true);
  });
  T('validate rejects changed/reordered/removed questions and tampered perms', () => {
    const rng = rngSeed(11), q = mkTest(rng, 12), { descs } = PS.fromTest(q);
    const g = PS.generate(descs, { n: 3, optShuffle: true, seg: [12], rng });
    assert(PS.validate(g, descs).ok);
    const q2 = q.slice(); [q2[0], q2[1]] = [q2[1], q2[0]];
    assert(!PS.validate(g, PS.fromTest(q2).descs).ok, 'reorder');
    assert(!PS.validate(g, PS.fromTest(q.slice(1)).descs).ok, 'removed');
    const bad = JSON.parse(JSON.stringify(g)); bad.sets.B.o[0] = bad.sets.B.o[1];
    assert(!PS.validate(bad, descs).ok, 'not a permutation');
    const bad2 = JSON.parse(JSON.stringify(g)); const mi = descs.findIndex(d => d.mcq); bad2.sets.B.p[mi] = '0011';
    assert(!PS.validate(bad2, descs).ok, 'bad option perm');
    const q3 = JSON.parse(JSON.stringify(q)); const k = q3.findIndex((x, i) => x.qType === 'mcq' && g.sets.B.p[i] !== '0123' && g.sets.B.p[i]);
    if (k >= 0) { q3[k].options[3] = 'All of the above'; assert(!PS.validate(g, PS.fromTest(q3).descs).ok, 'became locked'); }
  });
  T('answer change after sets were made still maps correctly (key is computed, not stored)', () => {
    const rng = rngSeed(5), q = mkTest(rng, 10), { descs } = PS.fromTest(q);
    const g = PS.generate(descs, { n: 2, optShuffle: true, seg: [10], rng });
    q.forEach(x => { x.answer = (x.answer + 1) % 4; });
    const f = PS.fromTest(q), keys = PS.buildKeys(g, f.qs, 100), o = PS.orderOf(g, 'B', 10); let i = 0;
    for (let k = 0; k < 10; k++) { const x = q[o[k]]; if (x.qType === 'subjective') continue; const opts = PS.permuteOpts(x.options, PS.pOf(g, 'B', o[k])); assert.strictEqual(keys.B[i++], 'ABCD'[opts.indexOf(x.options[x.answer])]); }
  });
  T('extend 2->4 sets keeps B unchanged; shrink keeps prefix', () => {
    const rng = rngSeed(9), q = mkTest(rng, 15), { descs } = PS.fromTest(q);
    const g2 = PS.generate(descs, { n: 2, optShuffle: false, seg: [15], rng });
    const g4 = PS.generate(descs, { n: 4, optShuffle: false, seg: [15], rng, existing: g2 });
    assert.deepStrictEqual(g4.sets.B, g2.sets.B); assert(g4.sets.C && g4.sets.D);
    const g3 = PS.generate(descs, { n: 3, optShuffle: false, seg: [15], rng, existing: g4 });
    assert.deepStrictEqual(g3.sets.C, g4.sets.C); assert(!g3.sets.D);
  });

  // ---------- syncTestToExamManager (extracted from script.js) with a fake Firestore ----------
  const src = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
  const i0 = src.indexOf('async function syncTestToExamManager('), i1 = src.indexOf('async function syncOldTestsToExamManager');
  assert(i0 > 0 && i1 > i0);
  function runSync(existing, test, questions) {
    const store = { doc: existing ? JSON.parse(JSON.stringify(existing)) : null, sets: [], updates: [] };
    const DEL = { __del: true }, TS = { __ts: true };
    const col = { where() { return { limit() { return { get: async () => store.doc ? { empty: false, docs: [{ data: () => store.doc, ref: { update: async u => store.updates.push(u) } }] } : { empty: true, docs: [] } }; } }; },
      doc(id) { return { id: id || 'new1', set: async d => store.sets.push(d) }; } };
    const ctx = { window: { PaperSets: PS }, getDB: () => ({ collection: () => col }), getCurrentAdminInstituteId: () => 'inst1', console,
      firebase: { firestore: { FieldValue: { serverTimestamp: () => TS, delete: () => DEL } } }, EXAMGR_SYNC_COLLECTION: 'examManagerExams', EXAMGR_SYNC_MAX_QUESTIONS: 100, EXAMGR_SYNC_OPTION_LETTERS: ['A','B','C','D'], Date, Number, Array, Object, JSON };
    vm.createContext(ctx);
    vm.runInContext(src.slice(i0, i1) + '\nthis.__f = syncTestToExamManager;', ctx);
    return ctx.__f('t1', test, questions).then(() => { store.DEL = DEL; return store; });
  }
  const rng = rngSeed(21), Q = mkTest(rng, 14).map(x => ({ ...x, answer: x.answer })), { descs, qs } = PS.fromTest(Q);
  const g = PS.generate(descs, { n: 3, optShuffle: true, seg: [14], rng });
  const keys = PS.buildKeys(g, qs, 100);

  await TA('new exam from test with 3 sets: sets=3, answerKeys A,B,C from paper', async () => {
    const st = await runSync(null, { title: 'T', qSets: g, questions: Q }, Q);
    const d = st.sets[0]; assert.strictEqual(d.sets, 3); assert.strictEqual(JSON.stringify(d.answerKeys), JSON.stringify(keys)); assert.strictEqual(JSON.stringify(d.answerKey), JSON.stringify(keys.A));
    assert.strictEqual(d.paperSets.n, 3);
  });
  await TA('new exam, no qSets: old behaviour (sets 1, key A)', async () => {
    const st = await runSync(null, { title: 'T', questions: Q }, Q); const d = st.sets[0];
    assert.strictEqual(d.sets, 1); assert.strictEqual(JSON.stringify(d.answerKeys), JSON.stringify({ A: keys.A })); assert(!d.paperSets);
  });
  await TA('stale qSets (question removed): set keys NOT written, warning set, sets untouched', async () => {
    const Q2 = Q.slice(1);
    const st = await runSync({ sets: 3, answerKeys: { A: ['A'], B: ['B'], C: ['C'] }, paperSets: { n: 3 } }, { title: 'T', qSets: g, questions: Q2 }, Q2);
    const u = st.updates[0]; assert(!('answerKeys' in u) && !('sets' in u)); assert(/badal gaye/.test(u.setsWarning)); assert(Array.isArray(u['answerKeys.A']));
  });
  await TA('manual-edited set is NOT overwritten on re-sync; others are', async () => {
    const manualB = keys.B.map(() => 'D');
    const st = await runSync({ sets: 3, answerKeys: { A: keys.A, B: manualB, C: keys.C }, manualSets: { B: true } }, { title: 'T', qSets: g, questions: Q }, Q);
    const u = st.updates[0]; assert.strictEqual(JSON.stringify(u.answerKeys.B), JSON.stringify(manualB)); assert.strictEqual(JSON.stringify(u.answerKeys.C), JSON.stringify(keys.C)); assert.strictEqual(JSON.stringify(u.paperAnswerKeys.B), JSON.stringify(keys.B));
  });
  await TA('sets reduced 3 -> 1 in generator: exam goes back to 1 set, B/C keys dropped', async () => {
    const st = await runSync({ sets: 3, answerKeys: { A: keys.A, B: keys.B, C: keys.C }, paperSets: { n: 3 } }, { title: 'T', questions: Q }, Q);
    const u = st.updates[0]; assert.strictEqual(u.sets, 1); assert.strictEqual(Object.keys(u.answerKeys).join(), 'A');
  });
  await TA('exam with manual sets (no paper sets) is not shrunk by a plain re-sync', async () => {
    const st = await runSync({ sets: 4, answerKeys: { A: ['A'], B: ['B'], C: ['C'], D: ['D'] } }, { title: 'T', questions: Q }, Q);
    const u = st.updates[0]; assert(!('sets' in u) && !('answerKeys' in u)); assert.strictEqual(JSON.stringify(u['answerKeys.A']), JSON.stringify(keys.A));
  });

  // ---------- qgen-sets.js views: printed preview == key ----------
  const dom = { els: {} };
  const el = id => dom.els[id] || (dom.els[id] = { id, style: {}, value: '', innerHTML: '', textContent: '', insertAdjacentHTML() {} });
  const paper = [0,1,2,3,4,5,6,7].map(i => ({ id: i + 1, firestoreId: 'f' + i, text: 'Q' + i, opts: [0,1,2,3].map(j => `o${i}${j}`), ans: i % 4, qType: i === 3 ? 'subjective' : 'mcq' }));
  const g2 = { window: { PaperSets: PS }, document: { getElementById: el, readyState: 'complete', addEventListener() {} }, console, toast() {}, confirm: () => true,
    isSectionMode: () => false, getAllQuestionsFlat: () => paper, reRenderPaper() {}, Date, Math, JSON, Object, Array, String, Number };
  g2.window.window = g2.window; vm.createContext(g2);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'qgen-sets.js'), 'utf8'), g2);
  const QG = g2.window.QGSets;
  T('qgen-sets: view of Set B has mapped answers matching key; persisted payload validates against firestoreIds', () => {
    QG.setOptShuffle(true); QG.setCount(3); QG.ensure(); QG.setActive(1);
    const view = QG.flat(), qsA = paper.map(p => ({ mcq: p.qType !== 'subjective', ans: p.ans }));
    const key = PS.answerKey(QG.state().def, 'B', qsA, 100); let i = 0;
    view.forEach(v => { if (v.qType === 'subjective') return; assert.strictEqual('ABCD'[v.ans], key[i++]); const orig = v._origQ || v; assert.strictEqual(v.opts[v.ans], orig.opts[orig.ans]); });
    const pay = QG.savePayload(false).qSets; assert(pay && pay.n === 3);
    assert.strictEqual(JSON.stringify(pay.qids), JSON.stringify(paper.map(p => p.firestoreId)));
    assert(PS.validate(pay, PS.fromTest(paper.map(p => ({ id: p.firestoreId, qType: p.qType, options: p.opts, answer: p.ans }))).descs).ok);
    QG.setActive(0); assert.strictEqual(QG.flat()[0], paper[0]);
  });
  T('qgen-sets: paper change regenerates sets (never stale); restore rejects mismatching saved sets', () => {
    const saved = QG.savePayload(false).qSets; paper.push({ id: 99, firestoreId: 'f99', text: 'new', opts: ['a','b','c','d'], ans: 1, qType: 'mcq' });
    QG.ensure(); const now = QG.state().def; assert.strictEqual(now.qids.length, paper.length);
    QG.restore(saved); assert.strictEqual(QG.state().n, 1);
    paper.pop(); QG.restore(saved); assert.strictEqual(QG.state().n, 3);
  });

  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
