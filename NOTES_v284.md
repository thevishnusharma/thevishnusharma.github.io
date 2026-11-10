# v284 — Hinglish / instruction text cleanup (text-only, no logic changed)

**Version:** web 1.4.70, build 284 (version.json -> sw.js, app-config.js, package.json stamped)

## Kya badla
1. **index.html** — 43 lambe instruction paragraphs chhote/seedhe kiye (Exam Manager, OMR, Test Create form, Leaderboard, Join Code, Practice, Notifications, Records, ChatGPT OMR help...). Developer/history lines hataayi ("is feature se PEHLE...", "question bank se link nahi hai, halka record...").
2. **Exam Manager buttons** — "Registration aur Admit Card", "Purane Tests Sync Karein", "Student side ke purane OMR results hatayein".
3. **Technical shabd hataye** (admin/student ko dikhne wale messages): Firebase / Firestore / Cloudflare / client-trusted / anomaly -> "server", "online", "reads", "pakki nahi".
4. **Register ek jaisa** — "tum/bharoge/chhodo" -> "aap/bharein/chhodein".
5. **Spelling ek jaisi (poore app mein)**: jayega/jayenge/jayegi -> jaayega/jaayenge/jaayegi · sawal -> sawaal · niche -> neeche · dabayen/dabaye -> dabayein · chuniye -> chunein · dekhiye -> dekhein · bhejiye -> bhejein · kariye -> karein · apne-aap / khud-ba-khud -> apne aap.

## Jo NAHI badla
- Koi function, id, class, onclick, Firestore field ya logic nahi chhua (HTML tags identical, sirf text/placeholder/comment).
- Owner-only technical screens (owner-reads, migrate tool) ke Firebase shabd rakhe — wahan Owner ko wahi chahiye.
- Question banks aur math question generator text (bilingual questions) nahi chhue.
- frontend_repo/ folder (purani copy) nahi chhua.

## Checks
- node --check: sabhi JS pass · unit tests: 59/59 pass · check-precache OK · version stamp in sync
- Playwright (file://): index.html load, 0 page errors; Exam Manager button text naya.

## Pending suggestion (aapki approval chahiye)
"Purane Tests Sync Karein" button ek baar sync ke baad chhup jaaye (behavior change).
