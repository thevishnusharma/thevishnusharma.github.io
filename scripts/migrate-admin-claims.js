#!/usr/bin/env node
/* Dry-run by default. Requires Firebase Admin SDK and Application Default Credentials. */
const OWNER_EMAIL = String(process.env.SNAPTESTPRO_OWNER_EMAIL || 'thevishnusharmaapp@gmail.com').trim().toLowerCase();
const PROJECT_ID = String(process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '').trim();
const apply = process.argv.includes('--apply');
const confirmedProject = (process.argv.find((arg) => arg.startsWith('--confirm-project=')) || '').split('=').slice(1).join('=');

async function main() {
  if (!PROJECT_ID) throw new Error('Set FIREBASE_PROJECT_ID (or GOOGLE_CLOUD_PROJECT) first.');
  if (apply && confirmedProject !== PROJECT_ID) throw new Error(`For --apply, also pass --confirm-project=${PROJECT_ID}.`);
  let appSdk, authSdk, firestoreSdk;
  try {
    appSdk = require('firebase-admin/app');
    authSdk = require('firebase-admin/auth');
    firestoreSdk = require('firebase-admin/firestore');
  } catch (error) {
    throw new Error('Firebase Admin SDK missing. Run this maintenance script with Node 22+ after installing firebase-admin.');
  }
  const app = appSdk.initializeApp({ projectId: PROJECT_ID, credential: appSdk.applicationDefault() });
  const auth = authSdk.getAuth(app), db = firestoreSdk.getFirestore(app);
  const docs = await db.collection('admins').get();
  const accounts = new Map([[OWNER_EMAIL, 'owner']]);
  for (const doc of docs.docs) {
    const email = doc.id.trim().toLowerCase();
    if (doc.get('active') === true && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) accounts.set(email, accounts.get(email) === 'owner' ? 'owner' : 'admin');
  }

  let changed = 0, unchanged = 0, missing = 0;
  for (const [email, role] of accounts) {
    let user;
    try { user = await auth.getUserByEmail(email); }
    catch (error) {
      if (error && error.code === 'auth/user-not-found') { console.log(`SKIP ${email}: Firebase Auth user not found`); missing++; continue; }
      throw error;
    }
    const claims = Object.assign({}, user.customClaims || {});
    if (claims.snapRole === role) { console.log(`OK   ${email}: snapRole=${role}`); unchanged++; continue; }
    console.log(`${apply ? 'SET ' : 'PLAN'} ${email}: snapRole=${role}`);
    if (apply) await auth.setCustomUserClaims(user.uid, Object.assign(claims, { snapRole: role }));
    changed++;
  }
  console.log(`${apply ? 'Applied' : 'Dry run'} complete for project ${PROJECT_ID}: ${changed} change(s), ${unchanged} unchanged, ${missing} missing user(s).`);
  if (!apply && changed) console.log(`Review the list, then rerun with --apply --confirm-project=${PROJECT_ID}.`);
  await appSdk.deleteApp(app);
}

main().catch((error) => { console.error(error && error.stack || error); process.exitCode = 1; });
