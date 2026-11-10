// Android app config. Web version isko use nahi karta — sirf GitHub Actions / Android build.
// APP_ID  : Android package name (Play Store par jo pehle se hai wahi rakhein, warna update nahi hoga)
// APP_URL : (optional) agar set ho to app seedha live website khulti hai (web update = app update).
//           Khaali ho to app apni bundled copy (www/) se chalti hai.
const appUrl = (process.env.APP_URL || '').trim();
// v222: institute build me (fetch-institute.js ne institute-brand.json likhi ho) to splash ke peeche ka rang institute ka
let bg = '#060513';
try { const j = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'institute-brand.json'), 'utf8')); if (/^#[0-9a-f]{6}$/i.test(j.brandColor || '') && !/branding2\s*:\s*false/.test(require('fs').readFileSync(require('path').join(__dirname, 'app-config.js'), 'utf8'))) bg = j.brandColor; } catch (e) {}
module.exports = {
  appId: process.env.APP_ID || 'com.thevishnusharma.app',
  appName: process.env.APP_NAME || 'The Vishnu Sharma',
  webDir: 'www',
  backgroundColor: bg,
  android: { allowMixedContent: false },
  server: Object.assign(
    { androidScheme: 'https' },
    appUrl ? { url: appUrl, cleartext: false } : {}
  )
};
