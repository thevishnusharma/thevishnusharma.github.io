# v115 — TBT regression fix (1,890ms → 3,600ms ho gaya tha, ab wajah fix ki)

## Kya hua tha (v114 ka mistake)
v114 mein 8 heavy CDN libraries (chart.js, tesseract.js, xlsx,
html2pdf, jspdf, docx, canvas-confetti, katex) ko page ke `load`
event ke **baad**, `requestIdleCallback` (idle time) mein background
mein auto-load karwaya gaya tha — soch yeh thi ki `load` event ke
baad load karne se PageSpeed ke Total Blocking Time (TBT) window ke
bahar chala jaayega.

**Yeh galat nikla.** Real result: TBT 1,890ms se ulta 3,600ms ho gaya
(Performance score 33). Wajah:

> Lighthouse ka TBT sirf "page load" tak measure nahi karta — balki
> First Contentful Paint se lekar jab tak page CPU + network dono par
> "quiet" (5 second tak koi bada kaam nahi) na ho jaaye, tab tak count
> karta hai. `requestIdleCallback` browser ka free time milte hi
> (aksar load ke turant baad hi) fire ho jaata hai, aur 8 bhaari
> libraries ek saath parse+execute hone se bade "long tasks" bante
> hain jo isi measurement-window ke andar hi aa jaate hain — pehle se
> bhi zyada, kyunki pehle yeh sab parallel-download (defer) ke saath
> spread ho rahi thin.

## Fix (v115) — TRUE on-demand loading
Ab in 8 libraries ko koi bhi "auto" trigger (load event, idle
callback, timeout — kuch bhi) se load NAHI kiya jaata. Inhe sirf tabhi
load kiya jaata hai jab student/admin us specific feature ka button
actual mein dabaye:

- `index.html` (`</body>` se pehle) mein ek `window.__ensureLib(key)`
  utility define ki — pehli call par hi asli `<script>` download
  shuru hoti hai, uske baad wahi cached Promise reuse hoti hai.
