# v129 — Practice Mode ka result card ab sach mein bhi banta hai

## Asli Problem (v128 wala fix kaam kyun nahi kar raha tha)
v128 mein `showPracticeResultCard()` naya function sahi se likha gaya
tha, lekin usko *call* karne wali line mein ek chhoti si JavaScript
scoping mistake reh gayi thi:

```js
try {
  const recordPayload = { ...bahut sara data... };
  await saveRecordOnline(recordPayload);
} catch (b) { ... }

if (current.test.isPractice) {
  ...
  showPracticeResultCard(recordPayload, current.testId); // ❌ CRASH
}
```

`recordPayload` `const` ke saath `try{ }` ke **andar** banaya gaya tha,
isliye wo sirf usi block ke andar hi "exist" karta hai. Uske bahar,
`if(current.test.isPractice){...}` ke andar jab `showPracticeResultCard(
recordPayload, ...)` call hota tha, browser ko `recordPayload` naam ki
koi cheez milti hi nahi thi — `ReferenceError: recordPayload is not
defined` — aur poora `showResult()` function wahi crash ho jaata tha.

Result: record Firestore mein save toh ho jaata tha (wo part try ke
andar hi ho chuka tha), lekin us crash ki wajah se `showPracticeResultCard()`
kabhi call hi nahi hota tha — isliye card kabhi banta hi nahi tha.
Student ko bas seedha khaali dashboard dikh jaata tha, jaise practice
test submit hi na hua ho. (Yeh error sirf browser console mein dikhta
hai, app mein kahin bhi error message nahi aata — isliye pehli nazar
mein pata nahi chalta.)

"Start Test" flow is bug se bilkul affected nahi tha, kyunki uska
`else` branch `recordPayload` ko chhuta hi nahi — isliye wahi part
theek kaam kar raha tha aur practice wala nahi.

## Fix (script.js)
1. `recordPayload` ab `try{}` ke *bahar* declare hota hai (`let
   recordPayload;`), aur andar sirf assign hota hai
   (`recordPayload = {...}`) — ab wo function ke poore scope mein
   available hai, `showPracticeResultCard()` tak bhi.
2. Ek chhota related bug bhi theek kiya: practice card dikhane se
   pehle `#home-screen` ko **hide** karna chahiye tha (jaise
   `#exam-screen`/`#result-screen`/`#solution-screen` ke sath hamesha
   hota hai — ek time par sirf ek hi "screen" dikhni chahiye), lekin
   galti se usko unhide kiya ja raha tha. Isse — agar upar wala crash
   na bhi hota — dashboard ka khaali structure aur naya practice card
   dono ek sath, ajeeb tarike se dikhte. Ab practice card dikhte waqt
   `#home-screen` hidden rehta hai, aur "🏠 Back to Home" dabane par
   (`closePracticeResultCard()`) wapas se unhide ho jaata hai.

## Verify kiya
- `node --check script.js` → syntax clean.
- Playwright se poora submit-flow simulate karke check kiya: pehle
  (v128 code) `ReferenceError: recordPayload is not defined` aata tha
  aur card kabhi banta nahi tha. Fix ke baad card turant sahi se
  banta hai — icon, title (Practice/Weak Practice/Re-attempt ka
  naam), Que count, Marks, Score, aur charo buttons (📖 Solution,
  🎯 Weak Practice, 🔁 Re-attempt Wrong, 📊 Analysis) — bilkul
  "Start Test" list wale card jaisa hi style. "🏠 Back to Home" dabane
  par dashboard bhi sahi se wapas aata hai.

## Deploy ke baad test karein
1. Practice Mode se (subject/chapter select karke) ek mini-test poora
   karke submit karein → turant chhota card dikhna chahiye (title mein
   chapter/topic ka naam, Que/Marks/Score, aur charo buttons).
2. Weak Chapter Practice aur Re-attempt Wrong se bhi wahi card aana
   chahiye.
3. Us card ke sabhi 4 buttons check karein — sab kaam karne chahiye.
4. "🏠 Back to Home" dabaane par dashboard home par sahi se wapas
   aana chahiye.
5. Normal "Start Test" wale flow mein koi farak nahi aana chahiye.
