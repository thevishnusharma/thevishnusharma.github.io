# Release steps
1. Edit `version.json` (`web` = semver, `build` = integer, bump every release).
2. `npm run stamp` — updates `sw.js` cache name, `app-config.js` (version/build) and `package.json`.
   (`npm run build:www` also stamps.) CI runs `npm run stamp:check` and fails if anything is out of sync.
3. `npm test` and (if rules changed) `npm run test:rules`.
4. Push to `main` — GitHub Pages serves the web app. The new service-worker cache name makes users get the new files.
5. Android APK: run the "build-android" workflow (versionCode/Name come from the run number; `app-version.json` is written by that workflow).
6. Notify users: put `[notify:all]` in the commit message so `announce-update.yml` sends the push.
