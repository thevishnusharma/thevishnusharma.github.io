# v268 — Bhari hui Reference OMR (cumulative: v266 + v267 bhi shamil)

Exam detail -> "OMR/Bubble Sheet" me naye buttons: "🖨️ PDF (Print)" aur "🖼️ JPG".
- Answer Key ke sahi options bhare (kaale) hote hain, header me "NAME : ANSWER KEY (SET A)"; roll no khali.
- Multi-set exam: PDF me har set ka alag page (set bubble bhi bhara), JPG har set ki alag file.
- Answer key khali ho to message: "Pehle Answer Key bharein".
- Normal (khali) OMR PDF/JPG pehle jaisi hi; scanner par koi asar nahi.
- exam-manager.js (Ba/ja/Gt me optional `fo` param + refPdf/refJpg), index.html (2 buttons), sw.js v268.
Test: Playwright se JPG render check kiya (Set B, 100 Qs). PDF phone par ek baar print/preview karke dekh lein.
