# v257 — ASLI KAARAN: Paper Generator purane Firebase se padh raha tha (web 1.4.43, build 257)

## Kya mila
question-generator.html me app-config.js load hi nahi hoti thi -> SNAP_CONFIG nahi -> own-backend.js band -> generator
questions apne backend ki jagah seedha PURANE FIREBASE (Firestore) se padhta/likhta tha.
Isi liye: generator me delete kiye hue questions bhi the, 9th ke naye questions (jo backend me hain) the hi nahi,
7550 vs 7499 ka farak, aur generator me upload kiye questions admin tak nahi pahunchte the.

## Fix
- question-generator.html: app-config.js ab own-backend.js se pehle load hoti hai. Ab generator bhi Question Bank ki tarah backend se padhta/likhta hai.
- qgen-reconcile.js: agar generator kabhi backend se na jude to saaf warning toast.
- recover-bank.html: backend ko X-App-Build header bheja (pehle "App update zaroori hai" 426 aa raha tha).
- Naya test: generator page me app-config.js -> own-backend.js -> firebase-config.js ka order.

## Check
Generator kholo: count Question Bank ke barabar (class 10 + class 9) aur "Class 9: N" line me dikhni chahiye.
Files: question-generator.html, index.html, qgen-reconcile.js, recover-bank.html, sw.js, version.json, package.json, app-config.js, tests/unit/test_generator_page_config_v257.js
