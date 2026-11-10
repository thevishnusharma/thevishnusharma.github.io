# Booklet — Bada Font + Word (.docx) Export — v137

## Kya problem thi
1. Booklet Print (`📖 Booklet Print (Fold-able)`) ka text bahut chota tha
   (7px / 6.5px) — students ko padhne me dikkat ho rahi thi.
2. Booklet sirf print/PDF ke liye tha. Isko Word me download karke manually
   edit karne ka koi tarika nahi tha.

## Kya fix hua

### 1. Font size bada kiya (`booklet-print.js`)
Sirf font-size / spacing badhaya hai — page geometry (A4 landscape, fold
margins, 2-column imposition) bilkul same rakha hai, taaki fold-lines aur
print alignment na tooten:

| Element                        | Pehle | Ab    |
|---------------------------------|-------|-------|
| Question text (`.bp-qhead`)     | 7px   | 10px  |
| Options (`.bp-opt`)             | 6.5px | 9.5px |
| Subjective badge                | 6.5px | 9.5px |
| Header topic (`.htopic`)        | 8.5px | 11.5px|
| Header badge/meta               | 7px   | 9.5px |
| Instructions strip              | 6.5px | 9px   |
| Page number                     | 7px   | 9px   |

Pagination pehle se hi real rendered height measure karke hoti hai
(`buildLogicalPages`), isliye bada font apne aap kam questions/page fit
karega — sahi tareeke se, bina kisi extra change ke. Matlab ab thoda zyada
pages/sheets ban sakte hain (expected trade-off for readability).

### 2. Naya button: "Booklet Word (.docx)" (`booklet-print.js` + `question-generator.html`)
- Naya function: `window.exportBookletToWord()`
- Do jagah button add kiya (sidebar aur top toolbar, `printPaperBooklet()`
  wale button ke bagal me): **📄 Booklet Word (.docx)**
- Isi `docx` library (CDN, pehle se load hoti hai) aur qgen-app.js ke
  existing helpers (`docxQuestionBlock`, `htmlToDocxRuns`, `mathToWordHtml`)
  ko reuse kiya hai — matlab MCQ option table, subjective blank lines, aur
  LaTeX math (`$$...$$`, `\(...\)`, `\[...\]`) sab **regular "Download
  Word" jaisa hi** behave karenge, koi naya conversion code nahi likha.
- Output: header (Test No / Subject / Time / MM / Instructions) upar
  full-width, uske neeche same page par **2-column layout** (Word ka
  continuous section-break trick) — booklet jaisa hi look, lekin ab pura
  editable Word document hai (heading resize, text edit, options edit —
  sab manually ho sakta hai, kyunki ye real Word content hai, image/PDF
  nahi).
- File naam: `Booklet_<TestNo>.docx`. Mobile par pehle native Share sheet
  try hoti hai, warna direct download (same pattern jo `exportToWord()`
  already use karta hai).

## Test kiya
- `node --check booklet-print.js` — syntax clean.
- docx pipeline ko Node + jsdom me isolate karke test kiya (real
  `docxQuestionBlock`/`htmlToDocxRuns`/`mathToWordHtml` helpers ke saath):
  MCQ + subjective dono question types, 2-column continuous section,
  A4 landscape orientation, aur `$$...$$` math → Word OMML (native math
  object) — sab sahi generate ho raha hai, koi exception nahi.
- Playwright/browser me end-to-end nahi chala paya (is session me), isliye
  live site par ek baar Booklet Word button khud zaroor try kar lena,
  especially agar koi purana question hai jisme `\(...\)`/`\[...\]`
  ke bajaye kisi aur math format ka use hua ho.

## Deploy
Sirf 2 front-end files replace karne hain — koi Firestore rules ya backend
change nahi:
- `booklet-print.js`
- `question-generator.html`

Cache-bust already automatic hai (`?v=' + Date.now()`), toh deploy ke
baad hard-refresh ki zarurat nahi padegi.
