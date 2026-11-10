# Booklet Word Export — Page-Overflow Fix — v139

## Problem (screenshot se confirm hua)
"Booklet Word (.docx)" download karne par ek physical sheet ka content
(jisme 2 logical pages side-by-side hote hain, jaise v138 me banaya) apni
jagah se overflow karke agle Word page par chala jaata tha — chhote se
question fragment + "Page 1"/"Page 2" label doosre page par akele, tuti
hui tarah dikhte the.

## Root cause (do jagah, dono confirm kiye real `.docx` bana kar
LibreOffice se render karke — jsdom se nahi, jo sirf FAKE height deta hai)

`buildLogicalPagesForWord()` yeh decide karta hai ki kitne questions ek
logical page me fit honge — **browser me chhote booklet-print CSS font se
height measure karke** (`stylesheet()`: question 10px, option 9.5px,
header ~9-11.5px). Lekin jo asli `.docx` banta tha, wo in chhote fonts se
render hi nahi hota tha:

1. **Question/option text**: `docxQuestionBlock`/`docxOptionCell` koi font
   size set hi nahi karte the → Word apna default (~11pt) use karta —
   measured 10px/9.5px se kaafi zyada.
2. **Header (sabse bada culprit)**: Header ke liye `docx.HeadingLevel.
   HEADING1`/`HEADING2` use ho raha tha — jinka Word/docx-library default
   size **16pt aur 13pt** hai — jabki measurement sirf ~9-11.5px (~7-8.6pt)
   maanke chali thi. Isi wajah se jis logical page par header hota hai
   (Page 1), wahi sabse pehle overflow karta — bilkul jaisa screenshot me
   dikha.

Dono milke itni extra height add kar dete the ki "budget ke andar hi hai"
wala estimate galat ho jaata tha, aur Word (jo CSS ki tarah kisi table cell
ko fix-height par clip nahi karta) baaki bacha content agle page par
dhakel deta tha.

## Fix

**`qgen-app.js`** — `htmlToDocxRuns`, `docxOptionCell`, `docxQuestionBlock`
me ek optional `opts` (`{size, font}`) parameter add kiya, jo har banaye
gaye `TextRun` tak pass hota hai. Bina `opts` diye (jaise regular
"Download Word" button abhi bhi karta hai) bilkul purana behavior hi
rehta hai — verify kiya ki `size: undefined` pass karna aur bilkul na
karna, dono ka XML output identical hai.

**`booklet-print.js`**:
1. `exportBookletToWord()` ke header block ko `HeadingLevel.HEADING1/2` ki
   jagah explicit chhote sizes (9pt / 7.5pt / 7pt — booklet CSS ke
   proportion se match) se banaya.
2. Question/option text ke liye `WORD_BODY_SIZE = 16` (8pt) — booklet CSS
   ke 10px/9.5px ke barabar — `docxColumnChildren` → `docxLogicalPageChildren`
   → `exportBookletToWord` tak thread kiya.
3. `buildLogicalPagesForWord()` me `WORD_SAFETY_FACTOR = 0.88` add kiya —
   budget ko ~12% kam karke rakhta hai, taaki residual mismatch (native
   Word math/fraction equations apna hi default size use karte hain, jise
   hum override nahi kar sakte — docx library ka `MathRun` sirf plain text
   leta hai, koi size option nahi) ke liye margin bacha rahe. Sirf Word
   export is factor ko use karta hai — print/PDF popup ka apna
   `buildLogicalPages()` bilkul waisa hi hai (wahaan measure aur render
   same CSS se hote hain, isliye guess-margin ki zaroorat nahi).

## Test kiya (is baar jsdom nahi — real `.docx` + LibreOffice render)
- Screenshot jaisa hi 28-question, 4-column sample paper (Hindi AP
  chapter, fraction/radical options sahit) banaya, purane code se
  **reproduce** kiya — same bug (page 2 par tuta hua fragment + orphaned
  Page-labels) aaya, root-cause confirm hua.
- Fix ke saath wahi 28 questions → clean **1 page**, achha margin bacha
  hua (bottom me ~15-20% khali jagah). 32 questions (ek column me 1 extra)
  waisa hi tha ki sahi se overflow karta hai — matlab fix "zyada fit karne"
  ki koshish nahi kar raha, sirf sahi maanta hai.
- `node --check` dono files par clean.
- Non-booklet regular "Download Word" export par asar nahi — `opts`
  omit hone par XML byte-for-byte same aata hai jaisa pehle aata tha.

## Ek chhota, ALAG issue notice hua (is fix ka hissa nahi)
Fraction/radical wale options (jaise "5, 4½, 4, 3½" ka answer) LibreOffice
me kabhi-kabhi blank/khaali render ho rahe the — yeh `docx` library ke
native Math (OMML) object banane wale purane code (`htmlToDocxRuns` ka
radical/table-fraction branch) ka pehle se maujood, alag mudda lagta hai,
maine isse nahi chheda. Agar asli Word/Google Docs me bhi fraction options
khaali dikhein to batana — alag se dekh lenge.

## Deploy
`qgen-app.js` aur `booklet-print.js` dono replace karne hain
(`question-generator.html` unchanged hai).

**Ek live check zaroor karna**: maine LibreOffice se real `.docx` render
karke validate kiya hai (jsdom ke fake-measurement se kaafi behtar), lekin
yeh 100% Microsoft Word jaisa nahi hota — ek baar apna sabse bada/lamba
paper download karke asli Word ya Google Docs me khol kar dekh lena.
