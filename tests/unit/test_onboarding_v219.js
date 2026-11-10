/* v219 Phase 3A: wizard ka data + Drive status (token save nahi, email check, gating default OFF) */
const assert = require('assert'), path = require('path'), fs = require('fs');
global.window = { SNAP_CONFIG: { plans: { Free: { studentLimit: 30, storageLimitMB: 500 }, Pro: { studentLimit: 500, storageLimitMB: 10000 }, Custom: {} }, googleClientId: '' } };
global.document = { createElement() { return {}; } }; global.navigator = { onLine: true };
require(path.join('..', '..', 'owner-wizard.js'));
const W = window.__ownerWizardTest;

/* validation */
W.set({}); assert(/naam/i.test(W.check(0)));
W.set({ name: 'A', owner: 'B', classes: [] }); assert(/Class/.test(W.check(0)));
W.set({ name: 'A', owner: 'B', classes: ['class_10'] }); assert.strictEqual(W.check(0), '');
W.set({ color: 'red' }); assert(W.check(1));
W.set({ tagline: 'x'.repeat(61) }); assert(W.check(1));
W.set({ yt: 'http://youtube.com/x' }); assert(W.check(3));
W.set({ yt: 'https://evil.example.com/x' }); assert(W.check(3));
W.set({ yt: '' }); assert.strictEqual(W.check(3), '');
W.set({ yt: 'https://www.youtube.com/@abc' }); assert.strictEqual(W.check(3), '');
W.set({ slim: -1 }); assert(W.check(2));

/* institute doc: sirf maujooda fields, billing/token kuch nahi, optional fields tabhi jab bhare */
W.set({ name: ' Savya ', owner: ' V ', classes: ['class_9', 'class_10'], plan: 'Pro', slim: 500, lim: 10000, color: '#112233' });
let d = W.buildDoc();
assert.deepStrictEqual(Object.keys(d).sort(), ['active', 'allowedClasses', 'brandColor', 'name', 'ownerName', 'plan', 'storageLimitMB', 'studentLimit']);
assert.strictEqual(d.name, 'Savya'); assert.strictEqual(d.studentLimit, 500); assert.strictEqual(d.active, true);
W.set({ name: 'S', owner: 'O', tagline: ' T ', yt: 'https://youtube.com/@x', logo: 'data:image/png;base64,AA' });
d = W.buildDoc(); assert.strictEqual(d.tagline, 'T'); assert.strictEqual(d.youtubeChannelUrl, 'https://youtube.com/@x'); assert(d.logoDataUrl);
assert(!/token|driveConnected|invoice|price|bill/i.test(JSON.stringify(Object.keys(d))), 'wizard Drive/billing field nahi likhta');

/* SnapDrive status */
const sets = [];
window.vishnuFirebase = { enabled: true, db: { collection: () => ({ doc: (id) => ({
  get: async () => ({ exists: true, data: () => ({ driveConnected: id === 'ok', driveEmail: id === 'ok' ? 'a@b.co' : '' , storageFiles: 3, storageUsedBytes: 5242880 }) }),
  update: async (x) => { sets.push([id, x]); } }) }) } };
require(path.join('..', '..', 'drive-upload.js'));
const D = window.SnapDrive;
(async () => {
  let s = await D.status('ok'); assert.strictEqual(s.connected, true); assert.strictEqual(s.email, 'a@b.co'); assert.strictEqual(s.files, 3); assert.strictEqual(s.usedMB, 5);
  s = await D.status('no'); assert.strictEqual(s.connected, false);
  /* gating: default OFF (driveRequired undefined) -> kabhi block nahi */
  assert.strictEqual(D.blocked('no'), false);
  window.SNAP_CONFIG.driveRequired = true; assert.strictEqual(D.blocked('no'), false, 'googleClientId khaali -> block nahi');
  window.SNAP_CONFIG.googleClientId = 'x.apps.googleusercontent.com';
  assert.strictEqual(D.blocked('no'), true); assert.strictEqual(D.blocked('ok'), false); assert.strictEqual(D.blocked('never-checked'), false, 'status pata nahi -> block nahi');
  /* disconnect: sirf status likhta hai, email khaali */
  await D.disconnect('ok'); const last = sets[sets.length - 1]; assert.deepStrictEqual(Object.keys(last[1]).sort(), ['driveConnected', 'driveEmail']); assert.strictEqual(last[1].driveConnected, false); assert.strictEqual(last[1].driveEmail, '');
  /* email format */
  assert(D._t.MAIL.test('a@b.co')); assert(!D._t.MAIL.test('nope')); assert(!D._t.MAIL.test('a b@c.d'));
  /* token kahin save nahi: source me localStorage/sessionStorage/firestore token field nahi */
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'drive-upload.js'), 'utf8'); assert(!/localStorage|sessionStorage/.test(src));
  console.log('onboarding v219 OK');
})().catch((e) => { console.error(e); process.exit(1); });
