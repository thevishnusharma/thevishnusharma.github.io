# v122 — Student + Admin ID Card bhi cache kar diya (bar-bar load nahi)

## Problem
`renderStudentIdCard()` aur `renderAdminIdCard()` (dono `id-card.js`
mein) har baar jab Student/Admin apni Settings/ID Card section kholte
the, poora card Firestore se DOBARA fetch karte the — chahe kuch bhi
naya update na hua ho:

- **Admin wale mein** ek explicit bug bhi tha: function shuru hote hi
  `setText("#admin-idcard-name", "Loading...")` chal jaata tha — matlab
  har baar (chahe pehle se sahi naam dikh raha ho) ek "Loading..."
  flash dikhta tha.
- **Student wale mein** "Loading..." text to nahi tha, lekin fir bhi
  har visit par network round-trip (student-doc + institute-doc)
  hoti thi.

## Fix — same localStorage cache-first pattern (jaisa Welcome-name mein)
1. Har card ka poora "snapshot" (naam, class, ID number, institute
   naam/logo, owner-signature naam, issue-date, photo) ab localStorage
   mein cache hota hai — Student ke liye mobile ke hisaab se
   (`savya_idcard_student_<mobile>`), Admin ke liye email ke hisaab se
   (`savya_idcard_admin_<email>`).
2. Section khulte hi (async fetch shuru hone se PEHLE) agar cache mile
   to poora card usi se turant paint ho jaata hai — 0ms, koi loading
   nahi.
3. Background mein fresh data bhi laate hain (data sahi/up-to-date
   rehne ke liye — naya student-serial assign karna waghera abhi bhi
   zaroori hai), lekin naye data ko cache se **compare** karte hain —
   DOM ko sirf tabhi dobara chhoote hain (aur cache update karte hain)
   jab kuch waqai badla ho. Kuch na badle to card bilkul static rehta
   hai, koi flicker/reload jaisa mehsoos nahi hota.
4. Admin apni photo/naam badle, ya institute-logo badle — teeno jagah
   admin ke apne device ka cache turant update ho jaata hai (taaki
   agli baar bhi turant sahi dikhe, dobara fetch ka wait na ho).

## Ek zaroori seemaa (limitation) — samajhna zaroori hai
localStorage har device/browser ka apna alag hota hai. Matlab agar
Admin apne phone se institute-logo badle, to Students ke apne-apne
phone/browser ka cache us waqt turant update nahi ho sakta (technically
possible hi nahi bina real-time sync ke). Lekin jab bhi student agli
baar apni Settings kholega, purana cached logo pehle turant dikhega,
aur usi visit ke andar hi (1 second ke andar, background fetch se)
chup-chaap sahi/naya logo aa jaayega — koi "Loading" jaisa mehsoos
kiye bina. Matlab end-result wahi hai jo aapne bola: card hamesha
static/frozen dikhta hai, sirf jab kuch waqai update ho tabhi (aur
tabhi) badalta hai.

## Verify kiya
- `id-card.js` `node --check` se syntax-clean.
- Dono render function (`renderStudentIdCard`, `renderAdminIdCard`)
  ab pehle cache-paint karte hain, phir background fetch, phir
  sirf-agar-alag-ho to hi dobara paint+cache-update karte hain.
- Admin ke 3 edit-handlers (photo, naam, institute-logo) — teeno ab
  apna cache bhi turant update karte hain successful save ke baad.

## Deploy
Same tarike se — saari files overwrite karke deploy karein (file-count
limit yaad rakhein), phir test karein:
1. Student Settings kholo — pehli baar thoda normal lagega (cache
   khaali), doosri baar se (Student dashboard → Settings dobara)
   card turant, bina kisi flicker ke dikhna chahiye.
2. Admin Settings kholo — ab "Loading..." sirf pehli baar dikhega,
   uske baad kabhi nahi.
3. Admin apna naam/photo ya institute logo badal ke check karo —
   turant update hona chahiye (jaisa pehle hota tha).
