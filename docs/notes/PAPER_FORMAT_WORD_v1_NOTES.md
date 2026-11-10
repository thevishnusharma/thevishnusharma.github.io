# Paper Format Word (Test_4 format) — v1

## Kya hai
Naya button **📘 Paper Format Word** (sidebar + top toolbar). Paper me jo questions
select hain, unhe "Test_4" format me auto-layout karke `.docx` download karta hai.
Naya alag module: `paper-format-word.js`. Koi purana function nahi chheda
(`exportToWord`, `exportBookletToWord`, `printPaperBooklet` jaise ke taise).

## Output structure (v1.1)
A4 landscape, Word **Narrow margins (0.5")**. Booklet pages questions ke hisaab se khud banti hain:
**4, 8, 12 ... 40 pages** (= N/2 Word pages). Har Word page = 2 half-pages, har half-page me 2 columns.

Imposition (N pages, sheet s = 0..N/4-1): front `[N-2s | 1+2s]`, back `[2+2s | N-1-2s]`.
N = 8: `[8|1] [2|7] [6|3] [4|5]`. N = 4: `[4|1] [2|3]`.

- MCQ: Page 1 se aage, column 1 pehle poora, phir column 2. Page 1 par header box + instruction.
- Subjective (`qType = subjective`): aakhri page(s), single column.
- Beech ke bache pages blank. Page numbers print nahi hote.
- 40 page se zyada ho to confirm aata hai.

## Header kahan se aata hai
- Title: `SnapBrand.plain()` (institute ka naam), fallback "THE VISHNU SHARMA"
- Test: `#subject`, M.M: `#maxMarks`, DATE: `#testDate`, Instruction: `#instructions`
- CLASS: click karne par prompt poochta hai (yaad rakhta hai)

## Pagination
Question ki height estimate hoti hai (fixed 13pt line-height + text-width estimate +
fraction/root ka extra) aur ~5% safety margin (`SAFETY = 1.05`). Jagah kam padne par confirm
aata hai ("N question nahi aa rahe"). Constants file ke upar: `SAFETY`, `LH`, `SZ`.

## Test
- docx 9.6.1 aur 8.5.0 (browser wali) dono se file bani, 4 pages, XSD validation pass (9.6.1).
- v1.1: 30/100/160 MCQ (+subjective) se N = 4/8/16 pages bane, validation pass, columns ~89% bhare, imposition sahi.
- NOTE: LibreOffice docx.js ke fraction/root (OMML) ko blank dikhata hai, isliye math wale
  questions ki real height Microsoft Word me hi check honi chahiye.

## Deploy
Replace/add: `paper-format-word.js` (new), `question-generator.html` (2 buttons + 1 script line).

## v1.2 fixes (Word screenshot ke baad)
1. **Blank pages**: docx.js har section ke baad ek extra paragraph (section break) daalta hai, jiski
   height Word ki default line jitni hoti hai. Table ki exact height + wo paragraph page se bada ho jaata tha,
   isliye har sheet ke baad blank page aata tha (LibreOffice ye maaf kar deta hai, Word nahi).
   Fix: default paragraph 1pt exact kiya, `ROW_H` 10340 kiya, aur extra tiny paragraph sirf aakhri section me.
2. **Neeche khali jagah**: Word ke real screenshot se height calibrate ki (option rows par extra +20 hataya,
   fraction extra 140 -> 30, `SAFETY` 1.05 -> 1.03). Upar se bhare hue columns ko neeche tak stretch bhi karte hain:
   bacha hua space questions ke beech baant dete hain (`BOTTOM_GUARD`, `MAX_EXTRA`).

## v1.3
Body text size 8pt -> **9.5pt** (`PT` constant, file ke upar). Line-height aur page-fit apne aap us hisaab se adjust hoti hai.

## v1.4
Questions ke beech ka extra stretch cap 300 -> 40 twips (pehle kuch columns me ek poori line jitna gap dikhta tha). Gap ab sab jagah ek jaisa chhota rehta hai.

## v1.4
- Questions ke beech extra gap hataya (`MAX_EXTRA = 0`): sab gap barabar, koi "line chhooti" nahi.
- Columns ke beech ki vertical line hata di.

## v1.5
- Per-column question limit kahin nahi hai: questions serial order me tab tak isi column me jaate hain jab tak jagah ho. Fit rule thoda tight kiya (`SAFETY = 1.0`, aakhri question ka trailing gap count nahi, `FIT_GUARD = 80`).
- `LH_RATIO` constant (1.625) alag kiya — 1.5 karne par aur zyada questions aate hain.
