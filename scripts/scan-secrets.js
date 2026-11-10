// Small dependency-free scan of tracked and untracked repository text files.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root }).toString('utf8').split('\0').filter(Boolean);
const patterns = [
  ['private-key block', /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g],
  ['Google service-account private key', /"private_key"\s*:\s*"-----BEGIN/g],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['GitHub token', /\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{30,}\b/g],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{30,}\b/g],
  ['Cloudflare API token', /\b(?:cf|cloudflare)[_-](?:api[_-])?token\s*[:=]\s*["']?[A-Za-z0-9_-]{32,}/gi]
];
let findings = 0;
for (const rel of files) {
  const full = path.join(root, rel); let buf;
  try { buf = fs.readFileSync(full); } catch (e) { continue; }
  if (buf.includes(0)) continue;
  const text = buf.toString('utf8');
  for (const [label, pattern] of patterns) {
    pattern.lastIndex = 0; let match;
    while ((match = pattern.exec(text))) {
      const line = text.slice(0, match.index).split('\n').length;
      console.error(rel + ':' + line + ': possible ' + label + ' (value redacted)'); findings++;
      if (!pattern.global) break;
    }
  }
}
if (findings) { console.error('Secret scan found ' + findings + ' possible value(s). Review before committing.'); process.exit(1); }
console.log('Secret scan OK: ' + files.length + ' repository files scanned; no configured private-key/token patterns found.');
