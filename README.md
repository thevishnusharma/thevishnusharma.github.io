# The Vishnu Sharma

![CI](https://github.com/thevishnusharma/thevishnusharma.github.io/actions/workflows/ci.yml/badge.svg)

Multi-institute test, practice and OMR-scanning platform for coaching institutes.
Roles: **Owner**, **Admin** (institute), **Student**. Vanilla JS PWA on GitHub Pages + Firebase
(Firestore, Auth, Storage, FCM) + Cloudflare Worker (push, question bank, owner alerts) + Capacitor Android APK.

## Folder map
| Path | What |
|---|---|
| `index.html`, `script.js`, `*.js` | Student/Admin web app (see `docs/ARCHITECTURE.md`) |
| `owner-app.html`, `owner-*.js` | Owner-only app |
| `question-generator.html`, `qgen-*` | Question paper generator |
| `liquid-glass*.css` | The one and only UI theme (iOS Liquid Glass) |
| `push-worker/worker.js` | Canonical Cloudflare Worker source |
| `firestore.rules`, `storage.rules` | Security rules |
| `modules/`, `inline/` | ES module bridge and extracted inline app assets |
| `docs/DATA_MODEL.md`, `docs/MODULES.md` | Firestore paths and JavaScript migration map |
| `docs/ACCESSIBILITY.md`, `docs/APP_CHECK.md` | Accessibility gates and staged Firebase App Check setup |
| `docs/FIRESTORE_LIMITS.md`, `docs/BACKUPS.md` | Query pagination bounds and restore drill |
| `docs/API_KEY_RESTRICTIONS.md`, `docs/ADMIN_CLAIMS_MIGRATION.md` | Firebase key and role migration procedures |
| `AUDIT_RESULT.md` | Phase 6–10 evidence, partial items and operator steps |
| `scripts/` | Build + test helper scripts |
| `tests/` | `unit/` (Node tests), `security-rules.test.js` (emulator) |
| `version.json` | Single source of truth for version/build |

## Run tests
```
npm install
npm test                 # all unit tests
npm run test:rules       # needs Java 17 + firebase emulator
npm run stamp:check      # versions in sync?
npm run build:www && npm run check:precache
```
## Release
See `docs/setup/README.md` for setup-guide index and release prerequisites; production rollouts are separate from `npm run build:www`.
