# v114 — Full Site PageSpeed Fix (LCP 16.4s / TBT 1,890ms / Speed Index 9.8s)

Yeh fix pichli baar diye gaye `pagespeed-perf-fix-v28/v29` zip se ALAG
hai — us zip mein sirf `index.html` ka ek partial/purana copy tha, jo
project ke asli source se match nahi karta tha. Ye v114 fix aapke
**asli, poore website zip** (`snaptestpro-v113-idcard-debug.zip`) par
kiya gaya hai — sab files (index.html, sw.js, firebase.json, _headers,
logo, splash) isi mein included hain, deploy karne ke liye seedha ye
zip use karein.

## Fix kiye gaye root causes

### 1) Splash screen `window.onload` ka wait kar raha tha (sabse bada culprit)
Splash (fullscreen image) sirf tab hatta tha jab poore page ka `load`
event fire hota — jo tabhi hota hai jab sab CDN libraries (kai MB)
poori tarah download ho chuki hon. Fullscreen image hone ki wajah se
yehi LCP element ban raha tha.
**Fix:** `window.onload` → `DOMContentLoaded`. Splash apne fixed
2200ms ke baad turant hat jaata hai, HTML/CDN downloads ka wait kiye
bina.

### 2) 20+ local scripts (firebase SDKs, question-banks, script.js,
omr.js, exam-manager.js, etc.) mein `defer` bilkul NAHI tha
Matlab browser HTML parsing beech mein rok kar in sabko sequentially
download+execute karta tha, tabhi jaake baaki page paint hota tha —
yehi Speed Index/FCP ko bhi bura kar raha tha.
**Fix:** Sabhi ko `defer` diya. Order same rehta hai (defer scripts
document-order mein hi chalti hain), aur verify kiya ki koi bhi in
files ke turant-chalne-wala code `DOMContentLoaded` listener se bahar
nahi hai — sirf function/variable declarations hain top-level par.

### 3) 8 heavy CDN libraries (chart.js, tesseract.js, xlsx, html2pdf,
jspdf, docx, canvas-confetti, katex) — `defer` se bhi aage, TRUE
lazy-load kar diya
Pehle `defer` thi lekin phir bhi page ke `load` event tak (TBT
measurement window ke andar) download+parse hoti thin, chahe use ho
ya na ho. Ab yeh `</body>` se pehle ek chhote loader ke through, page
`load` event ke BAAD, `requestIdleCallback` (idle time) mein
background mein load hoti hain. Verify kiya — in libraries ka koi
top-level usage `index.html` mein nahi hai, sab button-click handlers
mein hai (`omr.js`/`exam-manager.js`/`script.js`), aur defensive
checks (`window.Tesseract`, `window.renderMathInElement`) ke saath
likhi hui hain — isliye thodi der baad load hone se koi feature nahi
tootta.

### 4) Header logo + splash image over-sized the
- `snaptestpro-logo.png`: 512×512 (241 KiB) sirf ~40px height ke liye
  → 200×200 par resize, **241 KiB → 55 KiB**.
- `splash-screen.jpg`: quality 92 → 78, **76 KiB → 46 KiB** (visually
  identical).

### 5) Cache headers (`firebase.json` + `_headers`) — images ke liye
long cache add kiya
Pehle koi bhi image (logo/icons/splash) ke liye explicit cache rule
nahi thi. Ab `*.png/*.jpg/*.jpeg/*.ico` ko `Cache-Control: public,
max-age=604800` (7 din) diya — repeat visits par yeh dobara download
nahi hongi. **Jaan-boojh kar `immutable`/1-saal nahi rakha** — agar
kabhi logo/splash file same naam se update ki, to purane cached users
ko turant naya nahi dikhega; 7 din ek safe middle-ground hai. Agar
future mein logo/splash badalne ka plan ho, to filename change karein
(jaise `snaptestpro-logo-v2.png`) taaki cache turant bust ho jaaye.
JS/CSS/HTML ke cache rules jaan-boojh kar NAHI chheda — wo already
`no-cache, must-revalidate` hain, jo aapki app-update-safety strategy
ke liye zaroori hai (students ko hamesha latest code milta rahe).

## Jo NAHI chheda (scope se bahar / risky bina full audit ke)
- **Question-bank files subject-wise lazy-load** — abhi bhi sab
  eager-defer hain chahe student ek hi subject chuno. Isko fix karne
  ke liye `subject-resolver.js`/`script.js` mein call-sites carefully
  audit karne honge — agli session mein bataiye to karta hoon.
- Baaki dev/test files (`test_*.js`, `*.md`, `*.gs`, `.bat`,
  `.keystore`) `firebase.json` ke `ignore` list mein already hain,
  isliye site par deploy hi nahi hoti — inka load-time par koi asar
  nahi hai.

## Deploy
`firebase deploy --only hosting` (ya jahan bhi hosted hai, saari files
overwrite karke push karein). Deploy ke 1-2 min baad
pagespeed.web.dev par dobara Mobile report chalayein.
