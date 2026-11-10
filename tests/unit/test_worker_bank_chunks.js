// Chunked question-bank endpoint smoke test using the in-memory KV contract.
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const kv = new Map([
  ['bank_meta', JSON.stringify({ exists: true, updatedAt: 7, count: 2, groups: [{ classId: 'class_10', subject: 'Mathematics', count: 2, key: 'bank_chunk:7:class_10:Mathematics' }] })],
  ['bank_chunk:7:class_10:Mathematics', JSON.stringify([{ id: 'q1', classId: 'class_10', subject: 'Mathematics' }, { id: 'q2', classId: 'class_10', subject: 'Mathematics' }])],
  ['bank', JSON.stringify([{ id: 'q1' }, { id: 'q2' }])]
]);
const BANK_KV = { async get(key, options) { const value = kv.get(key); if (value == null) return null; return options && options.type === 'stream' ? new Blob([value]).stream() : value; } };
(async () => {
  const tmp = path.join(os.tmpdir(), 'worker_bank_chunks.mjs');
  fs.copyFileSync(path.join(__dirname, '..', '..', 'push-worker', 'worker.js'), tmp);
  const W = (await import('file://' + tmp + '?v=' + Date.now())).default, env = { BANK_KV };
  const call = (url) => W.fetch(new Request('https://w.test' + url), env, { waitUntil() {} });
  let passed = 0;
  const t = async (name, run) => { await run(); passed++; console.log('  PASS ' + name); };
  await t('published subject chunk returns the original question objects', async () => {
    const r = await call('/bank/chunk?classId=class_10&subject=Mathematics');
    assert.strictEqual(r.status, 200); assert.deepStrictEqual(await r.json(), [{ id: 'q1', classId: 'class_10', subject: 'Mathematics' }, { id: 'q2', classId: 'class_10', subject: 'Mathematics' }]);
  });
  await t('unknown chunk returns 404 and malformed class IDs return 400', async () => {
    assert.strictEqual((await call('/bank/chunk?classId=class_11&subject=Mathematics')).status, 404);
    assert.strictEqual((await call('/bank/chunk?classId=../x&subject=Mathematics')).status, 400);
  });
  await t('legacy full-bank endpoint remains compatible', async () => {
    const r = await call('/bank'); assert.strictEqual(r.status, 200); assert.strictEqual((await r.json()).length, 2);
  });
  console.log('\n' + passed + ' passed'); fs.unlinkSync(tmp);
})().catch((e) => { console.error(e); process.exitCode = 1; });
