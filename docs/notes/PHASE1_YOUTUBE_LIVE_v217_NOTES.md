# Phase 1 — YouTube Live (v217, web 1.4.12)

## Deploy
1. Firebase Console -> Firestore -> Rules: `firestore.rules` paste karke **Publish** (ytId aur youtubeChannelUrl ke naye checks).
2. GitHub par zip ki files upload karo. Worker me is phase me kuch nahi badla.

## Phone par test checklist
- Class banao -> Go Live -> galat link (error aaye), sahi `youtube.com/live/ID` (live ho).
- Student: Join -> embed khule; attendance me ek entry; "YouTube me kholein" button chale.
- End Class -> Recorded Lectures me "Ready for Review" item; Publish karke student me Play.
- Bulk YouTube Add: 3 lines paste (ek galat, ek duplicate) -> preview laal -> Save.
- Institute Settings -> channel link save -> student dashboard par link.
- Purani class (sirf `liveUrl`, bina `ytId`) ab bhi link kholti hai.

## Rollback
`SNAP_CONFIG.youtubeLive=false` (app-config.js) ya GitHub me commit Revert. Naye fields optional hain.

## Dhyan do
- Unlisted link forward ho sakta hai; poori suraksha nahi.
- Kuch videos me embed band hota hai; fallback button hai.
- Attendance = "Join dabaya". Embed ke andar ka watch-time nahi pata chal sakta.
- Chalaya nahi: `npm run test:rules` (emulator), phone/browser UI, oEmbed title (CORS pakka nahi; fail ho to "YouTube Lecture ID" title lagta hai).
