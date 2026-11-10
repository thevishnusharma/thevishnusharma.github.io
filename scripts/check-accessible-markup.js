// Dependency-free baseline checks for static form labels, IDs and page metadata.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ids = new Set();
const duplicateIds = new Set();
for (const m of html.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)) {
  if (ids.has(m[2])) duplicateIds.add(m[2]);
  ids.add(m[2]);
}
const controlIds = new Set();
for (const m of html.matchAll(/<(?:input|select|textarea)\b[^>]*\bid\s*=\s*(["'])(.*?)\1/gi)) controlIds.add(m[2]);
const issues = [];
for (const m of html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label\s*>/gi)) {
  const attrs = m[1], body = m[2], f = attrs.match(/\bfor\s*=\s*(["'])(.*?)\1/i);
  if (f && !controlIds.has(f[2])) issues.push(`label points to a missing/non-form control id: ${f[2]}`);
  if (!f && !/<(?:input|select|textarea)\b/i.test(body)) issues.push(`label has no associated control: ${body.replace(/<[^>]+>/g, ' ').trim().slice(0, 60)}`);
}
for (const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
  const tag = m[1].toLowerCase(), attrs = m[2];
  if (tag === 'input' && /\btype\s*=\s*(["'])hidden\1/i.test(attrs)) continue;
  const id = (attrs.match(/\bid\s*=\s*(["'])(.*?)\1/i) || [])[2];
  const named = /\baria-label\s*=|\baria-labelledby\s*=|\btitle\s*=/i.test(attrs) ||
    (id && new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(html)) ||
    (id && new RegExp(`<label\\b[^>]*>[^<]*(?:<[^>]+>)*\\s*<${tag}\\b[^>]*\\bid\\s*=\\s*["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(html));
  if (!named) issues.push(`${tag} has no programmatic label${id ? `: #${id}` : ''}`);
}
if (!/<title>\s*[^<]+\s*<\/title>/i.test(html)) issues.push('document title is missing');
if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0+)?/i.test(html)) issues.push('viewport prevents zoom');
if (!/<main\b/i.test(html)) issues.push('main landmark is missing');
if (duplicateIds.size) issues.push(`duplicate IDs: ${[...duplicateIds].slice(0, 12).join(', ')}`);
if (issues.length) {
  console.error(issues.map((x) => `FAIL ${x}`).join('\n'));
  console.error(`${issues.length} static accessibility issue(s)`);
  process.exit(1);
}
console.log('Static accessibility markup checks passed.');
