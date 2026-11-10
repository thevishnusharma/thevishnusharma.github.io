// Question Report (v214): client, firestore.rules, index.html and sw.js must agree with each other.
const assert = require('assert'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..');
const rd = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const js = rd('question-report.js'), rulesMain = rd('firestore.rules'),
  // rules block lives in firestore.rules once pasted there; otherwise the shipped snippet is the source of truth
  rules = rulesMain.includes('match /questionReports/{rid}') ? rulesMain : rd('docs/setup/FIRESTORE_RULES_questionReports_v214.txt') + '\n    }\n', html = rd('index.html'), sw = rd('sw.js');
let pass = 0; const T = (n, f) => { try { f(); pass++; console.log('  PASS ' + n); } catch (e) { console.log('  FAIL ' + n + '\n   ' + (e.stack || e)); process.exitCode = 1; } };

const block = (() => { const i = rules.indexOf('match /questionReports/{rid}'); assert.ok(i > 0, 'rules block exists'); return rules.slice(i, rules.indexOf('\n    }\n', i)); })();
T('rules: create whitelist keys == keys the student client writes', () => {
  const ruleKeys = /hasOnly\(\[([^\]]+)\]\)/.exec(block)[1].match(/'(\w+)'/g).map((s) => s.replace(/'/g, '')).sort();
  const setCall = js.slice(js.indexOf('c.doc(id).set({'), js.indexOf('}).then(function () {'));
  const clientKeys = [...setCall.matchAll(/(\w+):/g)].map((m) => m[1]).filter((k) => k !== 'set').sort();
  assert.deepStrictEqual(clientKeys, ruleKeys);
});
T('rules: admin read/update/delete are institute-scoped; student cannot read/update/delete', () => {
  assert.ok(/allow read: if isAdmin\(\) && resource\.data\.instituteId in \[adminInstituteId\(\), ''\]/.test(block));
  assert.ok(/allow update: if isAdmin\(\)/.test(block) && /hasOnly\(\['status', 'resolvedAt'\]\)/.test(block));
  assert.ok(/allow delete: if isAdmin\(\)/.test(block));
  assert.ok(!/allow (read|get|list|update|delete)[^:]*: if isSignedIn\(\)/.test(block));
});
T('rules: create requires status open, server timestamp, message >= 5 chars', () => {
  assert.ok(/status == 'open'/.test(block) && /createdAt == request\.time/.test(block) && /message\.size\(\) >= 5/.test(block));
});
T('client: admin query matches the rule (instituteId in [mine, ""])', () => {
  assert.ok(/where\("instituteId", "in", instKeys\(\)\)/.test(js) && /\? \[i, ""\] : \[""\]/.test(js));
});
T('client: message is mandatory (>=5) and uses textContent (no innerHTML of user data)', () => {
  assert.ok(/msg\.length < 5/.test(js));
  const inner = js.match(/innerHTML\s*=/g) || []; assert.strictEqual(inner.length, 1, 'only the static admin card uses innerHTML');
});
T('index.html loads question-report.js and service worker precaches it', () => {
  assert.ok(/<script defer src="question-report\.js/.test(html)); assert.ok(sw.includes('/question-report.js'));
});
T('client: doc id is one-per-student-per-question', () => { assert.ok(/ctx\.testId \+ "_" \+ ctx\.qIndex \+ "_" \+ me\.mobile/.test(js)); });
console.log(pass + ' passed');
