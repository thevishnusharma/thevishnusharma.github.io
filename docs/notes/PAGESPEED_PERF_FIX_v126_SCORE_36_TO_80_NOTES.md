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

## Deploy
Same tarike se — is zip ki saari files upload/push karein (URLs/
filenames bilkul same hain, sirf content chhota/fix hua hai — koi
naya file naam nahi, koi `sw.js` precache-list change nahi chahiye).
Deploy ke baad PageSpeed Insights dubara chalayein aur naya score
dekhein.
