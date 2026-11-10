# Booklet Word Export — Real 2-Pages-Side-by-Side Imposition — v138

## Problem (screenshot se confirm hua)
v137 ka "Booklet Word (.docx)" button ek flat 2-column Word document banata
tha — lekin actual Booklet Print jaisa **"2 logical pages ek saath side-by-side"**
nahi dikhata tha (jo real booklet ki A4-landscape sheet me hota hai: left
half = 1 logical page, right half = agla logical page, beech me fold line,
aur har half ke andar apne 2 columns).

## Kya fix hua (`booklet-print.js`)

`exportBookletToWord()` ko poori tarah rebuild kiya taaki wahi structure ban
jo print karta hai:

1. **Same pagination jo print use karta hai** — naya function
   `buildLogicalPagesForWord()` add kiya, jo popup print-engine ke
   `buildLogicalPages()` wala EXACT same measuring algorithm hai (real
   rendered height se decide karta hai kitne questions ek logical page me
   fit honge), bas farak itna hai ki ye rendered HTML ke bajaye **question
   index** track karta hai — taaki Word ke liye original question object
   (math, options) wapas mil sake.
2. **Structure ab exactly booklet jaisa hai**:
   - Har physical Word page = ek borderless outer table (2 cells) = **2
     logical pages side-by-side**, beech me dashed "fold" line.
   - Har cell ke andar ek nested table (2 cells) = us logical page ke apne
     **2 internal question columns**, unke beech bhi dashed line.
   - Har logical page ke niche chhota "Page N" label (booklet jaisa
     `bp-pagenum`).
   - Header sirf pehle logical page par (jaisa print me hota hai).
3. **Reading order natural rakha** — pages 1&2 sheet 1 par, 3&4 sheet 2 par,
   waise hi (print ke fold/staple order — jisme last page pehle page ke
   bagal aata hai — use NAHI kiya, kyunki Word manual editing ke liye
   normal top-to-bottom order hi sahi hai).
4. Odd number of logical pages ho to last sheet ka right half khali
   rehta hai (jaisa print me blank half hota hai).

Math/MCQ-table conversion bilkul same hai — `docxQuestionBlock` /
`htmlToDocxRuns` / `mathToWordHtml` (jo regular "Download Word" bhi use
karta hai) unchanged reuse kiye hain.

## Test kiya
- `node --check booklet-print.js` — syntax clean.
- Node + jsdom me poora pipeline chalaya — real `buildLogicalPagesForWord`
  aur `docxLogicalPageChildren` (booklet-print.js se, koi reimplementation
  nahi) ko 22 sample questions (mix MCQ + subjective) ke saath run kiya:
  sahi tadaad me logical pages/sheets bane, nested tables (outer + 2 inner
  per logical page + MCQ option tables) sab count match hue, dashed
  borders sahi jagah aaye, page breaks sahi jagah aaye, aur final .docx
  bina kisi error ke pack hua.
- Real browser me nahi chala paya (is session me DOM real layout available
  nahi tha) — jsdom me height measurement FAKE hoti hai (real CSS
  layout nahi karta), isliye **live site par ek baar khud test zaroor
  kar lena**, especially thoda bada paper (15-20+ questions) ke saath,
  taaki real height-based page-breaks dekh sako.

## Deploy
Sirf `booklet-print.js` replace karna hai (`question-generator.html` is
baar unchanged hai — v137 wale button already sahi jagah hain).
