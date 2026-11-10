# Batch Management System (v157) — Phase 1

## Nayi files
batch-system.js, batch-system.css (+ index.html me 2 lines, sw.js cache, firestore.rules me batches block)

## Owner ko karna hai
1. Firebase Console -> Firestore -> Rules -> firestore.rules paste -> Publish (zaroori, warna "permission-denied").
2. GitHub par saari files upload (batch-system.js/.css, index.html, sw.js, firestore.rules).
3. Admin -> Dashboard -> "Batch Management" card.

## Kya kaam karta hai
Admin: Dashboard (real counts), Batch CRUD (activate/deactivate, safe delete), Live Class schedule + Go Live / End,
Recorded Lectures (Processing -> Ready -> Published/Unpublished/Failed/Retry), Notes & Study Material, PPT,
Announcements, Students enrollment (limit check), audit logs.
Student: bottom nav "Batch" + Home card: My Batches, Live Now/Join, tabs (Overview, Live, Recorded, Notes,
Study Material, PPT, Tests link, Announcements), in-app viewer.

## Jaan-boojh kar alag (free tier / architecture)
- Files Firebase Storage me nahi: Drive/YouTube/https link (Storage = paid plan).
- Live = Jitsi (meet.jit.si, config liveDomain se badal sakte hain). Automatic recording NAHI hoti: class end par recording
  "Processing" banti hai, admin link jodta hai tab "Ready". Auto-recording ke liye paid provider + Cloud Functions (Blaze) chahiye.
- Student security: students anonymous-auth hain, isliye rules "student kis batch ka member hai" verify nahi kar sakte. Admin-side
  isolation (write + draft read) server-side enforced hai; student-side client-trusted (app ka purana design).
- Pending (Phase 2): Assignments/Doubts, batch-wise test assign, Reports page, teacher accounts, batch-wise push, 2-institute rules test.

## Update (v157b)
- Student: "Batch" me ab 2 tab — My Batches / Available. Available me admin ke bane published batches dikhte hain,
  "Enroll Request bhejein". Admin: Batch Management -> Students me "Enrollment Requests" -> Approve/Reject. (Batch form me
  Enrollment = request / band.)
- Live class: 2 mode — "Meri app ke andar (Jitsi)" ya "Doosri app ka link (Zoom/Meet/YouTube)". External me Go Live par link daalte hain.
  Note: public meet.jit.si ka embed time-limited ho sakta hai; apna Jitsi/JaaS domain SNAP_CONFIG.liveDomain me daal sakte hain.
- Notes/PPT/Recording: direct file upload + link dono. Storage ON ho to 50MB; warna auto-fallback Firestore me max 4MB.
- Naya rules: firestore.rules (requests, files) + storage.rules (Storage ON karne par).

## Update (v157c) — Paid batches (UPI QR)
- Batch form me "Batch Fee ₹" (0 = free).
- Admin: "Payment Setup (UPI QR)" me apna QR screenshot + UPI ID save. "Payments" me sab approved payments + total.
- Student: paid batch par "Enroll & Pay ₹X" -> QR/UPI link -> UTR (+screenshot) bhejta hai -> admin Enrollment Requests me
  UTR/screenshot dekhkar apni UPI app me paisa check karke Approve karta hai.
- Payment AUTOMATIC verify nahi hoti (gateway/server nahi). Rules me amount = batch fee aur UTR zaroori hai, par UTR asli hai ya nahi admin check kare.
- Naye rules: firestore.rules dobara publish karein.
