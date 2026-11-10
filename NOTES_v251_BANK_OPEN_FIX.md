# v251 — App khulte hi Question Bank khali + Generator me kam question (web 1.4.37, build 251)

## Asli kaaran (code se mila)
1. App khulte hi bank-load ka check Firebase login ready hone SE PEHLE chalta tha. Tab admin pehchana nahi jata tha,
   isliye cache (IndexedDB) padha hi nahi jata aur sync shuru nahi hota tha — bas "Firebase se load karein" banner
   dikh ke ruk jata tha. Isi liye "Backend se sync" dabana padta tha.
2. Paper Generator (main app ke andar iframe) sirf pehli baar khulne par load hota tha aur baad me live-socket par nirbhar tha.
   Socket toot jaye (Render sleep / phone background) to naye question kabhi nahi aate the.
3. Poora download paging se hota hai; beech me koi doc badle to ek-do doc chhoot sakte the. Ab count se pakda jata hai.

## Kya badla
- script.js: admin ko local login-flag se bhi pehchana jata hai -> cache turant dikhta hai + sync apne-aap shuru. Apne backend par banner ruk-ruk ke nahi rokta.
- own-backend.js: (a) poora load bhi server-count se verify, chhoota to 2 baar dobara. (b) app/tab wapas dikhe ya net aaye to chupke se delta.
  (c) `SnapOwnBackend.refresh('questionBank')` naya.
- Question Bank ya Paper Generator tab kholte hi dono jagah chupke se refresh (sasta delta, Firebase reads = 0).
- Hataye gaye button ka zikr empty-state se hataya.
- index.html / question-generator.html: cache-bust (own-backend v=4, generator ?v=20261030).

## Files
own-backend.js, script.js, index.html, question-generator.html, sw.js, app-config.js, version.json, package.json,
tests/unit/test_own_backend_cache_v250.js, tests/unit/test_bank_no_auto_full_read_v235.js
(+ pichla v250 ka qgen-app.js agar abhi upload nahi kiya — is zip me bhi hai)

## Check
node --check OK. Unit tests 53/53. Naye test: cache pehle, delta, delete, chhoota doc retry, refresh().
