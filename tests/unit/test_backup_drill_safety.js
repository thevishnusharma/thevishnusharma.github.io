const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const script = path.join(__dirname, '..', '..', 'scripts', 'firestore-backup-drill.js');
const env = Object.assign({}, process.env, {
  FIREBASE_PROJECT_ID: 'snaptest-source',
  FIRESTORE_RESTORE_PROJECT_ID: 'snaptest-staging',
  FIRESTORE_BACKUP_BUCKET: 'snaptest-backups',
  FIRESTORE_SNAPSHOT_TIME: '2026-10-15T10:20:00Z'
});
const dry = spawnSync(process.execPath, [script], { encoding: 'utf8', env });
assert.strictEqual(dry.status, 0, dry.stderr);
assert.match(dry.stdout, /Dry run only/);
assert.match(dry.stdout, /--project=snaptest-source/);
assert.match(dry.stdout, /--project=snaptest-staging/);
assert.match(dry.stdout, /--snapshot-time=2026-10-15T10:20:00Z/);

const sameProject = spawnSync(process.execPath, [script], {
  encoding: 'utf8', env: Object.assign({}, env, { FIRESTORE_RESTORE_PROJECT_ID: 'snaptest-source' })
});
assert.notStrictEqual(sameProject.status, 0);
assert.match(sameProject.stderr, /must differ/);

const noConfirmation = spawnSync(process.execPath, [script, '--apply'], { encoding: 'utf8', env });
assert.notStrictEqual(noConfirmation.status, 0);
assert.match(noConfirmation.stderr, /--confirm-restore/);
console.log('Backup drill safety checks passed; no cloud operation was run.');
