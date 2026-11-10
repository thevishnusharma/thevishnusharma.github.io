# Contributing

## Local setup

Use Node.js 20 for the existing CI workflow. Install dependencies with `npm install`, then run:

```powershell
npm test
npm run stamp:check
node scripts/scan-secrets.js
npm run build:www
npm run check:precache
```

Firestore rules tests need Java 17 and the Firebase Emulator Suite:

```powershell
npm run test:rules
```

## Change workflow

1. Start from a clean, named phase branch and keep a local checkpoint before moving or deleting files.
2. Read `docs/ARCHITECTURE.md`, `docs/MODULES.md`, and `docs/DATA_MODEL.md` before changing shared app state or Firestore paths.
3. Keep existing URLs and classic global APIs stable unless every caller is migrated. For a new ES module, import a named adapter from `modules/legacy-bridge.mjs` instead of referencing classic lexical bindings directly.
4. Add a focused unit/rules test for changed behavior, then run the checks above.
5. Treat Worker deployment, Firebase Console enforcement, Android release signing, and production data migrations as separate release operations. Review their setup guide and current metrics before changing production.

## Secrets and data

- Never commit service-account JSON, private keys, API secrets, signing files, student exports, or real backups. Use GitHub Actions secrets or local ignored files.
- Firebase web configuration is public app configuration; restrict its API allowlist and rely on Security Rules and App Check for authorization.
- Do not copy production student data into tests. Use synthetic fixtures and the demo Firebase project for emulator tests.
- Admin custom-claim and Firestore backup scripts default to dry-run. Review the printed plan, use a trusted account, and explicitly pass the documented apply flag only for an approved target.

## Build and deployment targets

- GitHub Pages serves the repository root.
- `scripts/build-www.js` copies the student/admin web app for Capacitor into `www/`.
- The owner APK uses a separate allowlist in `scripts/build-www.js`.
- `push-worker/worker.js` is the canonical Cloudflare Worker source. Updating that source does not deploy it.
