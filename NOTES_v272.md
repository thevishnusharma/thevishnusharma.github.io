# v272 — Popup/modal ke neeche floating nav ab buttons nahi chhupata (cumulative: v266–v271 shamil)

Wajah: bottom nav (#an-nav / #sn-nav) z-index 900 tha, popup (.test-analysis-overlay) 200 — isliye "Link Karein" jaise buttons nav ke piche chhip jaate the; aur glass style se popup sheet halki transparent thi (piche ka text jhalakta tha).
Fix (app-ui.css, sirf CSS, JS nahi => koi lag nahi):
- Koi bhi .test-analysis-overlay khula ho to admin + student nav chhup jata hai (jo popup mein dikhta hai wo har jagah: Link karein, Exam details, Settings, etc.)
- Popup sheet ab solid white, neeche safe-area padding, max-height 90vh (andar scroll).
Files: app-ui.css, index.html (app-ui.css?v=9), sw.js (v272) + pichle sab.
