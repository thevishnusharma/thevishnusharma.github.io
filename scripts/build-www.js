// Web files ko www/ me copy karta hai (sirf wahi jo app me chahiye). Repo ki root file change nahi hoti.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'www');
const SKIP_DIR = new Set(['node_modules', 'android', 'www', 'scripts', '.git', '.github', 'push-worker', 'diagrams']);   // diagrams = docs ke chart (PNG/PDF), APK me nahi jaate
const SKIP_EXT = new Set(['.md', '.bat', '.keystore', '.jks', '.gs', '.apk', '.aab', '.zip']);
const SKIP_FILES = new Set(['package.json', 'package-lock.json', 'capacitor.config.js', 'firebase.json',
  'firestore.rules', '_headers', 'sitemap.xml', 'robots.txt', 'OWNER_CLOUD_FUNCTIONS_optional.js', '.gitignore', 'institute-icon.img']);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
// v179: OWNER_APP=1 -> sirf Owner app ki files (owner-app.html -> index.html). Student/Admin ka code shamil nahi hota.
if (process.env.OWNER_APP === '1') {
  const need = ['owner-app.html', 'styles.css', 'liquid-glass.css', 'smooth-ui.css', 'safe-html.js', 'perf-lite.js', 'firebase-config.js', 'app-config.js', 'owner-panel.js', 'owner-ui.js', 'owner-wizard.js', 'owner-demo.js', 'owner-push.js', 'owner-reads.js', 'owner-enquiries.js', 'owner-live.js', 'read-tracker.js', 'app-bridge.js',
    'manifest-owner.webmanifest', 'icon-192-owner.png', 'icon-512-owner.png', 'icon-192-maskable-owner.png', 'icon-512-maskable-owner.png'];
  for (const f of need) {
    if (!fs.existsSync(path.join(ROOT, f))) { console.error('Owner app ki file nahi mili:', f); process.exit(1); }
    fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f === 'owner-app.html' ? 'index.html' : f));
  }
  console.log('www ready (OWNER APP):', need.length, 'files'); process.exit(0);
}
let n = 0;
(function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name) && !e.name.startsWith('.')) walk(path.join(dir, e.name), path.join(rel, e.name)); continue; }
    if (SKIP_FILES.has(e.name) || SKIP_EXT.has(path.extname(e.name).toLowerCase())) continue;
    if (/^WhatsApp Image/i.test(e.name)) continue;
    fs.mkdirSync(path.join(OUT, rel), { recursive: true });
    fs.copyFileSync(path.join(dir, e.name), path.join(OUT, rel, e.name)); n++;
  }
})(ROOT, '');
// App me service worker ki zaroorat nahi (files app ke andar hi hain; SW purani cache atka deta hai).
const idx = path.join(OUT, 'index.html');
let h = fs.readFileSync(idx, 'utf8');
const swBlock = /if \('serviceWorker' in navigator\)\s*\{\s*let swRegistration = null;/;
let swDisabled = false;
if (swBlock.test(h)) {
  h = h.replace(swBlock, "if (false && 'serviceWorker' in navigator) {\n    let swRegistration = null;");
  fs.writeFileSync(idx, h);
  swDisabled = true;
} else {
  // Inline extraction moved the SW bootstrap to this classic script. Patch
  // the app copy so Capacitor does not register a website service worker.
  const extractedSw = path.join(OUT, 'inline', 'index-inline-08.js');
  if (fs.existsSync(extractedSw)) {
    let js = fs.readFileSync(extractedSw, 'utf8');
    if (swBlock.test(js)) {
      js = js.replace(swBlock, "if (false && 'serviceWorker' in navigator) {\n    let swRegistration = null;");
      fs.writeFileSync(extractedSw, js);
      swDisabled = true;
    }
  }
}
if (swDisabled) console.log('SW registration disabled in app copy');
else console.warn('WARN: SW registration block not found — app copy may register the website service worker');
// v175: institute APK — INSTITUTE_ID set ho to app us institute se lock ho jaati hai
const lockId = (process.env.INSTITUTE_ID || '').trim();
if (lockId) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(lockId)) { console.error('INSTITUTE_ID galat hai:', lockId); process.exit(1); }
  fs.writeFileSync(path.join(OUT, 'lock-config.js'), 'window.SNAP_LOCK_INSTITUTE = ' + JSON.stringify(lockId) + ';\n');
  console.log('app locked to institute:', lockId);
}
console.log('www ready:', n, 'files');
