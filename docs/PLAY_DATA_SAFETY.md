# Play data safety and account deletion

Status: engineering inventory for owner review; not a completed Play Console declaration.
Reviewed against app source on 2026-10-15.

## Data visible in the current code

- Account/profile: student name, mobile, institute/class, roll number, guardian name/mobile, profile photo, registration timestamp and consent version/time.
- Education: test answers, score/result, submitted time, progress, mistake summaries, scan reports and answer-sheet images.
- Institute features: batch membership, attendance, assignment/request data, tests, institute profile and admin-managed student fields.
- Authentication: password/PIN verifiers and student session binding. The code supports legacy SHA-256 and Worker PBKDF2 modes; the default `serverAuth` is currently `false`.
- Device/diagnostics: offline cache/progress, app settings, app/browser version, user agent, network state, screen name and sanitized error summaries. See `error-reporter.js`.
- Notifications and optional integrations: Firebase Cloud Messaging; Cloudflare Worker/KV/R2 features when configured; Google Drive upload when the OAuth client is configured.

## Data locations and deletion path

The app uses Firebase/Firestore collections including `students`, `studentSecrets`, `studentRecords`, `studentScanReports`, `studentMistakes`, and `studentSessions`; institute batch members are nested under `institutes/{instituteId}/batches/{batchId}/members/{mobile}`. Student profile photos are stored in the student profile document. The deletion endpoint verifies a student's password or an institute admin's Firebase ID token and institute scope, then removes these records and reduces batch enrollment counters.

The in-app Student Settings flow and public `/delete-account.html` page both use `/student/delete-account` on the configured Worker. `push-worker/worker.js` is the canonical Worker source and must be deployed before the UI is released. This repository change does not deploy the Worker.

## Play Console owner checklist

Before publishing or changing the Data safety form, the owner must validate the production configuration, SDK/provider data practices, target audience and the actual Play listing. Complete the Play Console data deletion questions; configure the public account-deletion URL; confirm that the page works from a signed-out browser; review all third-party SDK declarations; set and disclose retention periods; and maintain a monitored privacy/support contact. Account deletion must be available in-app and through a functioning web resource for apps in scope of Google Play's account-deletion requirement.

## Retention and backups

Current source does not define a fixed server-side retention schedule or backup expiration. The deletion endpoint removes live Firestore documents; it cannot retract institute exports or guarantee provider backup expiry. Owner must document and configure the actual Firebase/Google/Cloudflare backup lifecycle and disclose its maximum retention before publication. No production export, restore or deletion has been run from this code review.
