# v130 — Exam exit/resume fixes

Ye v129 ke baad ka fix hai (v129 = practice result card ka crash fix).
Is baar do alag samasyaon ko theek kiya:

## Samasya 1: Practice card se seedhe Reattempt/Weak Practice/Solution
dabane par purana card screen "leftover" reh jaata tha

Practice test khatam hone par jo chhota card dikhta hai
(`#practice-result-screen`), agar student usi card se seedha
"🔁 Re-attempt Wrong", "🎯 Weak Practice", ya "📖 Solution" dabata tha,
toh naya exam ya solution screen upar aa jaata tha lekin **purana
practice card screen kabhi hide hi nahi hota tha**. Result: dono
screens ek sath (upar-neeche) dikhte the — bilkul "kahi per pura test
screen aa jaana" wali shikayat jaisa.

Fix: `beginExam()`, `openTestSolutionFromRecord()`, aur
`resumeExamFromLocal()` — teeno jagah ab `#practice-result-screen` ko
bhi properly hide karte hain (jaise home/result/solution screens
pehle se karte the). Playwright se test karke confirm kiya — ab
Re-attempt aur Solution dono clean khulte hain, koi leftover card
nahi dikhta.

## Samasya 2: Practice/Weak-Practice/Re-attempt test beech mein
chhootne par kahin bhi "Resume" ka option nahi milta tha

App mein ek "Resume" system pehle se tha (`checkForInProgressExam()`
→ `resumableExam` → "⏳ Resume" button), lekin ye button sirf **normal
admin-banaye tests** ke "Start Test" list mein dikhta hai. Practice
Mode / Weak Practice / Re-attempt wale tests us list mein hote hi
nahi (wo synthetic/temporary tests hain) — isliye agar student koi
practice test beech mein chhod kar app band kar de, dobara khole par
uske liye resume karne ka koi tareeka hi nahi tha. Test progress
silently gayab ho jaata tha.

Fix: Student Dashboard Home par (sabse pehli screen jo student dekhta
hai) ek naya "⏳ Resume" banner add kiya hai — ye kisi bhi adhoore
test (practice ho ya normal, jo bhi) ke liye turant dikhta hai, test
ka naam aur bacha hua time dikhata hai, aur ek button se seedha
resume kar deta hai. Isse student ko kabhi bhi Test List mein jaake
dhoondhna nahi padega.

**Files changed:**
- `index.html` — `#resume-exam-banner` container add kiya (dashboard
  home mein, podium ke neeche); `styles.css?v=8` → `?v=9` (cache-bust).
- `styles.css` — `.resume-exam-banner-card` / `.resume-exam-banner-text`
  styles add kiye.
- `script.js` — `renderResumeBanner()` naya function; ise
  `checkForInProgressExam()` (jab bhi resumable exam detect ho),
  `backToStudentDashboard()` (jab bhi dashboard home dikhe), aur
  `resumeExamFromLocal()` (jab exam resume ho jaye, banner turant
  clear ho) — teeno jagah se call kiya jaata hai.

## Verify kiya (Playwright)
1. Practice test beech mein chhoda (progress localStorage mein save
   hota hai, jaise app pehle se karta hai) → app band kiya → dobara
   khola → **Dashboard Home par turant "⏳ Resume Karein" banner
   dikha**, sahi test title aur bacha hua time ke saath. Button dabate
   hi sahi question (jahan chhoda tha) par exam wapas shuru hua,
   sirf exam-screen dikha (home-screen properly hidden).
2. Normal admin Start Test ka purana resume-flow (Test List ke "⏳
   Resume" button) — pehle jaisa hi sahi kaam kar raha hai (regression
   check pass).
3. Practice card se Re-attempt Wrong aur Solution dabakar dekha —
   dono clean khulte hain, purana card kahin leftover nahi dikhta
   (regression check pass).
4. `node --check script.js` — syntax clean.

## Deploy ke baad test karein
1. Koi bhi test (Start Test ya Practice Mode) shuru karein, kuch
   sawaal jawab dekar beech mein hi app/tab band kar dein.
2. App dobara kholein — Dashboard Home par sabse upar "⏳ Aapka ek
   test adhoora hai" wala banner dikhna chahiye, "▶️ Resume Karein"
   button ke saath.
3. Us button ko dabaakar check karein ki exam sahi jagah (jahan
   chhoda tha) se, sahi bache hue time ke saath resume hota hai.
4. Ek practice test khatam karke, us practice card se "Re-attempt
   Wrong" aur "Solution" dono try karein — koi purana card leftover
   nahi dikhna chahiye.
