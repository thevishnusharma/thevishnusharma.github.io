# v286 — download.html: 3D hero, English, registration form, reviews

## Reviews: owner control
Reviews are checked before going live. Flow:
1. A visitor submits the review form. You receive an email (subject "New review: <institute> (5/5)").
2. The email has a row "Approve line (paste into reviews.json)". Copy it into `reviews.json` (inside the [ ] list) and commit. It is live in about a minute.
3. Do nothing = the review never appears. Delete the line = removed.

Fields per review (all editable by hand):
- `show`: false hides it without deleting
- `pin`: true keeps it at the top
- `reply`: optional text shown under it as "Reply from SnapTest Pro"

Example:
[
  {"name":"Student Name","role":"Student","inst":"Institute Name","city":"Patna","rating":5,"text":"Great app.","date":"2026-11-10","show":true,"pin":false,"reply":"Thank you!"}
]
Lines must be separated by commas; the last one has no comma.

## Layout
The viewport is fixed at width=1120, so phones always get the desktop layout (they can pinch-zoom).

## Registration enquiries -> Owner app (v286)
- download.html writes the form straight to Firestore collection `enquiries` (no email). It reads apiKey/projectId from /firebase-config.js.
- Owner app: new "Enquiries" tab (owner-enquiries.js). Shows Call / WhatsApp / Mark contacted / Delete.
- REQUIRED once: paste FIRESTORE_RULES_enquiries.txt into Firebase Console > Firestore > Rules and Publish. Until then the form shows an error.
- If Firestore App Check enforcement is ON, website writes are rejected; leave it off for the enquiries collection or tell me.
