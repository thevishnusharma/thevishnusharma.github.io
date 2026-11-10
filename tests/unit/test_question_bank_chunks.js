const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..', '..'), manifest = JSON.parse(fs.readFileSync(path.join(root, 'question-bank', 'manifest.json'), 'utf8'));
const ids = new Set(); let total = 0, bytes = 0;
assert.strictEqual(manifest.schemaVersion, 1); assert.ok(/^[a-f0-9]{64}$/.test(manifest.sourceSha256));
for (const group of manifest.groups) {
  const file = path.join(root, group.url.replace(/^\//, '')), raw = fs.readFileSync(file), rows = JSON.parse(raw.toString('utf8'));
  assert.strictEqual(rows.length, group.count, group.url); total += rows.length; bytes += raw.length;
  for (const q of rows) {
    assert.strictEqual(String(q.classId), group.classId); assert.strictEqual(String(q.subject), group.subject);
    assert.ok(q.id != null && String(q.id)); assert.ok(!ids.has(String(q.id)), 'duplicate question ID: ' + q.id); ids.add(String(q.id));
  }
}
assert.strictEqual(total, manifest.count); assert.strictEqual(bytes, manifest.chunkBytes);
console.log('PASS question-bank chunks: ' + total + ' unique questions in ' + manifest.groups.length + ' subject/class chunks (' + bytes + ' bytes)');
