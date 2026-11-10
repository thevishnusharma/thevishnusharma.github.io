/* Phase 5 helper: HTML-building template literals me free-text fields ko auto-escape karta hai.
   Usage: node scripts/xss-autofix.js [--dry]   (acorn chahiye: npm i -D acorn)
   Rules: sirf wo template literal jiske static hisse me HTML tag (<a ...) hai.
     - text/attribute context: ${x.name} -> ${__sx(x.name)}   (sirf neeche ki free-text property names)
     - inline handler context (onclick="f('${x.id}')"): har simple ${chain} -> ${__sj(chain)}
   Idempotent: dobara chalane par kuch nahi badalta. Rich fields (question/options/explanation/html) jaan-bujhkar chhode gaye (guard sanitize karta hai). */
const fs = require('fs'), path = require('path');
let acorn; try { acorn = require('acorn'); } catch (e) { acorn = require('/tmp/tool/node_modules/acorn'); }
const DRY = process.argv.includes('--dry'), ROOT = path.join(__dirname, '..');
const TEXT_PROPS = new Set('name fullName fullname studentName instituteName instName batchName title testTitle examName label subject subjectName chapter chapterName topic message msg note remark remarks address email teacherName className city caption filename fileName author senderName userName displayName parentName fatherName school center coaching adminName ownerName desc description heading subtitle placeholder'.split(' '));
const HANDLER_OPEN = /\son[a-z]+\s*=\s*(["'])(?:(?!\1)[\s\S])*$/;
const SKIP = /^(sw\.js|safe-html\.js|worker\.js|firebase-config\.js|.*question-bank.*|.*-source\.jsx?)$/;
function unchain(n) { while (n && n.type === 'ChainExpression') n = n.expression; return n; }
function isSimple(n) {
  n = unchain(n); if (!n) return false;
  if (n.type === 'Identifier') return true;
  if (n.type === 'MemberExpression') return isSimple(n.object) || n.object.type === 'ThisExpression';
  return false;
}
function propName(n) { n = unchain(n); if (n.type === 'Identifier') return n.name; if (n.type === 'MemberExpression') return n.computed ? (n.property.type === 'Literal' ? String(n.property.value) : null) : n.property.name; return null; }
function isTextTarget(n) {
  n = unchain(n);
  if (n.type === 'LogicalExpression' && (n.operator === '||' || n.operator === '??')) return isTextTarget(n.left) && (n.right.type === 'Literal' || (n.right.type === 'TemplateLiteral' && !n.right.expressions.length));
  return isSimple(n) && TEXT_PROPS.has(propName(n));
}
function isHandlerTarget(n) {
  n = unchain(n);
  if (n.type === 'LogicalExpression' && (n.operator === '||' || n.operator === '??')) return isHandlerTarget(n.left) && (n.right.type === 'Literal' || (n.right.type === 'TemplateLiteral' && !n.right.expressions.length));
  return isSimple(n);
}
function processSource(src) {
  let ast; try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowHashBang: true }); } catch (e) { return { src, n: 0, err: e.message }; }
  const edits = [];
  (function walk(node, tagged) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'TemplateLiteral' && !tagged) {
      const statics = node.quasis.map((q) => q.value.raw).join('');
      if (/<[a-zA-Z]/.test(statics)) {
        node.expressions.forEach((ex, i) => {
          const before = node.quasis[i].value.raw, inHandler = HANDLER_OPEN.test(before);
          if (inHandler ? isHandlerTarget(ex) : isTextTarget(ex)) edits.push([ex.start, ex.end, (inHandler ? '__sj(' : '__sx(') + src.slice(ex.start, ex.end) + ')']);
        });
      }
    }
    for (const k of Object.keys(node)) {
      const v = node[k]; if (k === 'type') continue;
      if (Array.isArray(v)) v.forEach((c) => walk(c, false)); else if (v && typeof v === 'object') walk(v, node.type === 'TaggedTemplateExpression' && k === 'quasi');
    }
  })(ast, false);
  edits.sort((a, b) => b[0] - a[0]);
  let out = src; for (const [s, e, r] of edits) out = out.slice(0, s) + r + out.slice(e);
  return { src: out, n: edits.length };
}
function main() {
const report = []; let total = 0;
for (const f of fs.readdirSync(ROOT)) {
  if (SKIP.test(f)) continue; const p = path.join(ROOT, f);
  if (/\.js$/.test(f)) {
    const s = fs.readFileSync(p, 'utf8'), r = processSource(s);
    if (r.err) report.push(f + ': PARSE SKIP (' + r.err + ')'); else if (r.n) { total += r.n; report.push(f + ': ' + r.n); if (!DRY) fs.writeFileSync(p, r.src); }
  } else if (/\.html$/.test(f)) {
    let s = fs.readFileSync(p, 'utf8'), n = 0;
    s = s.replace(/(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, body, c) => { if (/type\s*=\s*["'](?!text\/javascript|module)/i.test(a) || !body.trim()) return m; const r = processSource(body); if (r.err) { report.push(f + ': inline PARSE SKIP (' + r.err + ')'); return m; } n += r.n; return a + r.src + c; });
    if (n) { total += n; report.push(f + ': ' + n); if (!DRY) fs.writeFileSync(p, s); }
  }
}
console.log((DRY ? '[dry] ' : '') + 'escaped interpolations: ' + total + '\n' + report.join('\n'));
}
module.exports = { processSource };
if (require.main === module) main();
