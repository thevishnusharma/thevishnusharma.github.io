# Smart Attendance v2 — GPS + Dynamic QR + Manual

Purane attendance system (`attendance-system.js`) ke upar upgrade. Purana data/NFC/Absent list/Schedule jaise the waise chalte hain.

## Deploy (4 steps)
1. **Worker deploy**: `push-worker/worker.js` (naye endpoints `/attendance/*`). Optional secrets:
   - `ATT_SECRET` — QR signing key (na do to service-account key se bante hai; dena behtar hai)
   - `ATT_NOTIFY_URL` — parent SMS/WhatsApp webhook (na do to notification sirf log hoti hai: "Queued")
2. **Firestore rules publish**: `firestore.rules` (attendanceLive / attendanceRecords / attendanceAudit / attendanceNotifications; school GPS students se private).
3. **Site deploy** (GitHub Pages): naye files `attendance-v2.js`, `attendance-v2-student.js`, `attendance-v2.css`, `qr-lite.js`; `index.html` aur `sw.js` update.
4. **Admin → Attendance Settings** me school ki GPS location lagayein ("Meri abhi ki location lagayein" school ke andar khade hokar) aur Save karein.

## Admin menu
Attendance (Overview) · Start Session (Live QR) · Manual Attendance · Pending Review · Class Schedule · Absent Students · Student Profile · Attendance Reports (11 types, CSV/Print/PDF) · Attendance Settings · NFC Cards · Audit Log.

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
