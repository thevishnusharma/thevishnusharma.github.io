#!/usr/bin/env node
/* Dry-run by default; --apply performs one Firestore export and imports only to staging. */
const { spawnSync } = require('child_process');
const source = String(process.env.FIREBASE_PROJECT_ID || '').trim();
const staging = String(process.env.FIRESTORE_RESTORE_PROJECT_ID || '').trim();
const bucket = String(process.env.FIRESTORE_BACKUP_BUCKET || '').trim();
const apply = process.argv.includes('--apply');
const confirmed = (process.argv.find((arg) => arg.startsWith('--confirm-restore=')) || '').split('=').slice(1).join('=');

function required(value, name) { if (!value) throw new Error(`Set ${name}.`); }
function run(args) {
  const result = spawnSync('gcloud', args, { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`gcloud exited with status ${result.status}.`);
}

try {
  required(source, 'FIREBASE_PROJECT_ID (source project)');
  required(staging, 'FIRESTORE_RESTORE_PROJECT_ID (isolated staging project)');
  required(bucket, 'FIRESTORE_BACKUP_BUCKET (GCS bucket)');
  if (source === staging) throw new Error('Source and restore projects must differ.');
  if (!/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket)) throw new Error('FIRESTORE_BACKUP_BUCKET must be a bucket name without gs:// or a path.');
  if (apply && confirmed !== staging) throw new Error(`For --apply, also pass --confirm-restore=${staging}.`);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const uri = `gs://${bucket}/snaptestpro/firestore/${stamp}`;
  const exportArgs = ['firestore', 'export', uri, `--project=${source}`, '--database=(default)'];
  const snapshotTime = String(process.env.FIRESTORE_SNAPSHOT_TIME || '').trim();
  if (snapshotTime) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.\d+)?Z$/.test(snapshotTime)) throw new Error('FIRESTORE_SNAPSHOT_TIME must be a UTC timestamp rounded to the minute, such as 2026-10-15T10:20:00Z.');
    exportArgs.push(`--snapshot-time=${snapshotTime}`);
  }
  const importArgs = ['firestore', 'import', uri, `--project=${staging}`, '--database=(default)'];
  console.log(`Source: ${source}\nBackup: ${uri}\nRestore target: ${staging}`);
  console.log('Export command:', `gcloud ${exportArgs.join(' ')}`);
  console.log('Staging restore command:', `gcloud ${importArgs.join(' ')}`);
  if (!apply) { console.log('Dry run only. No cloud operation was started.'); process.exit(0); }
  run(exportArgs);
  run(importArgs);
  console.log('Export and staging import completed. Follow the drill checklist in docs/BACKUPS.md.');
} catch (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
}
