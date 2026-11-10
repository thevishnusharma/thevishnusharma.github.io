// Rebuild a single JSON bank from the canonical subject chunks.
// Usage: node scripts/join-question-bank.js output.json
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), output = process.argv[2];
if (!output) { console.error('Output file path dein: node scripts/join-question-bank.js output.json'); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'question-bank', 'manifest.json'), 'utf8'));
const rows = [];
for (const group of manifest.groups) {
  const file = path.resolve(ROOT, '.' + group.url);
  if (!file.startsWith(path.join(ROOT, 'question-bank', 'chunks') + path.sep)) { console.error('Chunk path source folder ke bahar hai:', group.url); process.exit(1); }
  const chunk = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(chunk) || chunk.length !== group.count) { console.error('Chunk count mismatch:', group.url); process.exit(1); }
  rows.push(...chunk);
}
if (rows.length !== manifest.count) { console.error('Question count manifest se match nahi hua'); process.exit(1); }
fs.writeFileSync(path.resolve(output), JSON.stringify(rows));
console.log(rows.length + ' questions ko ' + path.resolve(output) + ' me rebuild kiya.');
