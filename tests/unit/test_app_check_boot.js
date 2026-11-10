const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function boot(config, capacitor) {
  const calls = [];
  const firebase = {
    apps: [],
    initializeApp() { this.apps.push({}); },
    appCheck() { return { activate(key, refresh) { calls.push(['web', key, refresh]); return Promise.resolve(); } }; },
    firestore() { calls.push(['firestore']); return { enablePersistence() { return Promise.resolve(); } }; },
    storage() { return {}; },
    auth() { return { onAuthStateChanged() { return function () {}; }, signInAnonymously() { return Promise.resolve(); } }; }
  };
  const window = { SNAP_CONFIG: { appCheck: config }, Capacitor: capacitor, addEventListener() {} };
  const context = { window, firebase, console: { warn() {} }, Promise, String, Object };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', '..', 'firebase-config.js'), 'utf8'), context);
  return { window, calls };
}

async function main() {
  const web = boot({ enabled: true, webSiteKey: 'public-site-key', tokenAutoRefresh: true, nativeEnabled: true });
  assert.deepStrictEqual(web.calls[0], ['web', 'public-site-key', true]);
  assert.strictEqual(web.window.vishnuFirebase.appCheckState, 'off'); // async activation status settles below
  await web.window.vishnuFirebase.appCheckReady;
  assert.strictEqual(web.window.vishnuFirebase.appCheckState, 'initialized:web-recaptcha-v3');
  assert.ok(web.calls.findIndex((c) => c[0] === 'web') < web.calls.findIndex((c) => c[0] === 'firestore'));

  let nativeCall;
  const native = boot({ enabled: true, nativeEnabled: true, tokenAutoRefresh: true }, {
    platform: 'android', isNativePlatform: () => true,
    nativePromise(plugin, method, options) { nativeCall = { plugin, method, options }; return Promise.resolve(); }
  });
  await native.window.vishnuFirebase.appCheckReady;
  assert.strictEqual(JSON.stringify(nativeCall), JSON.stringify({ plugin: 'FirebaseAppCheck', method: 'initialize', options: { isTokenAutoRefreshEnabled: true } }));
  assert.strictEqual(native.window.vishnuFirebase.appCheckState, 'initialized:android-play-integrity');

  const unconfigured = boot({ enabled: true, webSiteKey: '' }, null);
  assert.strictEqual(unconfigured.window.vishnuFirebase.appCheckState, 'web-site-key-missing');
  console.log('App Check bootstrap checks passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
