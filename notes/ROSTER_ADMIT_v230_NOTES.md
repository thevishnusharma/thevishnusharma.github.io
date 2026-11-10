# v230 — Admit Card + Roster + Scan Verification

## Flow
1. Exam banayein (Exam Manager). Exam details me naya button **🎫 Admit Card & Roster**.
2. Students chunein (class ke / saare / mobile paste) -> **Roll No + Set automatic** (naam ke order me; profile Roll Number numeric+unique ho to wahi).
3. Time / Venue / Instructions bharein -> **🚀 Publish**: har student ko `studentAdmitCards/{exam}_{mobile}` doc milta hai.
4. Student app -> dashboard **🎫 Admit Card** -> dekhein / Download / Print / Share (offline cache hota hai). Admin **📄 Sab ke Print (PDF)** (A4 par 2 card) aur WhatsApp button bhi.
5. Sheet scan karte waqt roll roster se match hota hai:
   - ✅ Verified: naam + photo dikhta hai, save par student se **auto-link** (result student ke login me).
   - ⚠️ Set admit card se alag / set bubble nahi / duplicate roll / OCR naam mel nahi khata -> auto-save ruk jata hai.
   - ❌ Roll registered nahi / roll nahi padha -> Save par confirm (roll unreadable par block). Override karne par result `anomaly` ke saath save.
6. Panel ke section 3 me: scanned/absent, anomalies list, **Absentees auto-fill**, **Attendance CSV**.

## Files
Naye: `exam-roster.js` (admin, lazy: exam-manager ke saath), `admit-card.js` (student + shared renderer), `tests/unit/test_roster_admit_v230.js`.
Badle: `exam-manager.js` (13 chhote hooks, `window.SnapRoster` na ho to purana behaviour), `index.html`, `inline/index-inline-06.js`, `sw.js`, `exam-manager.css`, `app-config.js` (kill-switch `roster`, `admitCard`), `firestore.rules`.

## ZAROORI deploy steps
1. **Firestore rules publish karein** (firestore.rules) — warna roster save aur admit card publish "permission denied" dega.
2. Changed files GitHub par upload; `npm run stamp` se version/cache bump (sw.js precache me 2 nayi files judi hain).
3. Pages deploy ke baad Settings -> "Cache saaf karke refresh".

## Limits / dhyan
- Max 3000 students per exam (roster ek doc). Roster = 1 read per scan session; admit card = student ka 1 query/din.
- Purane roll kabhi renumber nahi hote (card chhap chuke hote hain); hataya hua roll dobara use nahi hota.
- Exam Settings me Roll digits badle to panel "Roll dobara banayein" dikhata hai, phir Publish dobara karein.
- OCR naam check sirf tab chalta hai jab Scan settings me name-OCR ON ho; Devanagari naam par kabhi alarm nahi.
- Admit card sirf us student ko padhne yogya jiska mobile match kare (rules studentScanReports jaisa trust model).
- Test: `npm test` 43/43 passed. Asli phone/Firebase/camera par nahi chala — pehle ek demo exam se try karein.

---
# v231 — Registration (test se PEHLE students register, roll baad me shuffle)

## Naya flow
1. Exam Manager → **📝 Registration** → naam/date/roll-digits ke saath banayein (test ya questions abhi nahi chahiye).
2. Students jodein (class se chunkar / mobile paste / `Naam, mobile` — bahar ya dusre institute ke students ke liye). Har add par optional **Group / Institute label**. **Roll abhi nahi bante.**
3. Jab chahein (test se 1–2 din pehle) **🎲 Publish**: sabko RANDOM roll (1..N ka poora shuffle, institute mix) + Admit Card student app me. Roll lock.
4. **📄 PDF** (A4 par 2 card, roll order me) — "Group: X" chunkar har institute ki alag PDF. CSV roll list bhi.
5. Baad me Exam banate waqt **"Registration se jodein"** (ya Exam → 🎫 Admit Card & Roster → 🔗). Wahi roll exam roster me copy; Set exam ke sets se roll se banta hai. Scan par verify pehle jaisa.

## Rules
- Admit card par **Set nahi** chhapta (set sirf scan-verify ke liye andar).
- Publish ke baad naya student: bache hue numbers me se random roll + card turant. Hataye gaye roll dobara nahi milte (`retired`).
- Roll digits Publish ke baad badal nahi sakte. Exam jodne par exam ke digits registration ke digits ho jate hain (OMR sheet dobara chhapni pad sakti hai).
- Registration me badlav ke baad jude exam me **🔄 Sync** dabayein. Jude exam me students seedhe add/remove band (Registration se karein).
- Roll order me baithne par sets baari-baari aate hain kyunki roll 1..N compact hain (late joiners ke roll N ke upar).

