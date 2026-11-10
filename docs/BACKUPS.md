# Firestore backup and restore drill

The drill script defaults to a dry run. It prints a timestamped Cloud Storage export and a restore command for a separate staging Firebase project. It refuses to run if the source and restore project IDs match, and requires an exact `--confirm-restore` match before any cloud operation.

## Prerequisites

- Install and authenticate the Google Cloud CLI with a least-privilege operator identity.
- Set `FIREBASE_PROJECT_ID` to the source project, `FIRESTORE_RESTORE_PROJECT_ID` to a dedicated non-production staging project, and `FIRESTORE_BACKUP_BUCKET` to a private bucket in an appropriate location.
- If point-in-time recovery is enabled, optionally set `FIRESTORE_SNAPSHOT_TIME` to a past UTC minute timestamp (for example `2026-10-15T10:20:00Z`) to request a consistent snapshot. Without that option, Firestore documents are exported, but the export is not guaranteed to represent one consistent point in time.
- Grant only the required Firestore export/import and Cloud Storage permissions. Enable the Firestore and Cloud Storage APIs in the relevant projects.
- Configure bucket uniform access, public access prevention, encryption, lifecycle expiration and access logging. Retention duration must match the real legal/business retention policy; this repository does not invent a retention period.

## Run

```sh
node scripts/firestore-backup-drill.js
node scripts/firestore-backup-drill.js --apply --confirm-restore=your-staging-project
```

The first command makes no cloud request. Review its source, destination and generated commands. The second performs the export and import; use it only with an isolated staging project because imports can overwrite documents that share IDs. Do not point the restore variable at production. Run after significant schema changes and on a regular schedule, then verify representative institute, student, test, result and question-bank data in staging. Record operator, time, export URI, restore result and any issues in the organization's operational log.

Firestore exports cover Firestore data only. Storage objects, Firebase Authentication users, indexes, Security Rules, Cloudflare Worker KV/R2 data and Android signing materials need separate recovery plans. `firestore.rules`, `storage.rules`, index definitions and application source should remain version-controlled. Never commit exported data, credentials or service-account keys here. The exact snapshot behavior and accepted time range depend on the project's point-in-time recovery configuration; verify it against the [Firestore export command reference](https://cloud.google.com/sdk/gcloud/reference/firestore/export).
