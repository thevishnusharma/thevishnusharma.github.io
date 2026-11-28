# v401 — Simple Admin (Batch Workspace) + Payment system hata diya

## Admin sidebar (pehle ~22 items, ab 7)
Dashboard · Batches · Students · Teachers · Institute Settings · Attendance · Admin Home

## Batch Workspace
Batches → batch par "Batch kholein ▶" → us batch ke andar tabs:
Announcements · Live Classes · Recorded · Notes · PPT · Tests · Attendance (QR / Haath se / Jaanch baaki) · Students · ⋯ Aur (Subjects & Chapters, Doubts, Reports, Bulk YouTube).
Purane views jaise the waise hain; bas ab batch chunkar unke andar khulte hain (batch dropdown chhupa diya gaya).

## Payment system PERMANENTLY hataya
- Admin: Payments, Payment Setup (UPI QR), Batch Fee field, enrollment request me UTR/screenshot/amount.
- Student: "Enroll & Pay", UPI QR/UTR form. Ab sirf "Enroll Request bhejein" -> admin approve.
- firestore.rules: payments collection rule hata diya; request create me fee/UTR shart hata di.
- Firestore me purana payments data delete nahi hua (chahein to Firebase console se `institutes/{id}/payments` aur `batchSettings/payment` manually delete kar sakte hain).
- **firestore.rules dobara publish karein.**
