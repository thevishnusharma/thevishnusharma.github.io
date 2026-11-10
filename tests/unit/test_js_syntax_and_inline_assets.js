const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const htmlWithoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
assert.strictEqual((htmlWithoutComments.match(/<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?<\/script\s*>/gi) || []).length, 0, 'index.html has no inline scripts');
assert.strictEqual((htmlWithoutComments.match(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi) || []).length, 0, 'index.html has no inline style blocks');

const inlineDir = path.join(root, 'inline');
const inlineAssets = fs.readdirSync(inlineDir).filter((name) => /\.js$|\.css$/i.test(name));
assert.strictEqual(inlineAssets.filter((name) => name.endsWith('.js')).length, 10);
assert.strictEqual(inlineAssets.filter((name) => name.endsWith('.css')).length, 4);
for (const name of inlineAssets) assert.ok(html.includes(`inline/${name}`), `index.html references ${name}`);

const skip = new Set(['.git', 'node_modules', 'www', 'docs', 'vendor', 'android']);
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!skip.has(entry.name) && !entry.name.startsWith('.')) walk(path.join(dir, entry.name)); }
    else if (/\.(?:js|mjs|cjs)$/i.test(entry.name)) files.push(path.join(dir, entry.name));
  }
}
walk(root);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 30000 });
  assert.strictEqual(result.status, 0, `${path.relative(root, file)} failed syntax validation:\n${result.stderr || result.stdout}`);
}
console.log(`PASS JavaScript syntax and inline-asset extraction: ${files.length} source files parsed`);
