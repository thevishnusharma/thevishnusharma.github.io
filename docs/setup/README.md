# Current setup and maintenance

This folder keeps operator guides. The older `FINAL_GUIDE.md` and numbered setup notes are retained for reference; many commands in them describe earlier app versions.

## Canonical source paths

- Main Android workflow: `.github/workflows/build-android.yml`.
- Web bundle builder: `scripts/build-www.js`.
- Capacitor Android preparation: `scripts/android-prepare.js`.
- Cloudflare Worker source: `push-worker/worker.js`.
- Firebase rules: `firestore.rules` and `storage.rules`.

The root copies of the build scripts and Worker were removed after repository-wide reference checks. Deploy changes to Cloudflare separately; repository edits do not deploy the Worker.

## Local checks

1. Install the package dependencies with `npm install`.
2. Run `npm test` for the Node unit suite.
3. Run `npm run test:rules` with Java and the Firebase emulators installed.
4. Run `npm run build:www` and `npm run check:precache` before an Android sync.
5. `npm run android:sync` also needs the Android SDK/Gradle toolchain.

## Credentials and Firebase configuration

Do not commit service-account keys, Worker `.dev.vars`, Android signing keys, or Google Services JSON. Android CI receives `GOOGLE_SERVICES_JSON_BASE64` through GitHub Actions secrets and writes the conventional `android/app/google-services.json` path during the build. The checked-in `google-services (1).json` was not consumed by a build script and has been removed. Firebase web API settings in `firebase-config.js` are public client configuration; they are not service-account credentials and must be protected by Firebase rules, provider restrictions and App Check.

## Data deletion deployment

The in-app and public account-deletion screens call `/student/delete-account` on the Worker configured in `app-config.js`. Before releasing those screens to users, deploy the updated `push-worker/worker.js`, configure its existing `SERVICE_ACCOUNT_JSON` and `BANK_KV` bindings, then verify student and institute-admin deletion against a Firebase emulator/staging project.
