/* v222 Phase 4B: institute APK ka native rang/splash — pure helpers, bina Android SDK ke */
const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os');
const root = path.join(__dirname, '..', '..'), B = require(path.join(root, 'scripts', 'android-brand.js'));
assert(B.okColor('#0f766e') && !B.okColor('red') && !B.okColor('#12345') && !B.okColor('javascript:1'));
assert.strictEqual(B.shade('#FFFFFF', 0.75), '#BFBFBF'); assert.strictEqual(B.shade('#000000', 0.5), '#000000');
const x = B.colorsXml('#0F766E'); assert(/colorPrimary">#0F766E/.test(x) && /snap_splash_bg">#0F766E/.test(x) && /colorPrimaryDark">#0B5953/.test(x));
const st = '<resources>\n    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">\n        <item name="android:background">@drawable/splash</item>\n    </style>\n</resources>';
const p1 = B.patchStyles(st, true); assert(/windowSplashScreenBackground">@color\/snap_splash_bg/.test(p1) && /windowSplashScreenAnimatedIcon/.test(p1) && /android:background/.test(p1));
assert.strictEqual(B.patchStyles(p1, true), p1, 'dobara patch par badlaav nahi');
assert(!/AnimatedIcon/.test(B.patchStyles(st, false)), 'logo na ho to icon item nahi');
assert.strictEqual(B.patchStyles('<resources/>', true), '<resources/>', 'style na mile to chhua nahi');
/* brand file: galat rang -> null (default build) */
const f = path.join(root, 'institute-brand.json'); assert(!fs.existsSync(f), 'repo me stray brand file nahi honi chahiye');
fs.writeFileSync(f, '{"brandColor":"nope"}'); try { assert.strictEqual(B.readBrand(), null); fs.writeFileSync(f, '{"brandColor":"#0f766e"}'); assert.strictEqual(B.readBrand().brandColor, '#0F766E'); } finally { fs.unlinkSync(f); }
/* hooks: workflow nahi badla, prepare try/catch me bulata hai, fetch brand file likhta hai, config rang padhta hai */
const rd = (n) => fs.readFileSync(path.join(root, n), 'utf8');
assert(/android-brand\.js[\s\S]{0,80}catch/.test(rd('scripts/android-prepare.js')) || /try \{ await require\('\.\/android-brand\.js'\)/.test(rd('scripts/android-prepare.js')));
assert(/institute-brand\.json/.test(rd('scripts/fetch-institute.js')) && /institute-brand\.json/.test(rd('capacitor.config.js')));
assert(!/android-brand|institute-brand/.test(rd('.github/workflows/build-institute-apk.yml')), 'workflow nahi badla');
console.log('apk brand v222 OK');
