const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..', '..');
const manifest = {
  schemaVersion: 1,
  count: 3,
  groups: [
    { classId: 'class_10', subject: 'Mathematics', count: 2, url: '/math.json' },
    { classId: 'class_10', subject: 'Biology', count: 1, url: '/biology.json' },
    { classId: 'class_11', subject: 'Mathematics', count: 1, url: '/class-11.json' }
  ]
};
const files = {
  '/question-bank/manifest.json': manifest,
  '/math.json': [
    { id: 'm1', classId: 'class_10', subject: 'Mathematics' },
    { id: 'm2', classId: 'class_10', subject: 'Mathematics' }
  ],
  '/biology.json': [{ id: 'b1', classId: 'class_10', subject: 'Biology' }],
  '/class-11.json': [{ id: 'm3', classId: 'class_11', subject: 'Mathematics' }]
};

let activeClass = 'class_10';
let weakPracticeQuestionCount = 0;
const window = {
  SNAP_CONFIG: { workerUrl: '' },
  __bankIdb: { get: async () => null, put: async () => true, delete: async () => true },
  SavyaExtras: {
    syncPracticeFilters() {},
    startWeakChapterPractice() { weakPracticeQuestionCount = window.questionBank.length; }
  },
  getAuth: () => ({ currentUser: null }),
  getStudentSession: () => ({ classId: activeClass }),
  __setQuestionBankForChunks(rows) { window.questionBank = rows; return rows; }
};
const document = { addEventListener() {} };
global.window = window;
global.document = document;
global.localStorage = { removeItem() {} };
global.fetch = async (url) => ({ ok: !!files[url], status: files[url] ? 200 : 404, json: async () => files[url] });
global.alert = () => {};

(async () => {
  const moduleUrl = pathToFileURL(path.join(root, 'modules', 'bank-chunks.mjs')).href + '?v=' + Date.now();
  const loader = await import(moduleUrl);
  const math = await loader.loadSubject('Mathematics');
  assert.strictEqual(Array.from(math, (q) => q.id).join(','), 'm1,m2');
  assert.ok(Array.from(math).every((q) => q.classId === 'class_10'));

  await window.SavyaExtras.startWeakChapterPractice(['Chapter 1'], 15);
  assert.strictEqual(weakPracticeQuestionCount, 3, 'weak-topic flow loads all subjects for the active class');
  assert.ok(window.questionBank.every((q) => q.classId === 'class_10'), 'no other-class rows are loaded');

  activeClass = 'class_11';
  const class11 = await loader.loadAll();
  assert.strictEqual(Array.from(class11, (q) => q.id).join(','), 'm3');
  activeClass = 'class_12';
  await assert.rejects(loader.loadAll(), /Is class ke liye question bank nahi mila/);
  console.log('PASS bank module: import/exports, subject/class scope, weak-topic loading, and missing-class isolation');
})().catch((error) => { console.error(error); process.exitCode = 1; });