## Deploy
1. **firestore.rules publish karein** (naya `examRegistrations` + `roster`) — warna permission denied.
2. `npm run stamp`. Files: exam-registration.js (naya), exam-roster.js, admit-card.js, exam-manager.js, exam-manager.css, index.html, inline/index-inline-06.js, sw.js, app-config.js (`registration` flag), firestore.rules.
3. Tests: tests/unit/test_registration_v231.js (44/44 suite pass).

## Limit
- Dusre institute ke *registered* student ka card app me tab nahi jayega jab rules `studentBelongsToAdmin` roke — publish uski ginti dikhata hai; unhe PDF/WhatsApp se dein.
- `studentAdmitCards` abhi har signed-in user padh sakta hai (v230 jaisa trust model).


---
# v232 — App par registered hona zaroori nahi + Google Form auto-register

## Kya badla
- Registration me ab **app ke students nahi dikhte**. Admin har student ko khud bharta hai: Naam*, Mobile*, Father, Class, DOB, School/Institute, **Photo** (camera/gallery). School/Class agle student par yaad rehta hai (institute-institute jaakar bharne ke liye).
- **Excel/Sheet paste**: har line `Naam, Mobile, Father, Class, DOB, School` (tab ya comma; mobile kisi bhi column me).
- Student ko edit (✏️), photo badalna/lagana (➕📷) list se. Publish ke baad edit karne par card doc update.
- **Admit card** par ab Father's name / DOB / Class / School bhi (jo bhara ho). Set abhi bhi nahi.
- Photo `examRegistrations/{id}/photos/{mobile}` me (240x300 jpeg ~15–20KB). Student-app wale card doc me photo nahi jaati (wo sab signed-in users padh sakte hain) — photo sirf PDF/preview me.
- PDF "Institute: X" chunkar institute-wise.

## Google Form (auto-generate + auto-register)
Browser se seedha Google Form banana possible nahi (Google OAuth chahiye), isliye **ek baar** ka setup:
1. Registration → "📋 Google Form" → "Setup": app ek Apps Script code deta hai (token ke saath).
2. script.google.com → New project → code paste → Deploy → Web app (Execute as: Me, Access: Anyone) → URL app me paste → Save & test.
3. Uske baad har registration me **📋 Google Form banayein** = naya Form automatic (Naam, Mobile (10-digit validation), Father, Class, DOB, School). Link copy/WhatsApp.
4. Students form bharte hain → admin **🔄 Responses laayein** dabata hai → naye students register (duplicate mobile skip; publish ho chuka ho to turant random roll + card).
5. **⛔ Form band** se registration band.
- Setup ka URL+token registration doc (`formEndpoint`, `formToken`) me save hota hai, isliye dusri registration/device par dobara nahi bharna.

## Limit
- Google Form me **photo upload nahi** (Apps Script se file-upload question banta hi nahi + respondent ko Google login chahiye). Photo list se admin lagata hai.
- Form responses **pull** hote hain (🔄 dabana padta hai) — live push nahi, kyunki bina server ke Firestore me Google Form se seedha likhna surakshit nahi.
- Token sirf is registration/admin ka hai; URL+token jisko mile wo form responses (naam/mobile) padh sakta hai — URL kisi ko na dein.
- Firestore rules me `photos/{pid}` add hua — **firestore.rules dobara publish karein.**

---
# v233 — "Powered by SnapTest Pro" tag

Institute jo bhi output banaye usme tag: **Admit Card** (canvas footer, isliye PDF/preview/download sab me), **Result Sheet**, **Question-paper print (booklet / 4-column)** (pehle sirf naam wale institute ko aata tha; ab har institute ko tag-only patti). **OMR sheet** (HTML aur .docx) ke title me pehle se "SnapTest Pro" hai — alag se nahi badla.
- Helper: `SnapBrand.mark` (`on()`, `text`, `html()`), branding.js me.
- Institute-wise chhupana: Owner Panel → institute → "Powered by chhupayein" (`hidePoweredBy`) ON ho to tag nahi aata (white-label plan ke liye).
- Sab jagah band: `app-config.js` → `brandMark: false`.
- Abhi tag nahi: ID card (app ke andar ka view), CSV files, OMR sheet par alag footer, exam-manager ki baaki reports.
- Tests: tests/unit/test_brandmark_v233.js; test_branding2_v221.js me printBar ki expectation badli (ab tag-only bar aata hai).
