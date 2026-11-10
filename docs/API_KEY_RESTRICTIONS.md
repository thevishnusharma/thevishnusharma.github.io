# Firebase API key restrictions

`firebase-config.js` contains the web Firebase API key. Firebase client API keys identify the Firebase project/app; they are public configuration and do not authorize Firestore, Authentication or Storage access. Security Rules, IAM and App Check enforce access. Do not replace Firebase security rules with key secrecy.

## Console review checklist

1. In Google Cloud Console → APIs & Services → Credentials, identify the key used by this Firebase web app and verify it belongs to the expected Firebase project.
2. Keep the Firebase web key restricted to Firebase-related APIs needed by the project. Firebase-provisioned keys normally have Firebase-related API restrictions already; do not remove an API just because it is not obvious. Test any restriction change with a separate test app/key first.
3. Keep Maps, Places, Gemini/Generative Language and other non-Firebase APIs on separate keys, each restricted to its exact API and client.
4. Apply HTTP referrer restrictions only to a web-only key after checking all production, preview, local development and OAuth redirect origins. Android uses its own Firebase Android configuration/key; do not apply web referrer rules to a shared key used by native builds.
5. Check quota alerts and re-test sign-in, Firestore, Storage, App Check and the Android APK after each Console change.

No key value, support email or support phone was changed for this review. Firebase's current guidance is in [API keys for Firebase](https://firebase.google.com/docs/projects/api-keys).
