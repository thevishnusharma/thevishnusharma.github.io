// Firestore read-budget guards (v227): keeps the expensive startup patterns from coming back.
const fs = require('fs'), path = require('path'), assert = require('assert');
const R = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const script = R('script.js'), sf = R('student-features.js'), cfg = R('app-config.js');
let pass = 0; const T = (n, f) => { try { f(); pass++; console.log('  PASS ' + n); } catch (e) { console.log('  FAIL ' + n + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
T('admin leaderboard uses the delta cache, not a 3000-doc read per render', () => {
  assert.ok(!/adm\?\(await n\.collection\("studentRecords"\)\.orderBy\("savedAt","desc"\)\.limit\(ye\)/.test(sf));
  assert.ok(sf.includes('t=await _lbStudent(n)'));
});
T('bank auto-fix (class tag / chapter merge / id migration) is opt-in', () => {
  assert.ok(/bankAutoFix:\s*false/.test(cfg));
  assert.ok(script.includes('function scheduleAutoChapterMerge(){if(!_isAdminUserNow())return;if(!window.__bankAutoFixNow&&!(window.SNAP_CONFIG&&window.SNAP_CONFIG.bankAutoFix===!0))return;'));
  assert.ok(script.includes('function scheduleAutoClassIdMigration(){if(!_isAdminUserNow())return;if(!window.__bankAutoFixNow'));
});
T('restoring the last admin view does not trigger full scans', () => {
  assert.ok(script.includes('window.__restoringView=!0'));
  assert.ok(script.includes('const _rs=!!window.__restoringView'));
  assert.ok(/async function loadFakeMobileGroups\(\)\{const e=\$\("#fixmobile-list"\);if\(!e\)return;if\(window\.__restoringView\|\|!window\.__fmGo\)/.test(script));   // v240: restore par bhi, aur bina button dabaye bhi scan nahi
});
T('students directory record counts are cached', () => { assert.ok(script.includes('snap_srcount_v1_') && script.includes('__srCountStale')); });
T('v240: students list 5 minute cache + fixmobile scan button se', () => { assert.ok(script.includes('snap_stu_ts_') && script.includes('<3e5') && script.includes('window.__fmGo=1;window.loadFakeMobileGroups()')); });
T('unbounded listeners are capped', () => {
  assert.ok(script.includes('orderBy("_deletedAt","desc").limit(100).onSnapshot('));
  assert.ok(script.includes('collection("pdfDrafts").limit(150).onSnapshot('));
});
T('admin startup does not load OMR exam list', () => {
  const i = script.indexOf('function startAdminSyncs()'); const seg = script.slice(i, i + 1800);
  assert.ok(!seg.includes('loadExamManagerExams'));
});
console.log(pass + ' passed');
