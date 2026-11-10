# v270 — OMR result delete ka asar student side par bhi (cumulative: v266–v269 shamil)

Bug: Exam Manager me sheet/result delete karne par student ke "My Results"/Top Performers me wo marks bane rehte the
(studentRecords `omr_<exam>_<id>` + studentScanReports delete nahi hote the).
Fix (exam-manager.js):
- Result delete (aur duplicate-roll replace) -> student ka record + scan report bhi delete, leaderboard/My Results cache refresh.
- Poora exam delete -> uske sabhi results ke student records bhi delete.
- Naya button (Exam Manager list, "Purane Tests Sync" ke neeche): "🧹 Delete ho chuke OMR results student side se hatayein" —
  pehle se delete hue results ka bacha hua record ek baar me saaf karta hai (sirf isi institute ke "OMR Scan" records check hote hain).
Files: exam-manager.js, index.html, sw.js (v270).
