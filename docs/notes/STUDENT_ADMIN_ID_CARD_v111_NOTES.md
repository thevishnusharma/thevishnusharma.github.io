# Student + Admin ID Card (v111)

Aapne jo University ID Card ka sample bheja tha, uska poora clone ban
gaya hai — Student ke **Settings** aur Admin ke **Settings** dono mein.

## 1️⃣ Student ID Card (Settings mein)

Ab Student → ⚙️ Settings kholte hi, purani simple "photo + naam" wali
line ki jagah ek asli dark + gold University ID Card dikhta hai:

| Card ka field | Kahan se aata hai |
|---|---|
| Institute ka Naam (header) | Jis institute se register hua tha, uska naam |
| Left circular logo + Right badge logo | Admin ne jo institute-logo upload kiya hai (dono jagah wahi ek logo) |
| Beech ki badi photo | Student khud us par click karke apni photo lagata hai — **default mein khaali/blank** rehti hai jab tak khud na lagaye (bilkul aapke bataye tareeke se) |
| Name | Registration ke waqt diya naam |
| ID Number | **Institute-code + Serial No** (jaise "The Vishnu Sharma" → `SC0001`, `SC0002`...) — har naye student ko institute ke hisaab se agla unique number apne aap milta hai |
| Class | Registration ke waqt jo class chuni thi |
| Academic Session | **Live-calculated** — kabhi save nahi hoti, hamesha aaj ki date ke hisaab se sahi session dikhati hai (April se naya session shuru hota hai, jaise "2026-27") |
| Issue Date | Registration ki date |
| Signature ("Owner of Institute") | Institute ka naam hi cursive style mein — "Dean of Students" ki jagah |

Purane (is update se pehle register hue) students ko bhi Settings
kholte hi turant sahi ID Number mil jaata hai — pehli baar khulte hi
peeche se assign ho jaata hai, dobara kabhi nahi badalta.

## 2️⃣ Admin ID Card (Settings mein)

Bilkul wahi design, Admin ke apne Settings tab mein sabse upar — bas
ID Number/Class/Academic Session nahi hain (ye sirf students ke liye
relevant hain):

- **Corner-logo par click** karke Admin apne institute ka logo
  upload/badal sakta hai — **turant** apne is card par bhi, aur
  **sabhi students ke ID Card par bhi** dikhne lagta hai (dono ek hi
  jagah se aata hai).
- **Beech ki photo** — Admin apni khud ki photo lagata hai (default
  blank).
- **Name** — pehle Admin ka koi personal naam save hi nahi hota tha
  (sirf email/institute naam). Ab naam ke saath ✏️ button hai — click
  karke apna naam likh do, ID Card par turant dikh jaayega.
- Issue Date = Admin account banne ki date, Signature = institute ka
  naam (Owner of Institute).

## Kaise kaam karta hai (thoda technical)

- **Serial Number**: har institute ke liye ek counter
  (`institutes/{id}.studentSerialCounter`) hai. Naya student register
  karte hi, ya purana student pehli baar Settings kholte hi, ek
  Firestore **transaction** se agla number safely assign hota hai —
  do students ek hi second mein aayein tab bhi kabhi duplicate number
  nahi milega.
- **Institute Logo**: PNG format mein save hota hai (JPEG nahi) taaki
  transparent background wale logo dark card par sahi dikhein.
- **Academic Session**: kabhi Firestore mein store nahi hoti — har
  baar page khulte waqt live calculate hoti hai, isliye kabhi
  purani/galat nahi dikhegi, aap kuch bhi update nahi karte.

## Files changed
Naye: `id-card.css`, `id-card.js`
Modified: `index.html`, `script.js`, `firestore.rules`, `sw.js`

## ⚠️ Deploy se pehle (ZAROORI)
1. **Firestore Rules dobara deploy karna zaroori hai** — bina iske
   Admin logo upload nahi kar payega, aur naye students ka Serial
   Number/ID Number assign nahi hoga:
   - Firebase Console → Firestore Database → Rules → naya
     `firestore.rules` paste karke Publish, YA
   - CLI se: `firebase deploy --only firestore:rules`
2. Poora `firebase deploy` (ya jo bhi hosting deploy tareeka use
   karte hain) — naya `id-card.css`/`id-card.js` upload karne ke liye.
3. Ek Student account se Settings khol kar check karein — ID Card
   sahi dikh raha ho, photo upload/save ho.
4. Admin Settings se ek institute-logo upload karke check karein ki
   turant dikh raha hai, aur ek student ka card refresh karke dekhein
   ki wahi logo wahan bhi aa gaya.
