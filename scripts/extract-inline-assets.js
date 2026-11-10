// Extract classic inline scripts/styles without changing their document order.
// Each classic script remains synchronous at its original HTML position, so
// legacy globals and initialization timing keep their existing semantics.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const assetDir = path.join(root, 'inline');
let html = fs.readFileSync(htmlPath, 'utf8');
let scriptNo = 0;
let styleNo = 0;
fs.mkdirSync(assetDir, { recursive: true });
const comments = [];
html = html.replace(/<!--[\s\S]*?-->/g, (comment) => {
  const token = `__INLINE_EXTRACT_COMMENT_${comments.length}__`;
  comments.push([token, comment]);
  return token;
});

html = html.replace(/<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script\s*>/gi, (tag, _attrs, body) => {
  if (/\bsrc\s*=/i.test(_attrs)) return tag;
  if (/\btype\s*=/i.test(_attrs) && !/\btype\s*=\s*["']?(?:text|application)\/javascript/i.test(_attrs)) {
    throw new Error('Unsupported inline script type: ' + _attrs);
  }
  scriptNo++;
  const name = `index-inline-${String(scriptNo).padStart(2, '0')}.js`;
  fs.writeFileSync(path.join(assetDir, name), body, 'utf8');
  return `<script src="inline/${name}"></script>`;
});

html = html.replace(/<style(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/style\s*>/gi, (tag, attrs, body) => {
  if (attrs.trim()) throw new Error('Review style attributes before extraction: ' + attrs);
  styleNo++;
  const name = `index-inline-${String(styleNo).padStart(2, '0')}.css`;
  fs.writeFileSync(path.join(assetDir, name), body, 'utf8');
  return `<link rel="stylesheet" href="inline/${name}">`;
});

if (!scriptNo && !styleNo) {
  console.log('No inline scripts or styles remain; extraction is already complete.');
  process.exit(0);
}
if (scriptNo !== 10 || styleNo !== 4) {
  throw new Error(`Expected 10 inline scripts and 4 styles; found ${scriptNo} scripts and ${styleNo} styles`);
}
for (const [token, comment] of comments) html = html.replace(token, comment);
fs.writeFileSync(htmlPath, html, 'utf8');
console.log(`Extracted ${scriptNo} classic scripts and ${styleNo} styles in place.`);
