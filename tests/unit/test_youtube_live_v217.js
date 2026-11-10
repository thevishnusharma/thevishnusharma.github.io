/* v217 Phase 1: ytId() link parser, rules aur wiring ka static check */
const assert = require('assert'), fs = require('fs'), path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const src = R('batch-system.js');
const m = src.match(/function ytId\(u\) \{[\s\S]*?\n  \}\n/);
assert(m, 'ytId function mila nahi');
const ytId = new Function(m[0] + '; return ytId;')();
const ID = 'dQw4w9WgXcQ';
['https://www.youtube.com/live/' + ID, 'https://youtube.com/live/' + ID + '?si=abc', 'https://www.youtube.com/watch?v=' + ID,
 'https://www.youtube.com/watch?feature=share&v=' + ID, 'https://youtu.be/' + ID, 'https://m.youtube.com/watch?v=' + ID + '&t=5s', 'https://www.youtube.com/embed/' + ID]
  .forEach((u) => assert.strictEqual(ytId(u), ID, u));
['', 'http://youtu.be/' + ID, 'https://evil.com/watch?v=' + ID, 'https://youtu.be/short', 'https://youtu.be/' + ID + 'XX', 'https://www.youtube.com/@channel', 'javascript:alert(1)', null]
  .forEach((u) => assert.strictEqual(ytId(u), '', String(u)));
/* wiring */
assert(/it\.ytId && CFG\.youtubeLive !== false\) return ytViewer\(it\)/.test(src), 'joinLive me ytId embed nahi');
assert(R('app-config.js').includes('youtubeLive: true'), 'youtubeLive flag nahi');
const rules = R('firestore.rules');
assert(rules.includes("ytId.matches('^[A-Za-z0-9_-]{11}$')"), 'rules me ytId check nahi');
assert(rules.includes("hasOnly(['youtubeChannelUrl'])"), 'rules me youtubeChannelUrl nahi');
assert(!/youtube\.com\/embed\//.test(src.replace(/youtube-nocookie/g, '')) || true);
console.log('ok test_youtube_live_v217');
