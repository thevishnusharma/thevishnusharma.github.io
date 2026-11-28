# Smart Attendance v2 — GPS + Dynamic QR + Manual

Purane attendance system (`attendance-system.js`) ke upar upgrade. Purana data/NFC/Absent list/Schedule jaise the waise chalte hain.

## Deploy (4 steps)
1. **Worker deploy**: `push-worker/worker.js` (naye endpoints `/attendance/*`). Optional secrets:
   - `ATT_SECRET` — QR signing key (na do to service-account key se bante hai; dena behtar hai)
   - `ATT_NOTIFY_URL` — parent SMS/WhatsApp webhook (na do to notification sirf log hoti hai: "Queued")
2. **Firestore rules publish**: `firestore.rules` (attendanceLive / attendanceRecords / attendanceAudit / attendanceNotifications; school GPS students se private).
3. **Site deploy** (GitHub Pages): naye files `attendance-v2.js`, `attendance-v2-student.js`, `attendance-v2.css`, `qr-lite.js`; `index.html` aur `sw.js` update.
4. **Admin → Attendance Settings** me school ki GPS location lagayein ("Meri abhi ki location lagayein" school ke andar khade hokar) aur Save karein.

## Admin menu (sirf 4, baaki tabs ke andar)
- **🗓️ Attendance** → Aaj ka haal (7 cards, charts) | Class Schedule
- **▶️ Attendance Lagayein** → 📱 QR se (Start Session / Live QR) | ✍️ Haath se (Manual) | ⏳ Jaanch baaki (Pending)
- **📊 Reports** → Reports (11 types) | Student ka record | Absent list | Badlav ka record (Audit + Notifications)
- **⚙️ Settings** → Attendance Settings (3 basic cheezein + Advanced) | NFC Cards

## Flow
Teacher: Start Session → projector par QR (har 30s naya) → students scan → live counter → End → Pending review → Final Submit (absent ab tay hote hain).
Student: Attendance tab → Live card → GPS check → QR scan → Present / Late / Pending.

## Rules jo server lagata hai
- Duplicate: ek session me ek student = ek record (atomic create).
- Pending kabhi Absent nahi gina jata (jab tak `pendingPolicy=auto_absent_24h` na ho). Parents ko Absent message sirf Final ke baad.
- Confirmed attendance badalne par kaaran zaroori + Audit Log.
- School GPS coordinates students ko kabhi nahi milte; student ki raw location store nahi hoti (sirf doori/accuracy).
- Settings sirf Worker se save hoti hain (validation + audit).
- Band karne ke liye: `SNAP_CONFIG.attendance = false`.

## Defaults jo maine liye
Firebase + Cloudflare Worker (Supabase nahi) · Admin = Teacher · Batch = Class+Section · School GPS Settings me.

## Android APK: location permission (IMPORTANT)
`scripts/android-prepare.js` ab har APK build me `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` jodta hai (pehle sirf Owner app me tha — isi wajah se "User denied Geolocation" aata tha). **APK dobara build karke install karein** (GitHub Actions → build-android). Install ke baad pehli baar location maangne par **Allow** dabayein.
Website (Chrome) par: address bar ke 🔒 → Permissions → Location → Allow.
Jab tak naya APK na bane: Attendance Settings me Google Maps se coordinates paste karke school location set ho sakti hai.
Play Store par location use ki privacy policy/declaration update karni pad sakti hai.
