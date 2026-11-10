# v271 — Delete kiya result student ke Top Performers se bhi hatta hai (cumulative: v266–v270 shamil)

Asli wajah: student ke phone me leaderboard ka cache sirf NAYE records jodta hai (delta), delete hua record kabhi nahi hatata,
aur poora refresh 24 ghante (admin 6 ghante) me hota hai. Isliye Firestore se delete hone ke baad bhi purana naam dikhta raha.
Fix:
- exam-manager.js: result/exam delete ya "🧹 saaf karein" par institutes/{inst}/ver/main me `lbReset` (server time) badalta hai.
- student-features.js: leaderboard load se pehle (already-memoized ver doc se, extra read nahi) lbReset dekhta hai; badla ho to cache hata kar ek baar poora refresh. Device clock par depend nahi (server time compare).
- Kuch rules badalne ki zaroorat nahi (ver/main admin write already allowed).
Test ke liye: 1) v271 upload 2) Exam Manager me "🧹 Delete ho chuke OMR results..." dabayein (purane orphan ke liye) 3) student app kholein/refresh.
Files: exam-manager.js, student-features.js, sw.js(v271) + pichle sab.
