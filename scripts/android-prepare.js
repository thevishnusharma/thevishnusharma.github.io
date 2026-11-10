// `cap add android` ke baad: permissions, app icon, version. (android/ folder har build par naya banta hai)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), A = path.join(ROOT, 'android', 'app');
if (!fs.existsSync(A)) { console.error('android/ nahi mila — pehle `npx cap add android` chalayein'); process.exit(1); }

// 1) Manifest: camera (OMR scan) + mic nahi; camera hardware optional
const mf = path.join(A, 'src/main/AndroidManifest.xml');
let m = fs.readFileSync(mf, 'utf8');
const perms = ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE', 'android.permission.CAMERA', 'android.permission.POST_NOTIFICATIONS'];
const feats = ['<uses-feature android:name="android.hardware.camera" android:required="false" />',
               '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />'];
let add = '';
perms.forEach(p => { if (!m.includes(p)) add += `    <uses-permission android:name="${p}" />\n`; });
feats.forEach(f => { if (!m.includes(f.slice(0, 60))) add += `    ${f}\n`; });
if (add) m = m.replace('</manifest>', add + '</manifest>');
fs.writeFileSync(mf, m);

// 2) Version (GitHub run number se har build ka versionCode badhta hai)
const code = parseInt(process.env.VERSION_CODE || '1', 10), name = process.env.VERSION_NAME || '1.0.' + code;
const g = path.join(A, 'build.gradle');
let b = fs.readFileSync(g, 'utf8');
b = b.replace(/versionCode\s+\d+/, 'versionCode ' + code).replace(/versionName\s+"[^"]*"/, 'versionName "' + name + '"');
// Release signing (sirf tab jab KEYSTORE_FILE env set ho — GitHub secrets se)
if (process.env.KEYSTORE_FILE && !b.includes('signingConfigs')) {
  b = b.replace('    buildTypes {', `    signingConfigs {
        release {
            storeFile file(System.getenv('KEYSTORE_FILE'))
            storePassword System.getenv('KEYSTORE_PASSWORD')
            keyAlias System.getenv('KEY_ALIAS')
            keyPassword System.getenv('KEY_PASSWORD')
        }
    }
    buildTypes {`).replace('        release {\n            minifyEnabled', '        release {\n            signingConfig signingConfigs.release\n            minifyEnabled');
  console.log('release signing configured');
}
fs.writeFileSync(g, b);

// 3) Icon: icon-512-maskable.png se (Capacitor ka default icon hata dete hain)
(async () => {
  let sharp; try { sharp = require('sharp'); } catch (e) { console.warn('sharp nahi mila — default icon rahega'); return; }
  const custom = (process.env.ICON_FILE || '').trim();
  const src = custom && fs.existsSync(custom) ? custom : path.join(ROOT, 'icon-512-maskable.png');
  if (!fs.existsSync(src)) { console.warn('icon nahi mila'); return; }
  const isCustom = src === custom; console.log(isCustom ? 'institute icon use ho raha hai' : 'default icon');
  const res = path.join(A, 'src/main/res');
  fs.rmSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true, force: true });
  const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, s] of Object.entries(sizes)) {
    const dir = path.join(res, 'mipmap-' + d);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'])
      if (isCustom) {
        const inner = Math.round(s * 0.78), pad = Math.floor((s - inner) / 2), pad2 = s - inner - pad, W = { r: 255, g: 255, b: 255, alpha: 1 };
        const buf = await sharp(src).resize(inner, inner, { fit: 'contain', background: W }).flatten({ background: W }).png().toBuffer();
        await sharp(buf).extend({ top: pad, bottom: pad2, left: pad, right: pad2, background: W }).png().toFile(path.join(dir, f));
      } else await sharp(src).resize(s, s).png().toFile(path.join(dir, f));
  }
  console.log('icons generated');
})();
// 4) v222: institute ka native splash + status bar rang (brand data na ho to kuch nahi; fail ho to build nahi tootta)
(async () => { try { await require('./android-brand.js').apply(A, (process.env.ICON_FILE || '').trim()); } catch (e) { console.warn('native branding chhoda:', e.message); } })();
console.log('android prepared: versionCode', code, 'versionName', name);
