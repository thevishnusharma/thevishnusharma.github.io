# v125 — 3D Solids Lab add ki (Student + Admin, dono mein)

Aapki di hui `solids_lab.jsx` file (React + Three.js interactive tool —
cylinder/cone/frustum/hemisphere/sphere/cube/cuboid banao, stack karo,
cut karke andar dekho, live Volume/Surface-Area formula dekho) ab app
mein ek naya feature hai — Student dashboard aur Admin dashboard, dono
mein "📐 Solids Lab" tile se khulta hai.

## Challenge — yeh app React/JSX use hi nahi karta
Poora SnapTestPro plain JavaScript hai (koi build-step, koi bundler
nahi — `<script defer>` tags seedhe browser mein chalte hain). Aapki
file JSX hai (`.jsx`, React hooks ke saath) — usse bina badle seedha
`<script>` tag mein daalna kaam nahi karta.

**Socha kya:** do raaste the —
1. Poora component haath se plain JavaScript mein convert kar dena
   (React.createElement calls likh kar) — 841 lines ke liye yeh bahut
   risky hai, chhoti si galti se poora widget tootne ka chance zyada.
2. Original code ko **bilkul bina chheden** rakhna, aur JSX ko browser
   mein hi (Babel ki madad se) chalane layak banana.

Doosra raasta chuna — safest tha, aapka original code jaisa ka waisa
(sirf top ki 2 `import` lines aur `export default` hataye, kyunki
in dono ka kaam yahan localStorage/globals se ho jaata hai) chal raha
hai.

## Implementation
- **`solids-lab-source.jsx`** — aapki file, bas 2 chhote badlaav ke
  saath: `import React...`/`import * as THREE...` ki jagah
  `const { useEffect, useRef, useState } = React;` (React ab CDN se
  global ke roop mein aata hai), aur `export default function` ki
  jagah plain `function` + end mein `window.SolidsLab = SolidsLab;`.
  Baaki poora logic (geometry formulas, Three.js scene, drag-to-
  rotate, cross-section cut, sab kuch) **bilkul waisa hi hai jaisa
  aapne diya**.
- **`solids-lab-boot.js`** (naya) — is feature ke khulte hi: React,
  ReactDOM, Three.js aur Babel-standalone (JSX ko browser mein hi
  compile karta hai) CDN se load karta hai, phir `solids-lab-source.jsx`
  ko fetch+compile+run karke widget mount karta hai. Mount/unmount
  dono sambhalta hai (tab band karte hi WebGL saaf ho jaata hai).
- **Chhota scoped CSS** bhi jodi (component Tailwind-jaisi class names —
  `flex`, `gap-2`, `grid-cols-2` waghera — use karta hai). Poora
  Tailwind load karne ki jagah, sirf wahi ~25 exact utility classes
  jo is widget ko chahiye, likh diye — sirf `.solids-lab-root` ke
  andar scoped, baaki site par koi asar nahi.

## Performance — bilkul waisa hi pattern jaisa exam-manager/owner-panel ke liye
Yeh sab (React+ReactDOM+Three.js+Babel — kaafi bhaari, ~1.5-2 MB total)
**kabhi bhi eager load nahi hota**. Sirf tabhi jab Student ya Admin
"Solids Lab" tile par tap kare — `__ensureLib("solidsLab")` se, wahi
lazy-loading system jo pehle se katex/xlsx/tesseract jaisi libraries
ke liye use ho raha hai. Kisi bhi normal student/admin (test dena,
bank, records) par iska koi asar nahi — PageSpeed score ya kisi aur
feature ki speed nahi badlegi.

## Kahan milega
- **Student**: Dashboard → "📐 Solids Lab" tile (Settings ke baad)
- **Admin**: Dashboard → "📐 Solids Lab" tile (Settings ke baad)

Dono jagah widget bilkul same hai — same interactive tool, taaki
Admin class mein demo bhi kar sake aur student khud practice bhi kar
sake.

## Ek zaroori seemaa (limitation)
Is sandbox mein na `npm` chal saka na internet — isliye maine JSX ko
pre-compile (build karke ek chhoti si plain-JS file bana kar) nahi
kiya, balki Babel ko HAR PEHLI BAAR khulne par browser mein hi
compile karne diya (compiled result cache ho jaata hai usi session ke
liye — dobara-dobara nahi hota). Isse do minor cheezein hain:
1. Pehli baar (har naye page-load par) khulte waqt ek chhota (kuch
   sau milliseconds) extra "compile" step hota hai — normal load se
   thoda zyada, lekin ek baar hi.
2. Feature CDN (cdnjs, unpkg) par depend karta hai — agar institute
   ke network mein yeh block hain, feature load nahi hoga (baaki
   poora app normal chalega, sirf yeh ek tile kaam nahi karegi).

Agar future mein isse aur behtar/tez banana ho (asli pre-built bundle,
Babel ki zaroorat hi na ho), woh ek alag, thoda bada kaam hoga — abhi
ke liye yeh poori tarah kaam karta hai, bas ek baar/pehli-baar thoda
sa extra load-time hai.

## Verify kiya
- `script.js`, `solids-lab-boot.js` — `node --check` se syntax-clean.
- `index.html` ke saare inline `<script>` blocks — syntax-clean.
- `solids-lab-source.jsx` — brackets/braces balanced, koi leftover
  `import`/`export` nahi bacha (khud check karke confirm kiya).
- Naye IDs (`student-solids-lab-card`, `solidslab-box`,
  `solids-lab-mount-student`, `solids-lab-mount-admin`) — sab unique
  hain, kahin duplicate nahi.
- Student aur Admin dono taraf mount/unmount (tab open/close par)
  wiring lagayi — WebGL leak na ho.

## Deploy
Same tarike se — saari files (2 nayi files ke saath: `solids-lab-boot.js`,
`solids-lab-source.jsx`) upload/push karein. Deploy ke baad test karein:
1. Student ya Admin dashboard par "📐 Solids Lab" tile dabayein.
2. Thoda (1-2 second) wait karein pehli baar — 3D scene dikhni chahiye.
3. Shape add karke drag se ghumaayein, "Cut open" try karein, formula
   panel neeche check karein.
4. Wapas dashboard par jaayein aur dobara kholein — is baar turant
   khulna chahiye (libraries pehle se load hain).
