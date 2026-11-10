# v153 — Analysis cleanup, proper Settings, Help & Support, header-button bug fix

## Bug fix
- Header ke profile icon / bell / menu (☰) buttons `<form id="student-form">` ke andar the aur unme `type="button"` nahi tha,
  isliye click par form submit ho jata tha -> "Pehle upar se ek test select karein." alert.
- Fix: teeno buttons par `type="button"` + `preventDefault()`. Saath mein form par capture-phase guard
  (bina type wala koi bhi button ab submit nahi karega) aur Tests search box me Enter dabane par submit band.

## Analysis
- "Chapter Wise Performance" aur "Performance Analysis" rows hata di gayi.

## Settings (student-settings-card)
- Appearance: Theme chunein, Text size (Chhota/Normal/Bada)
- Exam: screen on rakhein toggle (Wake Lock, default OFF)
- App & Data: Update check, Cache saaf karke refresh (login bana rehta hai)
- Help & Support, About App
- Notifications (pehle se the), Logout ab sabse neeche

## Help & Support / About
- Call 9525208263, WhatsApp, Email vishnu1234stm@gmail.com + 3 FAQ
- More page ke "Help & Support" / "About App" ab asli pages kholte hain (pehle sirf toast tha)

Files: app-ui.js, app-ui.css (?v=5), sw.js (cache v153), index.html (css version only)

## v154 — Real Notifications list (bell)
- Bell ab Notifications page kholta hai; naya test publish hote hi entry judti hai (SavyaPush.notifyTestPublished hook), last 30 save.
- Unread par bell pe laal dot, page khulne par read; trash icon se sab saaf; entry tap -> Tests tab.

## v155 — Admin se Student notifications (in-app)
- Data: institutes/{instituteId}/notifications/{id} {type, title, body, createdAt, createdBy, testId?}
- admin-notify.js (naya): Admin dashboard par "🔔 Notification" card -> title+message bhejo, purani list, delete.
  Naya test publish hote hi auto-notification (doc id t_<testId> => ek test ki ek hi baar).
- app-ui.js: student bell ab server notifications padhta hai (limit 15, 60s throttle, app khulne/visible hone par),
  unread dot, "clear" se purani hide.
- firestore.rules: institutes/{id}/notifications ka naya match — **rules DEPLOY karna zaroori** (warna permission error).
- Abhi band-app push (FCM) shamil NAHI hai — alag setup chahiye.
