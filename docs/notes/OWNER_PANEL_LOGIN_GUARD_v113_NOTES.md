# Owner Panel "Missing or insufficient permissions" — Permanent Fix (v113)

## Asli wajah (code se confirm kiya, guess nahi)
Ye rules bug NAHI tha, aur `firestore.rules` change karne/publish karne ki
zaroorat nahi hai. Screenshot mein khud hint tha:

> Us waqt sign-in tha: vishnu1234stmp@gmail.com

`institutes/{instituteId}` collection ke rules mein:
```
allow read, write: if isOwner();          // sirf vishnu1234stm@gmail.com (bina "p")
allow read: if isSignedIn();              // koi bhi signed-in user (student dropdown ke liye, v25)
```

Matlab **READ** kisi bhi signed-in account ko mil jaata hai (isliye Owner
Panel poora normal dikhta hai, institute list load ho jaati hai — kuch bhi
galat nahi lagta). Lekin **WRITE** (Rename, Owner Naam, Deactivate, Admin
Add, waghera) sirf `isOwner()` ko milta hai — jo sirf ek hi email accept
karta hai: `vishnu1234stm@gmail.com` (bina "p").

Us waqt Owner Panel session mein `vishnu1234stmp@gmail.com` (WITH "p" —
ye legacy ADMIN ka email hai, Owner ka nahi) sign-in tha. Do alag,
ek-character-different, dono hi valid Firebase accounts hain — isliye
login screen par galat wala type/select ho jaana bahut aasan hai, aur
purana code isse pakadta hi nahi tha.

## Isse pehle kya hota tha
`ownerLogin()` sirf itna check karta tha ki email/password Firebase Auth
mein valid hai ya nahi — ye check nahi karta tha ki ye WAHI email hai jo
Owner ke roop mein authorize hai. Isliye galat (lekin valid) account se
bhi poora panel khul jaata tha, aur pata sirf tab chalta tha jab koi
write fail hoti thi — ek generic, confusing error ke saath.

## Fix (permanent — dobara nahi hoga)
`owner-panel.js` mein:
1. **`OWNER_TRUE_EMAIL`** naya constant — `firestore.rules` ke `isOwner()`
   jaisa hi hardcoded email.
2. **`ownerLogin()`** ab login ke turant baad email match check karta
   hai — match na ho to turant `signOut()` + saaf error, panel khulta hi
   nahi.
3. **`openOwnerOverlay()`** bhi ab silently resume karne se pehle yahi
   check karta hai (purana/stale galat-session bhi ab pakda jayega).
4. **Owner Panel header mein hamesha "👤 signed-in-email" dikhta hai** —
   ek nazar mein confirm ho jaata hai ki sahi account se login hain.

⚠️ Agar kabhi Owner ka apna email badlein: `owner-panel.js` ke
`OWNER_TRUE_EMAIL` AUR `firestore.rules` ke `isOwner()` — **dono jagah**
badlein (dono ek jaise rehne chahiye).

## Files changed
`owner-panel.js`, `owner-app.html`, `index.html`, `sw.js` (cache version
bump, v112 → v113).

## ⚠️ Deploy se pehle
`firestore.rules` is baar bilkul NAHI badli — koi Firebase Console
publish step nahi chahiye. Sirf normal hosting deploy (`firebase
deploy`) kaafi hai.

## Abhi turant kya karein
1. Naya zip deploy karein.
2. Owner Panel (agar khula hai) ek baar Logout karein.
3. Dobara login karein — **`vishnu1234stm@gmail.com`** se (bina "p"),
   NA ki `vishnu1234stmp@gmail.com` (wo legacy Admin email hai).
4. Ab header mein "👤 vishnu1234stm@gmail.com" dikhna chahiye, aur
   "Owner Naam" / Rename / Deactivate sab bina error ke chalne chahiye.

Agar dobara kabhi galat email se login ho bhi jaaye, ab turant login ke
waqt hi saaf error milega — kisi write ke fail hone tak wait nahi karna
padega.