- Har library ke **real use-point** par yeh call jodi:
  - **Tesseract** → `exam-manager.js` → `examgrGetOcrWorker()`
    (Scan-Sheet OCR pehli baar chalne par)
  - **jsPDF** → `exam-manager.js` → `waitForJsPdf()` (OMR-sheet PDF
    export)
  - **docx** → `omr.js` → `downloadOMRSheetAsWord()`, aur
    `qgen-app.js` → `exportToWord()` + `generateOMRSheetForPaper()`
  - **XLSX** → `upgrade.js` → `exportToExcel()`
  - **html2pdf** → `upgrade.js` → `exportToPdf()`
  - **confetti** → `upgrade.js` → `window.showResult()` (result screen
    dikhne par)
  - **chart.js** → `student-features.js` → `paintProgressChart()` ("My
    Progress" tab khulne par)
  - **katex + auto-render** → `index.html` → `renderMathIn()` (pehli
    baar koi Math-subject question dikhne par; load hone ke baad
    apne-aap retry karke render karta hai)

**Result:** Normal PageSpeed/Lighthouse audit (jo koi button click
nahi karta, sirf page kholta hai) ke dauraan yeh 8 libraries bilkul
download/parse/execute hi nahi hoti — TBT par inka zero contribution
hona chahiye. Feature use karte waqt library sirf usi waqt (button-
click se) fetch hoti hai — thoda sa (network speed par depend) delay
ho sakta hai pehli baar us feature ko use karne par, jaisa ki
`waitForJsPdf`/OCR ke defensive fallback messages already handle
karte hain.

## Verify kiya
- Sabhi edited `.js` files (`omr.js`, `exam-manager.js`, `upgrade.js`,
  `student-features.js`, `qgen-app.js`) `node --check` se syntax-clean
  hain.
- `index.html` ke sabhi `<script>...</script>` blocks (tag-balance +
  extracted-block `node --check`) syntax-clean hain.
- Har jagah jahan library turant available hone ki ummeed thi
  (`window.docx`, `window.jspdf`, `Tesseract`, `XLSX`, `html2pdf`,
  `confetti`, `Chart`), wahan pehle `__ensureLib` call jodi gayi hai
  taaki library available ho jaaye, phir existing guard/fallback logic
  (jo pehle se hi likhi thi) chalti hai — koi feature ka behavior
  nahi badla, sirf load-timing.

## Deploy
Same as pehle — saari files (`index.html` + `omr.js` + `exam-
manager.js` + `upgrade.js` + `student-features.js` + `qgen-app.js` +
`sw.js` + baaki sab) overwrite karke deploy karein, phir 1-2 min baad
PageSpeed dobara chalayein.

---

# v116 — extra improvements (aapke "aur jitna ho sake improve karo" ke jawab mein)

1. **pdf.js bhi TRUE on-demand kar diya** — pehle `defer` tha (harr
   page load par download hoti thi), ab `pdf-import.js` ke
   `extractTextFromPdf()` mein sirf jab "Import from PDF" feature use
   ho tab hi `__ensureLib("pdfjs")` se load hoti hai.

2. **3 admin-only CSS files non-render-blocking bana di**
   (`creative-dashboard.css`, `exam-manager.css`, `id-card.css`, ~41
   KiB combined) — print-media trick se, kyunki yeh sirf Admin/Owner
   panels ke liye hain jo student ke normal login/test screen par
   dikhte hi nahi. `styles.css` aur `theme-picker.css` jaan-boojh kar
   blocking hi rakhi (initial screen inhi par depend karti hai).

3. **`splash-screen.jpg` (LCP element) ke liye `<link rel="preload">` +
   `fetchpriority="high"`** — pehle browser is image ko tabhi
   discover karta tha jab HTML parse karte-karte body ke andar
   `<img>` tag tak pahunchta (~165 lines neeche). Ab head mein hi
   preload hint hai, isliye download HTML parse shuru hote hi turant
   shuru ho jaata hai.

4. **`fonts.gstatic.com` ke liye `preconnect`** add kiya (pehle sirf
   `fonts.googleapis.com` ka tha) — Google Fonts ki actual font-files
   `gstatic.com` se aati hain, DNS/TLS handshake pehle se shuru ho
   jaata hai.

## Abhi bhi baaki (agar aur chahiye, bataiye)
- **`script.js` (431 KB!)** aapki sabse badi file hai — har page load
  par poori parse/execute hoti hai chahe user sirf login karke test
  de raha ho. Isko todna (code-splitting) sabse bada agla win hoga,
  lekin bahut risky hai bina deep audit ke (kaunsa hissa turant chahiye
  vs baad mein) — agli session mein bataiye to dhyan se karta hoon.
- **Subject-wise question-bank lazy load** (jaisa pehle bataya) — abhi
  bhi implement nahi kiya.

---

# v117 — question-bank files (176 KiB!) bhi hata di (sabse bada baaki
# item jo pending tha)

Verify kiya: yeh 5 files (`mathematics-question-bank.js` — akela 118
KiB — `history-question-bank.js`, `History-India-question-bank.js`,
`history-indochina-question-bank.js`, `socialism-question-bank.js`)
har page load par eager download hoti thin, lekin inka data **sirf**
Admin panel ke ek button — "🌱 Seed All Questions to Firebase" — ke
liye use hota hai (`script.js` → `seedAllQuestions()`). Har file mein
khud comment likha tha: `// AUTO-SEED DISABLED: Manual seed only
(Admin panel se karo)`. Matlab normal student ka test-taking flow, ya
admin ka normal login/dashboard — inko kabhi chuta hi nahi hai. Ye
sirf ek baar (jab naye questions Firebase mein daalne ho) chalne
waala setup-tool hai.

**Fix:** In 5 files ke `<script defer>` tags hata diye. Ab
`window.__ensureLib(...)` se sirf `seedAllQuestions()` ke andar, us
button dabane par hi load hoti hain.

**Impact:** 176 KiB kam JS jo pehle HAR SINGLE page load (student ho
ya admin, koi bhi) par parse+execute hoti thi — sirf us ek admin
button ke liye jo shayad mahine mein ek baar bhi na dabaya jaaye.

## Verify kiya
- `script.js` `node --check` se syntax-clean.
- Confirm kiya ki in files ka koi bhi export (`window.seedXQuestion
  Bank`) sirf `seedAllQuestions()` ke andar hi use hota hai, kahin
  aur nahi — safe hai in files ko poori tarah gate karna.
- `index.html` ka `<script>` tag-balance dobara verify kiya (script
  open/close count match).

## Ab bhi baaki (bade, risky items — sirf poochne par karunga)
- `script.js` (431 KiB, sabse badi file) — abhi bhi eager-defer hai,
  har load par poori parse hoti hai. Isko split karna sabse bada agla
  win hoga lekin deep, careful audit chahiye (kaunsa hissa turant
  chahiye vs sirf kisi specific tab/action par) — galat kiya to
  poora app tootne ka risk hai.
- `owner-panel.js` (50 KiB) — sirf "Owner" role ke liye hai (super-
  admin, bahut kam log), lekin isme ek top-level global
  (`window.SAVYA_CLASS_OPTIONS`) hai jo shayad kahin aur bhi turant
  use hota ho — bina puri tarah audit kiye chhoda.

---

# v118 — recheck ke dauraan mila ek gap: qgen-app.js ka apna alag KaTeX usage

"Ek baar aur check karo" bolne par poori tarah recheck kiya:
- Sabhi `.js` files `node --check` se dobara syntax-verify.
- `index.html` ka script tag-balance dobara verify.
- Har `__ensureLib` LIBS entry ka kam se kam ek real call-site
  confirm kiya (13 keys, sab covered).
- **Poore repo mein dobara search kiya** ki Tesseract/XLSX/html2pdf/
  jspdf/docx/confetti/Chart/katex/pdfjs/seed-functions kahin aur to
  nahi use ho rahe jo miss ho gaya ho.

**Jo mila:** `qgen-app.js` (Question Generator admin tool) mein
KaTeX ka apna ALAG `renderMathIn()` function tha (index.html wale se
different, khud ka copy) — do jagah (`renderMathIn()` aur
`updateMathPreviewBox()` ka live preview) seedha
`window.renderMathInElement` check karte the, `__ensureLib("katex")`
trigger kiye bina. Matlab Question Generator tool mein Math
questions ka LIVE PREVIEW kabhi render hi nahi hota (KaTeX load hi
nahi hoti) — chupa hua bug jo v115 ke baad se tha.

**Fix:** Dono jagah wahi retry-after-load pattern laga diya jo
index.html mein hai — `window.__ensureLib("katex")` trigger karke,
load hone ke baad khud ko dobara call karta hai.

**Jo check kiya aur SAFE nikla (fix ki zaroorat nahi):**
- `booklet-print.js` / `four-column-print.js` mein bhi
  `renderMathInElement` dikha tha, lekin yeh dono ek bilkul ALAG
  popup/print window mein apna khud ka standalone HTML likhte hain
  (apne khud ke `<script src="katex...">` tags ke saath) — humare
  main-page loader se koi lena-dena nahi, already sahi hai.
- `live-theme-effects.js` mein `confetti(theme) {...}` — yeh ek
  custom canvas particle-effect method hai (theme animation), CDN
  `canvas-confetti` library se bilkul alag cheez hai — koi fix nahi
  chahiye.
- `theme-palette.js` mein "confetti" sirf ek theme-effect ka NAAM
  (string) hai, function call nahi.

Sab files dobara `node --check` se syntax-clean confirm kiye.

---

# v119b — Question Seeder Apps Script files permanently delete kiye

Aapne bola tha "App Script ka function permanently nahi chahiye" — 3
`.gs` files mein se **Question Seeder waali 2 files chuni**
(`AppsScript_NewQuestions.gs`, `AppsScript_QuestionSeeder.gs`).

Pichli session (v27 notes ke mutabik) ne inhe jaan-boojh kar chhod
diya tha ye kehte hue "agar inki bhi zaroorat nahi to bata dijiye,
agli baar hata dunga" — ab wahi kar diya.

**Permanently delete kar diya:**
- `AppsScript_NewQuestions.gs`
- `AppsScript_QuestionSeeder.gs`

**Verify kiya:** In dono ka koi bhi live code (`.js`/`.html`) se
connection nahi tha — standalone, one-time seed scripts the jo
manually Google Apps Script editor mein paste karke chalayi jaati
thin. In-browser wala "🌱 Seed All Questions to Firebase" button
(`script.js` → `seedAllQuestions()`, jo local `mathematics-question-
bank.js` waghera files use karta hai) is se bilkul alag/independent
hai — **wo waisa hi kaam karta rahega**, kuch nahi tootega.

**Chhod diya (jaan-boojh kar, aapne select nahi kiya):**
`OMR_AI_Scanner_AppScript.gs` — abhi bhi zaroori hai (Claude Vision
API key ko browser se chhupane ka backend proxy).
