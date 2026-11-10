/* v224 Phase 6: institute pitch page, privacy/terms institute appendix. Student-facing legal version nahi badlega. */
const assert = require('assert'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..');
const rd = (n) => fs.readFileSync(path.join(root, n), 'utf8');

const pitch = rd('pitch.html'), priv = rd('privacy.html'), terms = rd('terms.html'), cfg = rd('app-config.js');

/* pitch: teeno hisse maujood */
assert(pitch.includes('2 minute demo script'), 'demo script');
assert(pitch.includes('Pehle din ki checklist'), 'first-day checklist');
assert(pitch.includes('Kya The Vishnu Sharma abhi nahi karta'), 'limitations section (overclaim se bachav)');
assert(/robots" content="noindex"/.test(pitch), 'pitch search par na aaye');

/* pitch: legal advice nahi wali chetavani */
assert(pitch.includes('legal advice nahi'), 'pitch me legal advice nahi wali baat');
assert(/CA ya lawyer/.test(pitch), 'CA/lawyer check ka zikr');

/* pitch: jo features repo me nahi hain, unke dawe nahi */
assert(!/UPI.*(chalu|available|supported)/i.test(pitch.replace(/abhi nahi[^<]*/gi, '')), 'UPI ka galat dawa nahi');
const autoHits = pitch.match(/auto[- ]?send/gi) || [];
[...pitch.matchAll(/auto[- ]?send/gi)].forEach((m) => {
  assert(/^.{0,20}nahi/i.test(pitch.slice(m.index + m[0].length, m.index + m[0].length + 30)), 'auto-send sirf negation mein ho: ' + m.index);
});
assert(autoHits.length >= 0);
assert(!/9525208263|vishnu1234stm/.test(pitch), 'developer ka contact pitch me nahi');

/* privacy/terms: appendix, placeholders, student text ka version wahi */
[['privacy', priv], ['terms', terms]].forEach(([n, s]) => {
  assert(s.includes('Parishisht (Appendix): Institute ke liye template'), n + ': appendix');
  assert(s.includes('Ye legal advice nahi hai'), n + ': disclaimer');
  assert(/\[[A-Z_ ]+\]/.test(s), n + ': placeholders');
  assert(s.indexOf('Parishisht') < s.indexOf('<footer>'), n + ': appendix footer se pehle');
  assert(s.includes('2026-10-15-v1'), n + ': student policy version wahi');
  assert(s.includes('Draft for review'), n + ': draft notice wahi');
});
assert(cfg.includes('privacyVersion: "2026-10-15-v1"') && cfg.includes('termsVersion: "2026-10-15-v1"'), 'app-config version wahi');

console.log('phase6 v224 OK');
