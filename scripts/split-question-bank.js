// Split the source question-bank.json into immutable class/subject JSON chunks.
// Usage: node scripts/split-question-bank.js [path/to/source.json]
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), source = path.resolve(process.argv[2] || path.join(ROOT, 'question-bank.json'));
if (!fs.existsSync(source)) { console.error('Source JSON nahi mila:', source); process.exit(1); }
const raw = fs.readFileSync(source), data = JSON.parse(raw.toString('utf8'));
if (!Array.isArray(data)) { console.error('Question bank array hona chahiye'); process.exit(1); }
const groups = new Map();
for (const q of data) {
  if (!q || typeof q !== 'object' || !q.id || !q.subject || !q.classId) { console.error('Question ke id, subject ya classId field missing hain'); process.exit(1); }
  const key = JSON.stringify([String(q.classId), String(q.subject)]);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(q);
}
const slug = (s) => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'subject';
const chunkRoot = path.join(ROOT, 'question-bank', 'chunks');
fs.rmSync(chunkRoot, { recursive: true, force: true });
const list = Array.from(groups.entries()).map(([key, questions]) => ({ key: JSON.parse(key), questions }));
list.sort((a, b) => a.key[0].localeCompare(b.key[0]) || a.key[1].localeCompare(b.key[1]));
const manifest = { schemaVersion: 1, count: data.length, sourceBytes: raw.byteLength, sourceSha256: crypto.createHash('sha256').update(raw).digest('hex'), chunkBytes: 0, groups: [] };
for (let i = 0; i < list.length; i++) {
  const { key: [classId, subject], questions } = list[i], dir = path.join(chunkRoot, slug(classId));
  fs.mkdirSync(dir, { recursive: true });
  const name = String(i + 1).padStart(2, '0') + '-' + slug(subject) + '.json', url = '/question-bank/chunks/' + slug(classId) + '/' + name;
  const out = Buffer.from(JSON.stringify(questions)); fs.writeFileSync(path.join(dir, name), out);
  manifest.chunkBytes += out.byteLength;
  manifest.groups.push({ classId, subject, count: questions.length, url });
}
fs.mkdirSync(path.join(ROOT, 'question-bank'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'question-bank', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ count: data.length, groups: list.length, sourceBytes: raw.byteLength, chunkBytes: manifest.chunkBytes, sourceSha256: manifest.sourceSha256 }, null, 2));
