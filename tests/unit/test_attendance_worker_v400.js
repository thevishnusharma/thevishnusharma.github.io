// v400 — Smart Attendance (GPS + dynamic QR + manual): Worker end-to-end test on a mock Firestore.
// Run: node tests/unit/test_attendance_worker_v400.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert'), crypto = require('crypto');
const SAkey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = { project_id: 'demo-test', client_email: 'sa@demo-test.iam.gserviceaccount.com', private_key: SAkey.privateKey.export({ type: 'pkcs8', format: 'pem' }) };
const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), fbJwk = { ...fb.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const b64u = (b) => Buffer.from(b).toString('base64url');
function idToken(claims) {
  const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' })), now = Math.floor(Date.now() / 1000);
  const p = b64u(JSON.stringify({ aud: 'demo-test', iss: 'https://securetoken.google.com/demo-test', iat: now - 5, exp: now + 3000, ...claims }));
  return h + '.' + p + '.' + b64u(crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), fb.privateKey));
}
/* ---- mock Firestore (raw REST value maps) ---- */
const store = new Map();   // path -> fields
const wrap = (v) => { if (v === null) return { nullValue: null }; if (typeof v === 'boolean') return { booleanValue: v }; if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }; if (typeof v === 'string') return { stringValue: v }; if (Array.isArray(v)) return { arrayValue: { values: v.map(wrap) } }; const f = {}; Object.keys(v).forEach((k) => { f[k] = wrap(v[k]); }); return { mapValue: { fields: f } }; };
const wrapObj = (o) => wrap(o).mapValue.fields;
function unwrap(v) { if ('stringValue' in v) return v.stringValue; if ('integerValue' in v) return Number(v.integerValue); if ('doubleValue' in v) return v.doubleValue; if ('booleanValue' in v) return v.booleanValue; if ('timestampValue' in v) return v.timestampValue; if ('arrayValue' in v) return (v.arrayValue.values || []).map(unwrap); if ('mapValue' in v) { const o = {}; Object.keys(v.mapValue.fields || {}).forEach((k) => { o[k] = unwrap(v.mapValue.fields[k]); }); return o; } return null; }
const un = (f) => { const o = {}; Object.keys(f || {}).forEach((k) => { o[k] = unwrap(f[k]); }); return o; };
const seed = (p, o) => store.set(p, wrapObj(o));
const getDoc = (p) => (store.has(p) ? un(store.get(p)) : null);
const segs = (mask) => { const out = []; let cur = '', bt = false; for (const ch of mask) { if (ch === '`') bt = !bt; else if (ch === '.' && !bt) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
function applyWrite(w) {
  const name = (w.update || {}).name || w.delete, p = name.slice(name.indexOf('/documents/') + 11), cur = store.get(p);
  if (w.delete) { store.delete(p); return; }
  if (w.currentDocument && w.currentDocument.exists === false && cur) { const e = new Error('exists'); e.already = true; throw e; }
  if (w.currentDocument && w.currentDocument.exists === true && !cur) { const e = new Error('missing'); e.missing = true; throw e; }
  if (!w.updateMask) { store.set(p, JSON.parse(JSON.stringify(w.update.fields))); return; }
  const doc = cur ? JSON.parse(JSON.stringify(cur)) : {};
  for (const mp of w.updateMask.fieldPaths) {
    const sg = segs(mp); let src = w.update.fields, ok = true;
    for (let i = 0; i < sg.length; i++) { const n = src && src[sg[i]]; if (!n) { ok = false; break; } src = i === sg.length - 1 ? n : (n.mapValue || {}).fields; }
    let dst = doc;
    for (let i = 0; i < sg.length - 1; i++) { dst[sg[i]] = dst[sg[i]] || { mapValue: { fields: {} } }; dst[sg[i]].mapValue.fields = dst[sg[i]].mapValue.fields || {}; dst = dst[sg[i]].mapValue.fields; }
    if (ok) dst[sg[sg.length - 1]] = src; else delete dst[sg[sg.length - 1]];
  }
  store.set(p, doc);
}
let commits = 0;
global.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.includes('service_accounts/v1/jwk')) return new Response(JSON.stringify({ keys: [fbJwk] }));
  if (url.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }));
  if (url.startsWith('https://notify.test/')) { return new Response('{}'); }
  const i = url.indexOf('/documents'); if (i < 0) throw new Error('unexpected fetch ' + url);
  const rest = decodeURIComponent(url.slice(i + 10)).replace(/^\//, '');
  const body = init.body ? JSON.parse(init.body) : null;
  if (rest === ':batchGet') {
    return new Response(JSON.stringify(body.documents.map((n) => { const p = n.slice(n.indexOf('/documents/') + 11); return store.has(p) ? { found: { name: n, fields: store.get(p) } } : { missing: n }; })));
  }
  if (rest === ':commit') {
    const snap = new Map(store);
    try { body.writes.forEach(applyWrite); commits++; return new Response('{}'); }
    catch (e) { store.clear(); snap.forEach((v, k) => store.set(k, v)); return new Response(JSON.stringify({ error: { status: e.already ? 'ALREADY_EXISTS' : 'NOT_FOUND' } }), { status: e.already ? 409 : 404 }); }
  }
  if (rest.endsWith(':runQuery')) {
    const parent = rest.slice(0, -9), q = body.structuredQuery, cid = q.from[0].collectionId, f = q.where && q.where.fieldFilter;
    const out = [];
    for (const [p, fields] of store) {
      if (!p.startsWith(parent + '/' + cid + '/') || p.slice((parent + '/' + cid + '/').length).includes('/')) continue;
      if (f && unwrap(fields[f.field.fieldPath] || { nullValue: null }) !== unwrap(f.value)) continue;
      out.push({ document: { name: 'projects/demo-test/databases/(default)/documents/' + p, fields } });
    }
    return new Response(JSON.stringify(out.length ? out.slice(0, q.limit) : [{}]));
  }
  if (!init.method || init.method === 'GET') { const d = store.get(rest.split('?')[0]); return d ? new Response(JSON.stringify({ fields: d })) : new Response('{}', { status: 404 }); }
  throw new Error('unhandled ' + init.method + ' ' + url);
};
(async () => {
  const tmp = path.join(os.tmpdir(), 'worker_att_under_test.mjs');
  fs.copyFileSync(path.join(__dirname, '..', '..', 'push-worker', 'worker.js'), tmp);
  const W = (await import('file://' + tmp + '?v=' + Date.now())).default;
  const env = { SERVICE_ACCOUNT_JSON: JSON.stringify(SA), ATT_NOTIFY_URL: 'https://notify.test/hook' };
  const I = 'inst1', B = 'b1', SID = 'cls1';
  const admin = idToken({ sub: 'a1', email: 'admin@x.in' }), other = idToken({ sub: 'a2', email: 'admin2@x.in' });
  const stu = (m) => idToken({ sub: 's_' + m, role: 'student', mobile: m });
  const call = async (op, body, tok) => { const r = await W.fetch(new Request('https://w.test/attendance/' + op, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) }), env, { waitUntil() {} }); return { status: r.status, ...(await r.json()) }; };
  seed('admins/admin@x.in', { instituteId: I, active: true }); seed('admins/admin2@x.in', { instituteId: 'inst2', active: true });
  seed('institutes/' + I + '/batches/' + B, { name: 'Class 9 B', instituteId: I });
  const mobiles = ['9000000001', '9000000002', '9000000003', '9000000004', '9000000005'];
  mobiles.forEach((m, k) => { seed('students/' + m, { instituteId: I, name: 'Student ' + (k + 1) }); seed('institutes/' + I + '/batches/' + B + '/members/' + m, { name: 'Student ' + (k + 1) }); });
  seed('students/9111111111', { instituteId: I, name: 'Outsider' });   // not in batch
  const now = Date.now(), date = new Date(now + 5.5 * 3600e3).toISOString().slice(0, 10);
  const sess = { batchId: B, sessionId: SID, date, startMs: now - 60000, endMs: now + 3600e3, title: 'Science', subject: 'Science', teacher: 'Verma', period: '3' };

  /* settings validation + save */
  let r = await call('settings', { settings: { geoEnabled: true, lat: 25.5941, lng: 85.1376, radiusM: 5, maxAccM: 50, locPolicy: 'pending', qrRotateSec: 30, qrValiditySec: 30, qrGraceSec: 10, startTime: '00:00', endTime: '23:59', lateMin: 10, pendingPolicy: 'review' } }, admin);
  assert.strictEqual(r.status, 400, 'radius 5 must be rejected: ' + JSON.stringify(r));
  const goodSettings = { geoEnabled: true, retry: true, lat: 25.5941, lng: 85.1376, radiusM: 150, maxAccM: 50, locPolicy: 'pending', qrEnabled: true, qrRotateSec: 30, qrValiditySec: 30, qrGraceSec: 10, startTime: '00:00', endTime: '23:59', lateMin: 10, manualEnabled: true, teacherCorrection: true, pendingPolicy: 'review', notify: { enabled: true, present: false, absent: true, late: false } };
  r = await call('settings', { settings: goodSettings }, admin); assert.ok(r.ok && r.settings.radiusM === 150, JSON.stringify(r));
  r = await call('settings', { settings: goodSettings }, 'bad.token.x'); assert.ok(r.status === 401 || r.status === 500, 'bad token rejected');
  r = await call('settings', { settings: goodSettings }, stu('9000000001')); assert.ok(r.status >= 401, 'student cannot save settings: ' + r.status);

  /* start session: auth + isolation + conflicts */
  r = await call('start', sess, other); assert.strictEqual(r.status, 404, 'other institute admin cannot start: ' + JSON.stringify(r));
  r = await call('start', sess, admin); assert.ok(r.ok && r.token && r.token.startsWith('SA1.'), JSON.stringify(r));
  const tok1 = r.token;
  assert.ok(tok1.length < 60, 'token short for easy QR: ' + tok1.length);
  assert.strictEqual(getDoc('institutes/inst1/batches/b1/attendanceLive/cls1').status, 'active');
  r = await call('start', sess, admin); assert.ok(r.ok && r.resumed, 'resume same session');
  r = await call('start', { ...sess, sessionId: 'cls2', period: '3' }, admin); assert.strictEqual(r.status, 409, 'conflict on same period');
  r = await call('token', { batchId: B, sessionId: SID }, admin); assert.ok(r.ok && r.token !== tok1, 'token rotates'); const tok2 = r.token;

  /* student verify */
  const goodLoc = () => ({ lat: 25.5942, lng: 85.1377, accuracy: 12, locTs: Date.now() });
  r = await call('verify', { batchId: B, sessionId: SID, token: tok2, ...goodLoc() }, stu('9000000001'));
  assert.ok(r.ok && r.status === 'present', JSON.stringify(r));
  const rec1 = getDoc('institutes/inst1/batches/b1/attendanceRecords/cls1_9000000001');
  assert.strictEqual(rec1.method, 'gps_qr'); assert.ok(!('lat' in rec1), 'raw coordinates are not stored');
  assert.strictEqual(getDoc('institutes/inst1/batches/b1/attendanceStudents/9000000001_' + date.slice(0, 7).replace('-', '')).days.cls1.s, 'P', 'legacy student month doc updated');
  r = await call('verify', { batchId: B, sessionId: SID, token: tok2, ...goodLoc() }, stu('9000000001')); assert.ok(r.ok && r.already, 'duplicate is idempotent');
  r = await call('verify', { batchId: B, sessionId: SID, token: tok2, ...goodLoc() }, stu('9111111111')); assert.strictEqual(r.status, 403, 'non-member rejected');
  r = await call('verify', { batchId: B, sessionId: SID, token: 'SA1.zzzz.abcdef.AAAAAAAAAAAAAAAAAAAAAA', ...goodLoc() }, stu('9000000002')); assert.strictEqual(r.code, 'qr_invalid', JSON.stringify(r));
  r = await call('verify', { batchId: B, sessionId: SID, token: tok2.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), ...goodLoc() }, stu('9000000002')); assert.strictEqual(r.code, 'qr_invalid', 'tampered signature');
  assert.ok(!getDoc('institutes/inst1/batches/b1/attendanceRecords/cls1_9000000002'), 'invalid QR creates no record');
  r = await call('verify', { batchId: B, sessionId: 'other', token: tok2, ...goodLoc() }, stu('9000000002')); assert.ok(r.status === 404, 'unknown session');
  /* outside / bad accuracy / stale / no gps */
  r = await call('verify', { batchId: B, sessionId: SID, token: tok2, lat: 25.7, lng: 85.3, accuracy: 10, locTs: Date.now() }, stu('9000000002'));
  assert.ok(r.ok && r.status === 'pending' && r.reason === 'outside' && r.distanceM > 150, JSON.stringify(r));
  r = await call('verify', { batchId: B, sessionId: SID, token: tok2, lat: 25.5942, lng: 85.1377, accuracy: 120, locTs: Date.now() }, stu('9000000003'));
  assert.ok(r.status === 'pending' && r.reason === 'gps_accuracy', JSON.stringify(r));
  r = await call('verify', { batchId: B, sessionId: SID, token: tok2, gpsDenied: true }, stu('9000000004'));
  assert.ok(r.status === 'pending' && r.reason === 'gps_denied', JSON.stringify(r));
  r = await call('pending', { batchId: B, sessionId: SID, reason: 'camera' }, stu('9000000005')); assert.ok(r.ok && r.status === 'pending' && r.reason === 'camera', JSON.stringify(r));
  /* pending student retries successfully (upgrade pending->present) */
  r = await call('verify', { batchId: B, sessionId: SID, token: tok2, ...goodLoc() }, stu('9000000003')); assert.ok(r.status === 'present', 'retry after pending: ' + JSON.stringify(r));
  /* expired token (clock moved 2 minutes ahead) */
  const realNow = Date.now; Date.now = () => realNow() + 120000;
  r = await call('verify', { batchId: B, sessionId: SID, token: tok2, lat: 25.5942, lng: 85.1377, accuracy: 10, locTs: Date.now() }, stu('9000000004'));
  Date.now = realNow; assert.strictEqual(r.code, 'qr_expired', JSON.stringify(r));
  /* grace: token 35s old still valid (validity 30 + grace 10) */
  Date.now = () => realNow() + 35000;
  r = await call('verify', { batchId: B, sessionId: SID, token: tok2, lat: 25.5942, lng: 85.1377, accuracy: 10, locTs: Date.now() }, stu('9000000004'));
  Date.now = realNow; assert.ok(r.ok && r.status === 'present', 'grace period accepted: ' + JSON.stringify(r));

  /* manual + correction + audit */
  r = await call('manual', { batchId: B, session: sess, changes: [{ mobile: '9000000001', status: 'absent' }] }, admin);
  assert.strictEqual(r.saved, 0); assert.ok(r.skipped.length === 1, 'correction without reason is refused');
  r = await call('manual', { batchId: B, session: sess, changes: [{ mobile: '9000000001', status: 'absent', reason: 'Wrong student scanned' }, { mobile: '9999999999', status: 'present' }] }, admin);
  assert.strictEqual(r.saved, 1); assert.strictEqual(r.skipped.length, 1);
  assert.strictEqual(getDoc('institutes/inst1/batches/b1/attendanceRecords/cls1_9000000001').method, 'admin_correction');
  const audits = [...store.keys()].filter((k) => k.startsWith('institutes/inst1/attendanceAudit/')).map((k) => getDoc(k));
  assert.ok(audits.some((a) => a.action === 'attendance.correction' && a.prevStatus === 'present' && a.newStatus === 'absent' && a.reason === 'Wrong student scanned'), 'audit entry written');
  r = await call('manual', { batchId: B, session: sess, changes: [{ mobile: '9000000001', status: 'present', reason: 'Correct again' }] }, other); assert.ok(r.status === 404 || r.status === 403, 'other institute blocked: ' + r.status);

  /* review pending */
  r = await call('review', { batchId: B, sessionId: SID, mobile: '9000000002', action: 'late', note: 'Gate par dekha' }, admin); assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(getDoc('institutes/inst1/batches/b1/attendanceRecords/cls1_9000000002').status, 'late');
  r = await call('review', { batchId: B, sessionId: SID, mobile: '9000000002', action: 'absent' }, admin); assert.strictEqual(r.status, 409, 'only pending can be reviewed');
  r = await call('review', { batchId: B, sessionId: SID, mobile: '9000000005', action: 'retry' }, admin); assert.ok(r.ok);
  assert.ok(!getDoc('institutes/inst1/batches/b1/attendanceRecords/cls1_9000000005'), 'retry deletes the pending record');

  /* end session: QR stops */
  r = await call('end', { batchId: B, sessionId: SID }, admin); assert.ok(r.ok && r.counts.present >= 2, JSON.stringify(r));
  r = await call('token', { batchId: B, sessionId: SID }, admin); assert.strictEqual(r.status, 409, 'no tokens after end');
  r = await call('verify', { batchId: B, sessionId: SID, token: tok2, ...goodLoc() }, stu('9000000005')); assert.strictEqual(r.status, 409, 'cannot scan after end');

  /* finalize: pending guard, absents, legacy marks, notifications (deduped) */
  seed('institutes/inst1/batches/b1/attendanceRecords/cls1_9000000005', { mobile: '9000000005', name: 'Student 5', sessionId: SID, batchId: B, instituteId: I, date, status: 'pending', method: 'gps_qr' });
  r = await call('finalize', { batchId: B, sessionId: SID }, admin); assert.strictEqual(r.status, 409); assert.strictEqual(r.pending, 1);
  r = await call('finalize', { batchId: B, sessionId: SID, force: true }, admin); assert.ok(r.ok, JSON.stringify(r));
  const fin = getDoc('institutes/inst1/batches/b1/attendanceSessions/cls1');
  assert.strictEqual(fin.status, 'submitted'); assert.ok(fin.marks['9000000001'] === 'A' && fin.marks['9000000002'] === 'L' && fin.marks['9000000003'] === 'P');
  assert.ok(!('9000000005' in fin.marks), 'pending student is not counted absent');
  assert.strictEqual(getDoc('institutes/inst1/batches/b1/attendanceRecords/cls1_9000000005').status, 'pending');
  const nots = [...store.keys()].filter((k) => k.startsWith('institutes/inst1/attendanceNotifications/'));
  assert.ok(nots.length >= 1 && nots.every((k) => getDoc(k).type === 'absent'), 'only absent notifications queued (setting): ' + nots.join());
  r = await call('finalize', { batchId: B, sessionId: SID, force: true }, admin); assert.strictEqual(r.status, 409, 'second finalize refused (no duplicate notifications)');
  console.log('attendance worker v400: all checks passed (' + commits + ' commits)');
})().catch((e) => { console.error(e); process.exit(1); });
