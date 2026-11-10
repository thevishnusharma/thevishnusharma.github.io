# Admin and owner custom-claim migration

The Firestore rules now recognize the trusted `snapRole` token claim (`admin` or `owner`) while retaining the existing email allow-list as a compatibility fallback. Admin claims still require an active `admins/{email}` document, and the institute active check continues to apply. This preserves owner disable behavior during and after migration.

## Preview and apply

Use Node.js 22 or newer, install the Firebase Admin SDK in the maintenance environment, and authenticate with Application Default Credentials for the intended Firebase project. The script does not read or print service-account keys.

```sh
export FIREBASE_PROJECT_ID=your-project-id
node scripts/migrate-admin-claims.js
node scripts/migrate-admin-claims.js --apply --confirm-project=your-project-id
```

The first command is read-only and reports each role change. Review the project and account list before running the second command. It preserves unrelated existing custom claims, sets `snapRole=admin` only for active `admins/{email}` documents, and sets `snapRole=owner` on the configured owner account. Set `SNAPTESTPRO_OWNER_EMAIL` only if the owner account has intentionally changed. Inactive/missing admin accounts are not granted claims. Users must refresh their ID token or sign in again before the new role appears in it.

The Admin SDK is a privileged maintenance dependency. Do not put service-account JSON, private keys or ADC files in this repository. Firebase Admin Node.js SDK setup and current runtime requirements are documented by [Firebase](https://firebase.google.com/docs/admin/setup).
