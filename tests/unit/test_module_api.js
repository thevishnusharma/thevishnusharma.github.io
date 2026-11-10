const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const calls = [];
global.window = {
  getAuth: () => ({ currentUser: { uid: 'admin-1' } }),
  loginStudent: (name) => { calls.push(['loginStudent', name]); return 'signed-in'; },
  registerStudent: () => 'registered',
  loginAdmin: () => 'admin',
  logoutStudent: () => 'student-out',
  logoutAdmin: () => 'admin-out',
  syncTests: () => 'synced',
  renderTests: () => 'rendered',
  startTest: () => 'started',
  saveTest: () => 'saved',
  showResult: () => 'result',
  renderStudentResultSheet: () => 'sheet',
  questionBank: [{ id: 'q1' }],
  syncBank: () => 'bank-synced',
  renderBank: () => 'bank-rendered',
  showAdminTab: () => 'tab',
  enterAdminPanel: () => 'entered',
  getCurrentAdminInstituteId: () => 'inst-1',
  getStudentSession: () => ({ mobile: '1234567890' }),
  goStudentSection: () => 'section',
  SavyaExtras: { ready: true },
  SubjectResolver: { ready: true },
  SnapSafeHtml: { ready: true },
  __bankIdb: { ready: true }
};

(async () => {
  const url = pathToFileURL(path.join(__dirname, '..', '..', 'modules', 'legacy-modules.mjs')).href;
  const api = await import(url + '?test=' + Date.now());
  const chunks = { loadAll: () => 'all' };
  const modules = api.createLegacyModules(chunks);
  assert.deepStrictEqual(Object.keys(modules), ['auth', 'tests', 'results', 'bank', 'omr', 'admin', 'student', 'utils']);
  assert.strictEqual(modules.auth.currentUser.uid, 'admin-1');
  assert.strictEqual(modules.auth.loginStudent('Riya'), 'signed-in');
  assert.deepStrictEqual(calls, [['loginStudent', 'Riya']]);
  assert.strictEqual(modules.tests.sync(), 'synced');
  assert.strictEqual(modules.results.show(), 'result');
  assert.strictEqual(modules.bank.chunks, chunks);
  assert.strictEqual(modules.bank.questions[0].id, 'q1');
  window.questionBank = [{ id: 'q2' }];
  assert.strictEqual(modules.bank.questions[0].id, 'q2', 'question-bank getter remains live');
  assert.strictEqual(modules.student.session.mobile, '1234567890');
  assert.strictEqual(modules.utils.subjectResolver.ready, true);
  console.log('PASS module API: named domain facades and classic-global compatibility shims');
})().catch((error) => { console.error(error); process.exitCode = 1; });
