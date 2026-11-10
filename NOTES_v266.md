# v266 — Admin square cards + Batch Back button fix

1. Tests & Papers / Students & Results / More pages ab Home ke Quick Actions jaise SQUARE cards (2 column, wahi rang/badge/arrow) me dikhte hain. (app-ui.js `aCards/aPage`, app-ui.css)
2. Back button fix: Batch (admin + student) aur admin/student pages (Tests, Students, More...) pehle history me nahi the, isliye Back kaam nahi karta tha. Naya `overlay-back.js` (back-button-guard.js se pehle load):
   - Batch ke andar kisi section me ho -> Back = Batch Dashboard; phir Back = Admin Home
   - Batch me popup/viewer khula ho -> Back = pehle wo band
   - Student batch ke andar -> Back = My Batches; phir Home
   - Tests/Students/More page -> Back = Home
   - Koi overlay khula na ho to purana guard hi kaam karta hai (exam/solution wale rules same)
3. sw.js cache v266 + overlay-back.js list me; index.html me script + app-ui.css?v=8.

Files: app-ui.js, app-ui.css, overlay-back.js, index.html, sw.js (flat zip, repo root me upload).
Test: Playwright (back stack: sub-view -> dash -> close, page -> home, UI close me stale entry nahi).
