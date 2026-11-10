# v267 — Exam Manager me draft tests bhi (cumulative: v266 bhi shamil)

- script.js: syncTestToExamManager ab draft ko skip nahi karta; exam doc me `isDraft` flag (publish hone par apne-aap false, wahi exam update hota hai — duplicate nahi). "Purane Tests Sync" me draft bhi.
- exam-manager.js: exam card par "📝 Draft" tag.
- index.html: button/text "draft bhi". sw.js cache v267.
- Draft delete hone par uska exam record rehta hai (Exam Manager se alag se delete hota hai) — data loss nahi.
- v266 (square cards + Back fix): app-ui.js, app-ui.css, overlay-back.js bhi isi zip me.
Upload ke baad Exam Manager me "Purane Tests (draft bhi) Sync Karein" ek baar dabayein.
