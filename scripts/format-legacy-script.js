// Split inherited, minified function lines at semicolons without touching
// quoted text, template literals, regular expressions, or comments.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'script.js');
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

function splitStatements(line) {
  let out = '', state = 'code', escaped = false, regexAllowed = true, word = '';
  const flushWord = () => {
    if (word) regexAllowed = /^(return|throw|case|delete|void|typeof|instanceof|in|of|yield|await|else|do|new)$/.test(word);
    word = '';
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i], next = line[i + 1] || '';
    if (state === 'single' || state === 'double' || state === 'template' || state === 'regex') {
      out += ch;
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      const closing = state === 'single' ? ch === "'" : state === 'double' ? ch === '"' : state === 'template' ? ch === '`' : ch === '/';
      if (closing) { state = 'code'; regexAllowed = false; }
      continue;
    }
    if (state === 'line-comment') { out += ch; continue; }
    if (state === 'block-comment') {
      out += ch;
      if (ch === '*' && next === '/') { out += next; i++; state = 'code'; }
      continue;
    }
    if (ch === '/' && next === '/') { flushWord(); out += '//'; i++; state = 'line-comment'; continue; }
    if (ch === '/' && next === '*') { flushWord(); out += '/*'; i++; state = 'block-comment'; continue; }
    if (ch === "'") { flushWord(); out += ch; state = 'single'; continue; }
    if (ch === '"') { flushWord(); out += ch; state = 'double'; continue; }
    if (ch === '`') { flushWord(); out += ch; state = 'template'; continue; }
    if (ch === '/' && regexAllowed) { flushWord(); out += ch; state = 'regex'; continue; }
    if (/[A-Za-z0-9_$]/.test(ch)) { word += ch; out += ch; continue; }
    flushWord(); out += ch;
    if (ch === ';') out += '\n';
    if (/[({[,:;!?=<>+\-*%&|^~]/.test(ch)) regexAllowed = true;
    else if (/[)\]}]/.test(ch) || ch === '.') regexAllowed = false;
  }
  return out;
}

let changed = 0;
for (let i = 0; i < lines.length; i++) if (lines[i].length > 20000) { lines[i] = splitStatements(lines[i]); changed++; }
if (!changed) { console.log('No oversized lines found.'); process.exit(0); }
fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log(`Split ${changed} oversized line(s) after statement terminators.`);
