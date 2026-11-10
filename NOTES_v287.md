# v287 — owner inbox, 5-field registration, notifications

- download.html: registration asks only name, mobile, institute, city, state -> Firestore `enquiries`. Reviews are written to Firestore `reviews` as pending; only approved ones show on the site (no email, no reviews.json).
- owner-enquiries.js: owner app "Inbox" tab = Enquiries + Reviews (Approve, Hide, Pin, Reply, Delete).
- firestore.rules: rules for `enquiries` and `reviews` (publish the same text in Firebase Console).
- Notifications: website/zip updates go to the Owner only. Students/admin get an app-update push only when THEIR institute's APK is built (topic app_inst_<id>).
  Needs: push-worker/worker.js redeployed on Cloudflare; .github/workflows only apply if WORKFLOW_PAT is set (otherwise edit them on GitHub).
- Owner APK: scripts/build-www.js now bundles owner-enquiries.js (it was missing, so the Inbox tab never appeared in the Owner APK). Rebuild the Owner APK: Actions > Build Owner APK > Run workflow.
- Owner APK now runs in live mode (APP_URL in build-owner-apk.yml): it opens the website's owner-app.html, so every website update shows in the Owner app automatically. Install the new Owner APK once; after that no rebuild is needed. owner-live.js also added to the bundled fallback list.
- app-ui.css: admin Tests/Students/More cards are now ~150px on laptop (were ~660px squares); phone unchanged.
- Logo: snaptestpro-logo.png, icon-192/512(+maskable), favicon.ico and splash-screen.jpg replaced with the new SnapTest Pro logo (cleaned, white background). Full original image saved as snaptestpro-banner.jpg. Owner icons (icon-*-owner.png) unchanged.
