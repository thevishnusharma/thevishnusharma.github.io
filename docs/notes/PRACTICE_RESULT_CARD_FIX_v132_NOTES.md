# v132 — Institute Join Code (koi bhi kisi bhi institute mein register na ho paye)

## Problem
Registration form mein student sirf dropdown se apna institute chun
leta tha — koi bhi student, kisi bhi institute ka naam dekh kar,
seedha usme "ghus" sakta tha, bina us institute se koi permission
liye. Koi verification hi nahi thi.

## Fix — bilkul aapke password system jaisa hi secure pattern
Aapke app mein pehle se hi student ka password/PIN is tarah check
hota hai: client sirf apna "guess" (sha256 hash) Firestore ko bhejta
hai, aur Firestore Rules khud, SERVER-SIDE, use asli stored hash se
compare karti hain — asli password kabhi client tak pahunchta hi
nahi. Maine institute code ke liye **bilkul yahi pattern** use kiya
hai:

1. Har institute ka asli Join Code ek ALAG, protected collection
   (`instituteJoinCodes`) mein rehta hai — sirf **aap (uss institute
   ke admin)** ise dekh/badal sakte hain. Koi student, koi doosra
   admin, koi bhi isse seedha padh NAHI sakta.
2. Jab student register karta hai aur apna guess likhta hai, app
   ek chhota "verification attempt" Firestore ko bhejta hai. Firestore
   Rules khud check karti hain ki guess sahi hai ya nahi (asli code se
   milaan karke) — sirf tabhi aage badhne deti hain jab match ho.
   Agar galat hai, seedha "❌ Galat Institute Join Code" dikh jaata
   hai — student ka account bantа hi nahi.
3. Ye check **DevTools/console se bhi bypass nahi ho sakta** — kyunki
   verification client-side JavaScript mein nahi, Firestore ke apne
   server par hoti hai.

## ⚠️⚠️ ZAROORI — Deploy karte waqt DO cheezein karni hongi

**1. Naya `firestore.rules` file bhi deploy karna hoga**, sirf
website files nahi. Bina isके, poora fix kaam nahi karega (asli
security check isi file mein hai). Firebase CLI se:
```
firebase deploy --only firestore:rules
```
(ya Firebase Console → Firestore Database → Rules mein jaakar naya
`firestore.rules` ka poora content paste karke Publish karein.)

**2. Har institute ke liye yeh feature "OPT-IN" hai** — matlab jab
tak koi admin khud apne institute ka code set NAHI karta, uska
institute PEHLE JAISA HI (bina code ke) khula rehta hai. Maine
jaan-boojhkar aisा rakha hai taaki deploy karte hi kisi doosre
institute ka registration achanak band na ho jaaye (aapke platform
par aur bhi admins/institutes hain). **Apne khud ke institute ke liye
protection ON karne ke liye:** Admin → Settings → "🔑 Institute Join
Code" card mein jaakar ek code set karein (jaise "SAVYA2026"). Baaki
admins ko bhi bata dein ki wo apna-apna code wahin se set kar sakte
hain.

## Kaise kaam karta hai (student ke liye)
- Agar institute ne code set nahi kiya: pehle jaisa hi normal
  registration (koi extra field nahi dikhta).
- Agar institute ne code set kiya hai: registration form mein
  Institute select karte hi ek naya "Institute Join Code" field
  apne-aap dikh jaata hai (required). Galat code likhने par account
  banta hi nahi.

## Files changed
- `firestore.rules` — do naye collections (`instituteJoinCodes`,
  `instituteJoinCodeChecks`) + `institutes/{id}` mein ek naya
  `requiresJoinCode` single-field update rule.
- `index.html` — registration form mein naya (conditionally hidden)
  "Institute Join Code" field; Admin Settings mein naya card
  (code set/dekhna/hatana).
- `script.js` — `onRegisterInstituteChange()` ab code-field
  show/hide karta hai; `registerStudent()` ab register se pehle code
  verify karta hai; 3 naye functions —
  `loadInstituteJoinCodeStatus()`, `saveInstituteJoinCode()`,
  `disableInstituteJoinCode()`.

## Verify kiya
- `node --check` saari JS files par clean.
- Playwright se registration form ka client-side behavior test kiya:
  code-required institute select karne par field sahi se dikhता hai
  aur required ban jaata hai; blank chhodne par sahi Hinglish error
  aata hai.
- Firestore Rules ki syntax carefully likhi hai (bilkul aapke
  password-check wale existing pattern ko copy karke), parens/braces
  balance manually verify kiya — **lekin is sandbox mein asli
  Firestore/emulator available nahi hai, isliye SERVER-SIDE
  enforcement (galat code reject hone wali cheez) khud live/staging
  mein ek baar test kar lein deploy karne ke baad.**

## Deploy ke baad zaroor test karein
1. `firebase deploy --only firestore:rules` aur poori site dono
   deploy karein.
2. Admin → Settings → "🔑 Institute Join Code" mein apna code set
   karein (kam se kam 4 characters).
3. Ek naye (test) mobile number se registration try karein: apna
   institute select karein → code field dikhna chahiye → GALAT code
   dalke check karein (reject hona chahiye, account nahi banna
   chahiye) → phir SAHI code dalke register karein (successful hona
   chahiye).
4. Ek doosre institute (jisne code set NAHI kiya) se register karke
   confirm karein ki wahan pehle jaisa hi bina-code registration ho
   raha hai (backward-compatible).
