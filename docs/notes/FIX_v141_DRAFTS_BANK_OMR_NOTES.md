# v141 — Drafts section, Bank "naya chapter" fix, OMR answer-key fix

Files changed: `script.js`, `index.html`, `qgen-app.js`, `sw.js` (cache bump — zaroori, warna purana script.js cache se chalta rahega).
Koi Firestore rules / index change nahi chahiye.

## 1) Paper Generator drafts -> Create Test me "Saved Drafts" section
**Root cause:** generator ka `savePaperAsDraft()` test doc me `instituteId` save nahi karta tha, jabki admin panel
`isOwnedByCurrentAdmin()` se filter karta hai -> draft admin ki list me kabhi aata hi nahi tha (aur publish karne par
students ko bhi nahi dikhta, kyunki student side bhi instituteId match karti hai).

**Fix**
- `qgen-app.js`: draft save par `instituteId` (parent / localStorage / admins doc se), har question par `section`,
  section par `title` + `marksPerQuestion`. Draft load par `section` / title-based sections bhi samajhta hai.
  Saved Drafts list sirf apne institute ke (+ untagged purane) drafts dikhati hai.
- `index.html` + `script.js`: Create Test page ke upar **📝 Saved Drafts** card —
  ✏️ Edit (neeche form me khulta hai), 📄 Paper Generator me kholo, 🌐 Online Test Banao (publish), 🗑️ Delete.
- Purane drafts (jinme instituteId nahi) ke liye collapsed "Purane drafts" list + "Mere institute me lo" button.
- `publishTest`: instituteId stamp karta hai, generator-sections ko admin format me normalise karta hai,
  fail hone par `isDraft` wapas true.
- `editTest`: sections me `title` / `name` dono chalte hain.

NOTE: Create/Edit form se "Save Test" dabane par test publish ho jata hai (purana behaviour). Draft rakhna ho to "Save as Draft".

## 2) Naya chapter question bank me nahi dikhna
**Reproduced:** institute ki `allowedClasses` me na hone wali class (jaise class_9) me upload karne par question Firestore me
save ho jata tha, par `isQuestionClassAllowedForCurrentAdmin` use bank, chapter dropdown, sab jagah se hide kar deta tha.
**Fix:** Bulk-upload / Add-Question class dropdown ab sirf allowed classes dikhata hai; `confirmBulkUpload` aur generator
ka bulk upload / Save-to-Bank allowed class ke bahar block karke saaf message deta hai.
Agar fir bhi chapter na dikhe to class filter + subject filter "None" karke dekhein, aur check karein ki questions
me 4 options + answer bhare hon (Create Test ka bank picker invalid questions chhupa deta hai).

## 3) OMR
- **Bug fixed:** `syncTestToExamManager` subjective questions ko bhi answer key me 'A' bana deta tha, jabki OMR sheet sirf MCQ
  se banti hai -> key ka numbering khisak jata tha. Ab subjective skip hote hain.
- Check kiya (theek): OMR sheet layout 1–100 questions ke liye (count, numbering, overflow) sahi hai; JS syntax clean.
- Dhyan: `SCANNER_CAPTURE_TRIGGER_FRAMES = 1` (v20 ka known trade-off) — kam roshni/hilte hath me galat read dikhe to 2–4 karein.
- Dhyan: Exam Manager answer key max 100 questions tak sync hoti hai.
