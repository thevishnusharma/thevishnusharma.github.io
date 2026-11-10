# Phase 4 — Password security + login rate limit
Default **OFF** (`serverAuth: false`): app bilkul pehle jaisa. Pehle apne phone par test, phir sabke liye ON.

## Kya badla
- Worker (`push-worker/worker.js`): endpoints `/student/login`, `/student/register`, `/student/set-pin`, `/student/reset-with-pin`, `/student/admin-reset` aur `/student/delete-account`.
- Password/PIN ab **salted PBKDF2-SHA256** (har user ka alag salt) me; compare constant-time. Format: `pbkdf2$<iterations>$<salt>$<hash>` (`pw`, `pin` fields, studentSecrets me).
- **Rate limit** (BANK_KV): 5 galat koshish / mobile / 15 min, 20 / IP / ghanta, register 10 / IP / ghanta. Uske baad 429 + "kitne minute baad" message. Sahi login par counter reset.
- Login ke baad Worker **Firebase custom token** deta hai (claims: role, mobile, instituteId). Firestore rules ab `request.auth.token.mobile` se student pehchanti hain (forge nahi hota).
- **Lazy migration**: purana SHA-256 wala student ek baar login kare -> chupchap PBKDF2 me upgrade. Koi forced reset nahi. (PIN purane SHA-256 me rehta hai jab tak student PIN se reset na kare.)
- Naya password policy: kam se kam 6 characters, aasan passwords (123456, password ...) reject. Purane users ko login se nahi roka jata.
- Uniform error: "Mobile number ya password galat hai." (account hai ya nahi, ye nahi batata).
- Strict CORS: sirf `https://thevishnusharma.github.io`, `https://localhost` / `capacitor://localhost`, local dev.
- Admin password reset sirf apne institute ke student ka (Worker check karta hai; owner sab).
- Rules: `config/privacy.secretsLockdown = true` hone par koi bhi client (admin bhi) `studentSecrets` nahi padh/likh sakta.

## Deploy (phone se, is order me)
1. **Cloudflare** -> Workers & Pages -> aapka worker -> Edit code -> `push-worker/worker.js` ka poora naya code paste -> Deploy.
   (BANK_KV binding aur SERVICE_ACCOUNT_JSON pehle se hain; naya secret nahi chahiye.)
   Optional Variable: `PBKDF2_ITER` (default 30000). Paid plan ho to 100000+ rakhein. Agar login par "Worker exceeded CPU" / error 1102 aaye to value kam karein.
2. **GitHub** par zip ki files daalo (serverAuth abhi `false`).
3. **Apne phone par test:** app URL ke aakhir me `?serverauth=1` lagakar kholo (sirf us phone par ON hota hai; band karne ke liye `?serverauth=0`).
   - Test student se **Login** (purana password chalna chahiye) -> Firestore `studentSecrets/<mobile>` me `pw` field aa jana chahiye.
   - 6 baar galat password -> "X minute baad try karein" aana chahiye.
   - Naya student register, "Password bhool gaye" (PIN se), Admin -> Student password reset, Settings se PIN set.
4. Sab theek ho to `app-config.js` me `serverAuth: true` karke push karo.
5. **Baad me (jab saare APK update ho chuke):** Worker Variable `DELETE_LEGACY_HASH = 1` (purana unsalted hash login par hat jayega), aur Firestore `config/privacy` me `secretsLockdown = true` (rules pehle publish karein). Rollback: dono ko hata do / `false` karo, `serverAuth: false`.

## Dhyan rakhein
- Jab tak `DELETE_LEGACY_HASH` nahi lagta, purana SHA-256 hash studentSecrets me rehta hai (purane APK chalte rahein isliye).
- APK ke andar app ki copy hoti hai: naya login sirf naye APK/web me chalega.
- Lockout par owner alert abhi sirf Worker log me jata hai (Cloudflare logs). Telegram/owner alert jodna baad ka kaam hai.
- PBKDF2 ki asli speed free plan par maine measure nahi ki (yahan Cloudflare nahi hai) — default 30000 safe rakha hai.
- Admin (email) login Firebase Auth ka hai, usme badlav nahi.
