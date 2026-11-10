# ID Card "Owner of Institute" ab asli Owner ka Naam dikhata hai (v112)

v111 mein "Owner of Institute" signature coaching ka hi naam dikha
rahi thi (jaise sample image mein "Dean of Students" ki jagah
university ka naam aa jaana) — aapne sahi pakda ki ye galat hai.
Ab fix ho gaya.

## Kya badla

- **ID Card ki signature** (Student aur Admin dono) ab institute ke
  **ASLI Owner (insaan) ka naam** dikhati hai — coaching ka naam
  nahi. Naya field: `institutes/{id}.ownerName`.
- **Naya Institute banate waqt** (Owner Panel → "+ Naya Institute"),
  ab "Institute ka naam" ke saath-saath **"Institute ke Owner ka
  naam"** bhi maangega — dono zaroori (required) hain.
- **Purane institutes** ke liye — Owner Panel mein har institute-card
  par ab ek naya **"👤 Owner Naam"** button hai, jahan se ye naam
  kabhi bhi set/badla ja sakta hai. Jab tak set nahi kiya, card par
  chhota **"⚠️ Naam set nahi hai"** dikhega — taaki bhoolein nahi.
- **Har Admin ka apna alag Naam** — ek institute se kai admins juday
  ho sakte hain, aur ab har admin-row ke saath ek **"✏️ Naam"**
  button hai jisse Owner khud har admin ka apna-apna personal naam
  set/badal sakta hai (ye wahi field hai jo Admin khud bhi apne
  Settings → ID Card se ✏️ se badal sakta hai — dono jagah se ek hi
  jagah save hota hai, koi conflict nahi).

## Agar naam set na ho to kya dikhega
ID Card ki signature line mein "-" dikhega (jab tak Owner Panel se
naam set na kar diya jaaye). Isliye deploy ke baad **sabse pehle
Owner Panel khol kar har institute ka Owner Naam ek baar set kar
lena** zaroori hai — warna sabhi students/admins ke ID Card par
signature khaali dikhegi.

## Files changed
`owner-panel.js`, `id-card.js`, `index.html`, `owner-app.html`,
`sw.js` (cache version bump)

## ⚠️ Deploy se pehle
Koi naya Firestore Rules change nahi hai is baar (Owner ke paas
`institutes`/`admins` dono par pehle se hi poora access hai) —
sirf normal hosting deploy (`firebase deploy`) kaafi hai.

Deploy ke baad:
1. Owner Panel kholein → har institute ke liye "👤 Owner Naam" set
   karein.
2. Jitne bhi admins hain, chahe to unka bhi naam yahin se set kar
   dein (ya unhe khud apne Settings se karne dein).
3. Ek student ka ID Card khol kar confirm karein ki signature mein
   ab sahi Owner ka naam aa raha hai, coaching ka naam nahi.
