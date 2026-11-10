# v273 — Liquid glass smooth + neeche nav ke piche kuch na chhipe (cumulative: v266–v272 shamil)

ANALYSIS (jo mila):
1. Hamesha screen par rehne wale nav bar (#sn-nav student, #an-nav admin, .oa-tab owner) par live blur (backdrop-filter 14px) tha — scroll ke har frame par GPU ko peeche ka content dobara blur karna padta tha. Sabse bada smoothness-kharcha yehi tha.
2. Neeche ki jagah: student/admin page me padding thi, par gesture-bar (safe-area) joda nahi tha; "Powered by SmarTest Pro" footer nav ke bilkul piche aa jata tha (translucent nav se jhalakta tha); Owner app me floating "+" button last card ke upar aata tha (92px padding kam).
3. Popup ke piche nav aana (v272 me fix) — ab nav popup me chhup jata hai.
4. Pehle se theek: blur sirf kuch elements par, low-end phone par lg-lite (blur band), scan time par sab band, tap delay hata hua, smooth-scroll band.
FIX:
- app-ui.css: nav bars par blur band + 95% safed glass fill + GPU layer (translateZ). Look lagbhag wahi, scroll/tap smooth.
- #student-form / #admin-panel padding-bottom ab safe-area ke saath; footer ke neeche nav jitni jagah; Settings pages me safe-area padding.
- owner-app.html: .oa-shell padding-bottom 160px (floating + ke neeche bhi last card poora dikhe).
- Napa (Playwright, 360x640): admin Home/Tests/Students/More — last content nav se kam se kam 35px upar.
Files: app-ui.css, index.html (app-ui.css?v=10), owner-app.html, sw.js (v273) + pichle sab.
