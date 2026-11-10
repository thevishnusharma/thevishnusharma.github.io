// v222 Phase 4B: institute APK ka native splash + status bar rang. `android-prepare.js` isse try/catch me bulata hai.
// Input: ROOT/institute-brand.json (fetch-institute.js likhta hai: {brandColor:"#rrggbb"}) + logo (ICON_FILE ya ROOT/institute-icon.img).
// Brand data na ho, ya app-config.js me `branding2: false` ho, to kuch nahi badalta (Capacitor ka purana default). Main/owner APK me ye file bante hi nahi.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const okColor = (c) => /^#[0-9a-f]{6}$/i.test(c || '');
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), c = (x) => Math.max(0, Math.min(255, Math.round(x * f)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((x) => ('0' + c(x).toString(16)).slice(-2)).join('').toUpperCase();
}
function disabled() { try { return /branding2\s*:\s*false/.test(fs.readFileSync(path.join(ROOT, 'app-config.js'), 'utf8')); } catch (e) { return false; } }
function readBrand() {
  try { const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'institute-brand.json'), 'utf8')); return okColor(j.brandColor) ? { brandColor: j.brandColor.toUpperCase() } : null; } catch (e) { return null; }
}
/* res/values: app ke apne colors (library ke colorPrimary/Dark ko override) — status bar aur app ka rang */
function colorsXml(col) {
  return '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="colorPrimary">' + col + '</color>\n    <color name="colorPrimaryDark">' + shade(col, 0.75) + '</color>\n    <color name="snap_splash_bg">' + col + '</color>\n</resources>\n';
}
/* styles.xml: Android 12+ system splash ka rang + icon (pehle ke versions ke liye android:background splash.png hi rehta hai) */
function patchStyles(xml, hasIcon) {
  if (xml.includes('windowSplashScreenBackground')) return xml;
  const re = /(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)([\s\S]*?)(<\/style>)/;
  if (!re.test(xml)) return xml;
  const add = '\n        <item name="windowSplashScreenBackground">@color/snap_splash_bg</item>' + (hasIcon ? '\n        <item name="windowSplashScreenAnimatedIcon">@drawable/snap_splash_icon</item>' : '') + '\n    ';
  return xml.replace(re, (m, a, b, c) => a + b.replace(/\s*$/, '') + add + c);
}
async function apply(A, logoPath) {
  if (disabled()) { console.log('branding2=false: native splash/rang chhoda nahi gaya'); return false; }
  const b = readBrand(); if (!b) { console.log('institute-brand.json nahi — default splash/rang'); return false; }
  const res = path.join(A, 'src/main/res'), col = b.brandColor;
  fs.writeFileSync(path.join(res, 'values', 'snap_brand.xml'), colorsXml(col));
  let sharp = null; try { sharp = require('sharp'); } catch (e) { console.warn('sharp nahi mila — sirf rang lagega, logo nahi'); }
  const logo = logoPath && fs.existsSync(logoPath) ? logoPath : (fs.existsSync(path.join(ROOT, 'institute-icon.img')) ? path.join(ROOT, 'institute-icon.img') : '');
  const W = { r: 255, g: 255, b: 255, alpha: 1 };
  let hasIcon = false;
  /* logo ek safed gol/chaukor card par (kisi bhi logo ka rang dikhe) */
  async function card(size, pct, radiusPct) {
    const inner = Math.round(size * pct), r = Math.round(size * radiusPct);
    const mask = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '"><rect width="' + size + '" height="' + size + '" rx="' + r + '" fill="#fff"/></svg>');
    const pad = Math.round(size * 0.14), lg = await sharp(logo).resize(size - 2 * pad, size - 2 * pad, { fit: 'contain', background: W }).flatten({ background: W }).png().toBuffer();
    const base = await sharp({ create: { width: size, height: size, channels: 4, background: W } }).composite([{ input: lg, left: pad, top: pad }]).png().toBuffer();
    return sharp(base).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  }
  if (sharp && logo) {
    /* Android 12+ icon: 288dp canvas ka beech ka ~hissa dikhta hai, isliye card chhota aur transparent canvas me */
    const C = 768, k = Math.round(C * 0.5), cd = await card(k, 1, 0.22);
    const dir = path.join(res, 'drawable-nodpi'); fs.mkdirSync(dir, { recursive: true });
    await sharp({ create: { width: C, height: C, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: cd, left: Math.round((C - k) / 2), top: Math.round((C - k) / 2) }]).png().toFile(path.join(dir, 'snap_splash_icon.png'));
    hasIcon = true;
  }
  /* purane Android (ya splash drawable) ke liye: har splash.png wahi size me, brand rang + beech me logo card */
  if (sharp) {
    const dirs = fs.readdirSync(res).filter((d) => /^drawable/.test(d) && fs.existsSync(path.join(res, d, 'splash.png')));
    for (const d of dirs) {
      const f = path.join(res, d, 'splash.png'), m = await sharp(f).metadata(), w = m.width, h = m.height;
      const bg = { r: parseInt(col.slice(1, 3), 16), g: parseInt(col.slice(3, 5), 16), b: parseInt(col.slice(5, 7), 16), alpha: 1 };
      const img = sharp({ create: { width: w, height: h, channels: 4, background: bg } });
      const out = logo ? await img.composite([{ input: await card(Math.round(Math.min(w, h) * 0.32), 1, 0.22), gravity: 'center' }]).png().toBuffer() : await img.png().toBuffer();
      fs.writeFileSync(f, out);
    }
    console.log('splash.png badle:', dirs.length);
  }
  const sf = path.join(res, 'values', 'styles.xml');
  if (fs.existsSync(sf)) fs.writeFileSync(sf, patchStyles(fs.readFileSync(sf, 'utf8'), hasIcon));
  console.log('institute native branding lagi:', col, hasIcon ? '(logo ke saath)' : '(sirf rang)');
  return true;
}
module.exports = { apply, shade, okColor, colorsXml, patchStyles, readBrand };
