const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function main() {
  let posted = '';
  const storage = new Map();
  const window = { SNAP_CONFIG: { version: 'test', build: '0' }, addEventListener() {} };
  const context = {
    window,
    document: { getElementById() { return null; }, addEventListener() {} },
    navigator: { onLine: true, userAgent: 'test-browser' },
    location: { hash: '', pathname: '/' },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, value); },
      removeItem(key) { storage.delete(key); }
    },
    fetch(_url, options) { posted = options.body; return Promise.resolve({ ok: true }); },
    console: { warn() {}, log() {}, error() {} },
    setTimeout() { return 1; },
    clearTimeout() {},
    Date, Promise, Map, Object, Array, String, Math, JSON
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', '..', 'error-reporter.js'), 'utf8'), context);
  window.SnapAlert.report('js', 'Login admin@example.com phone 9876543210 Bearer abcdefghijklmnopqrstuvwxyz012345 apiKey=AIzaSyDUMMYVALUE0123456789', {
    stack: 'Error: email=admin@example.com mobile=9876543210 token=eyJabcdefgh.abcdefgh.abcdefgh',
    ctx: 'studentName=Sonu Kumar; password=hunter2'
  });
  await Promise.resolve(); await Promise.resolve();
  assert.ok(posted, 'report should be sent');
  const report = JSON.parse(posted);
  const payload = JSON.stringify(report);
  assert.ok(!payload.includes('admin@example.com'));
  assert.ok(!payload.includes('9876543210'));
  assert.ok(!payload.includes('abcdefghijklmnopqrstuvwxyz012345'));
  assert.ok(!payload.includes('AIzaSyDUMMYVALUE0123456789'));
  assert.ok(!payload.includes('eyJabcdefgh.abcdefgh.abcdefgh'));
  assert.ok(!payload.includes('Sonu Kumar'));
  assert.ok(!payload.includes('hunter2'));
  assert.ok(payload.includes('[email]') && payload.includes('[phone]'));
  console.log('Error-report privacy scrub checks passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
