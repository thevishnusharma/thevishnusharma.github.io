// Add explicit label/control associations when a visible label immediately
// precedes a uniquely identified form control in index.html.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');
let changed = 0;
html = html.replace(
  /<label(?![^>]*\bfor\s*=)([^>]*)>([\s\S]*?)<\/label>(\s*)(<(?:input|select|textarea)\b(?=[^>]*\bid\s*=\s*["']([^"']+)["'])[^>]*>)/gi,
  (_tag, attrs, body, gap, control, id) => {
    changed++;
    return `<label${attrs} for="${id}">${body}</label>${gap}${control}`;
  }
);
if (changed) fs.writeFileSync(file, html);
console.log(`Added ${changed} explicit form-label association(s).`);
