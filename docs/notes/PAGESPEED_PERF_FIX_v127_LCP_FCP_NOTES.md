# v126 — Mobile Performance 36 → target 80+

PageSpeed Insights (mobile) 36 tha jabki Accessibility 90, Best
Practices 96, SEO 100 the — matlab ek-do specific cheezein hi score
neeche khainch rahi thi, poora app nahi.

## Kya mila (root causes)

1. **Hardcoded 2200ms splash delay** — `index.html` mein
   `SPLASH_DURATION_MS = 2200` tha, jo har visit par jabardasti
   2.2 second wait karwata tha chahe page turant ready ho jaaye.
   Fade-out (+500ms) milakar 2.7s+ ka pure artificial delay tha,
   jo LCP/Speed Index dono ko seedha neeche kheenchta tha.
2. **Google Fonts + `theme-picker.css` render-blocking the** —
   pehle se hi `creative-dashboard.css`/`exam-manager.css`/
   `id-card.css` ke liye print-media trick use ho rahi thi, lekin
   yeh do render-blocking reh gaye the.
3. **JS/CSS files unminified the** — `script.js` akela 444 KB tha
   (comments/whitespace ke saath), poora app ka CSS bhi unminified.

## Kya fix kiya

1. `SPLASH_DURATION_MS`: 2200 → **400ms** (bas ek chhota brand
   flash, content ka artificial wait khatam).
2. Google Fonts stylesheet + `theme-picker.css` ko wahi print-media
   trick di jo already baaki 3 admin CSS files pe hai (`<noscript>`
   fallback ke saath — JS-disabled par bhi load ho jaayenge).
3. Saari first-party `.js` aur `.css` files ko **esbuild** se
   minify kiya (`--minify --charset=utf8` — Hindi/Devanagari text
   ko unicode-escape hone se bachane ke liye zaroori tha, warna
   question-bank files ulta bhaari ho jaati). Har file `node --check`
   se syntax-verify ki gayi minify ke baad.
   - `script.js`: 444 KB → 232 KB (~48% chhota)
   - `exam-manager.js`: 231 KB → 76 KB
   - `qgen-app.js`: 149 KB → 82 KB
   - `styles.css`: unminified → 39 KB
   - (aur baaki sab first-party JS/CSS bhi)
4. Global variable/function names ko **rename nahi kiya** —
   esbuild bina bundling ke top-level identifiers ko chhedta nahi,
   isliye ek script doosri file (jo global se access karti hai)
   ko todega nahi. Sirf comments/whitespace/dead-code hata.

## Kya nahi chheda
- `script.js`, `styles.css` waghera ke asli logic/CSS rules bilkul
  same hain — sirf comments/whitespace hataye, koi feature/behavior
  change nahi.
- `solids-lab-source.jsx` ko chhua tak nahi (Babel isko raw JSX
  chahiye, minify karna galat hoga).
- `OWNER_CLOUD_FUNCTIONS_optional.js` ko chhua nahi (yeh Firebase
  Cloud Functions backend code hai, browser mein load hi nahi hota).
- Firebase SDK/CDN scripts (already external, already minified by
  Google) — unhe chheda nahi.

## Ab bhi bacha hua (agar 90+ chahiye, future scope)
- `index.html` khud 4636 lines ka hai — Admin/Exam-Manager/OMR ka
  poora hidden markup bhi student ke pehle load mein DOM mein aata
  hai (Lighthouse "excessive DOM size"). Isko lazy-render karna ek
  bada, alag refactor hoga.
- Asli JS bundling/code-splitting (webpack/esbuild bundle mode)
  isse aur chhota kar sakta hai, lekin filhaal poora app bina
  build-step ke plain `<script defer>` tags se chalta hai — bundle
  karne ke liye deploy pipeline mein badlaav chahiye hoga.
- Image formats (WebP/AVIF) — abhi JPEG/PNG hain, size already
  chhota hai (48 KB splash) isliye zyada fark nahi padega.

## v127 update — 36→55 ke baad (FCP 4.9s, LCP 9.8s the)

v126 deploy karne ke baad score 36→55 hua, lekin FCP/LCP abhi bhi lal
the. Do naye, zyada bade structural culprit mile:

1. **Install-popup aur splash-hide dono `DOMContentLoaded` ka wait
   kar rahe the.** `DOMContentLoaded` sirf tab fire hota hai jab is
   se PEHLE declare kiye gaye SAARE `<script defer>` — 4 Firebase SDK
   files + `script.js` (232 KB) + 10+ aur files — poori tarah
   download+execute ho chuke hon. Yeh poori chain khatam hone tak
   splash na hatta tha na install-popup (jo screen ka sabse bada
   visible element hai — LCP candidate) dikhta tha. Isi wajah se LCP
   9.8s tak chala jaata tha, jabki in dono cheezon ka in files se
   koi lena-dena hi nahi hai.
   - **Fix**: dono ko `DOMContentLoaded` listener se nikaal ke turant
     chalne wala IIFE bana diya — dono scripts pehle se hi is tarah
     document mein position kiye hain ki jab tak parser wahan
     pahunchta hai, unhe chahiye wala DOM already ban chuka hota hai
     (defer scripts ke poora hone ka wait karne ki zaroorat nahi thi).
2. **`styles.css` (39 KiB) render-blocking tha** — first paint
   iske CSSOM-parse hone tak rukta tha. Ab yeh bhi wahi print-media
   trick use karta hai jo theme-picker/fonts ke liye v126 mein lagayi
   thi. Safety-net ke taur par ek chhota inline `.hidden{display:
   none!important}` rule bhi `<head>` mein daala hai — splash-screen
   anyway ~900ms tak poori screen dhaanke rakhta hai, isliye is
   window mein CSS load ho jaane se koi unstyled-flash user ko kabhi
   dikhta hi nahi.

Dono fix pure timing/loading-order changes hain — koi feature,
popup-logic, ya cooldown-behavior nahi badla, sirf WOH turant chalte
hain jo pehle jabardasti 5-9 second wait karte the.

## Deploy
Same tarike se — is zip ki saari files upload/push karein (URLs/
filenames bilkul same hain, sirf content chhota/fix hua hai — koi
naya file naam nahi, koi `sw.js` precache-list change nahi chahiye).
Deploy ke baad PageSpeed Insights dubara chalayein aur naya score
dekhein.
