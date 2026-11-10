# v120 — owner-panel.js + exam-manager.js bhi lazy kar diye (281 KiB)

## Kya problem thi
v119 tak sirf 8 heavy CDN libraries + 5 question-bank files lazy thi.
Lekin do bade LOCAL files abhi bhi **har single visitor** (student ho
ya admin ho, matlab hi na ho) ke liye `<script defer>` se eager
load ho rahi thin:

- `exam-manager.js` — 231 KiB — sirf Admin ke "🗂️ Exam Manager" tab
  ke liye
- `owner-panel.js` — 50 KiB — sirf Owner (1 banda) ke liye

Yeh dono milaakar 281 KiB JS thi jo Slow-4G jaisi conditions mein
FCP/LCP ko seedha badha rahi thi, kyunki browser ko yeh sab parse
karne se pehle hi neeche wala content render karne mein deri hoti
thi.

## Fix
Dono files ab `window.__ensureLib()` (wahi loader jo v115 se 8 CDN
libraries ke liye use ho raha hai) se load hoti hain — sirf tabhi
jab actual zaroorat pade:

- **Exam Manager** → Admin jab OMR hub mein "🗂️ Exam Manager" sub-tab
  kholta hai (`script.js` → `showOmrSubTab()`), ya jab list ke andar
  "+ Naya Exam Banayein" button dabata hai.
- **Owner Panel** → jab "🏢 Owner Panel Kholein" button dabaya jaata
  hai.

## Ek zaroori dependency handle ki
`owner-panel.js` mein ek chhota top-level global tha
(`window.SAVYA_CLASS_OPTIONS` — 4 classes ki list) jo `script.js`,
`exam-manager.js`, aur `id-card.js` teeno turant (page-load par hi)
use karte the, hamesha `|| fallback` ke saath. Agar owner-panel.js
lazy kar dete bina kuch aur kiye, to yeh teeno files ko owner-panel.js
load hone tak sirf adhoora fallback list milta.

**Fix:** wahi 4-class list ab `index.html` ke `__ensureLib` wale
inline script mein bhi turant define hai (eager, chhota-sa, ~150
bytes) — asli SAVYA_CLASS_OPTIONS ki hi copy. owner-panel.js baad mein
load hone par wahi values dobara assign karti hai — harmless.

## Service Worker
`sw.js` ke precache list se bhi `exam-manager.js` aur `owner-panel.js`
hata di gayi (jaisa v117 mein question-bank files ke liye kiya tha) —
warna Service Worker install ke waqt hi yeh 281 KiB har naye visitor
ke liye background mein download kar leta, jo isi fix ka maksad hi
khatam kar deta. Cache name bhi bump kiya (`v120-lazy-examgr-owner`)
taaki purane installed Service Workers turant naya version pick
karein.

## Verify kiya
- `script.js`, `sw.js` — `node --check` se syntax-clean.
- `index.html` ke saare 8 inline `<script>` blocks (asli HTML parser
  se extract karke, comments ke andar "<script>" jaise false-positive
  text ko ignore karte hue) — sab `node --check` se syntax-clean.
- `SAVYA_CLASS_OPTIONS` ka poore repo mein har use-site check kiya —
  sab jagah `window.SAVYA_CLASS_OPTIONS || fallback` pattern hai,
  isliye race-safe hai.
- `owner-panel.js`/`exam-manager.js` ke andar koi bhi top-level
  (IIFE ke bahar) side-effect nahi mila jo page-load par turant
  chalna zaroori ho — dono poori tarah IIFE ke andar hain, sirf
  `window.*` par function definitions rakhte hain.
- Do entry-point buttons (Owner Panel kholna, Naya Exam banana) ko
  race-safe wrapper (`__openOwnerPanelSafe`, `__examgrOpenAddSafe`)
  diya — pehle library ensure, phir asli function call — taaki agar
  koi bahut fast click kare bhi to error na aaye.

## Result (expected)
Eager local JS: ~980 KiB → **~699 KiB** (~29% kam) har normal
student/admin page-load par. TBT pehle se hi thik tha (590ms); yeh
fix FCP/LCP/Speed Index ko target karta hai jo abhi bhi red the.

## Deploy
Poori repo (saari files) overwrite karke deploy karein — file COUNT
same hai (kuch bhi delete nahi hua), isliye pichli baar wali 100-file
GitHub web-upload limit yaad rakhein (batches mein ya `git push` se
karein). Deploy ke baad:
1. Student/Admin normal login+test flow test karein — kuch nahi
   badalna chahiye.
2. Admin "Exam Manager" tab khol ke check karein — list load honi
   chahiye jaisi pehle hoti thi.
3. "🏢 Owner Panel Kholein" button se Owner login check karein.
4. 1-2 min baad PageSpeed dobara chalayein.
