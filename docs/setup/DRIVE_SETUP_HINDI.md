# Google Drive setup (phone se) — OAuth Client ID banana

> ⚠️ Google Cloud Console ke menu/naam badalte rehte hain (abhi "Google Auth Platform" naam bhi dikhta hai). Neeche ke naam **andaaza** hain — ek baar Google ke current docs se verify kar lena: https://developers.google.com/identity/protocols/oauth2 aur https://developers.google.com/drive/api/guides/about-auth
> Ye sab Owner (aap) **ek baar** karte ho. Phir har institute ka admin apna Drive "Mera Storage" se khud jodta hai.

Phone me Chrome kholo aur **"Desktop site"** on kar lo (Console desktop jaisi chalti hai).

## 1. Project banao
1. https://console.cloud.google.com kholo, apne Google account se login.
2. Upar project dropdown -> **New project** -> naam `SnapTestPro` -> Create.

## 2. Drive API chalu karo
1. Menu -> **APIs & Services -> Library**.
2. "Google Drive API" khojo -> **Enable**.

## 3. Consent screen
1. Menu -> **APIs & Services -> OAuth consent screen** (ya "Google Auth Platform").
2. User type **External** -> app name `The Vishnu Sharma`, support email, developer email.
3. **Scopes** me sirf `.../auth/drive.file` jodo. (Ye sirf wahi files dekhta hai jo app ne banayi; "sensitive/restricted" scope nahi.)
4. Jab tak app "Testing" me hai, sirf **Test users** (max 100) login kar sakte hain — institute admins ke Google email yahan jodo. Sabke liye kholne ke liye **Publish app** karna padta hai; `drive.file` ke liye aam tor par bada verification nahi lagta, par ye **verify kar lena**.

## 4. Client ID
1. **APIs & Services -> Credentials -> Create credentials -> OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized JavaScript origins** me daalo:
   - `https://thevishnusharma.github.io`
   - Android APK ke liye: `https://localhost` (Capacitor ka `androidScheme: 'https'` hai). Agar APK `APP_URL` se chalti hai to wahi URL. *Ye mera andaaza hai — APK me Google popup chalega ya nahi, phone par test karna zaroori hai.*
4. Redirect URI is flow (Google Identity Services token) me nahi chahiye.
5. Create -> **Client ID** copy karo (`...apps.googleusercontent.com`). Client **secret** kahin mat daalna.

## 5. App me lagao
1. `app-config.js` me `googleClientId: "PASTE_YAHAN",` karo (GitHub me file edit -> Commit).
2. Admin: **Institute Settings -> Mera Storage -> Drive jodein** (institute ke naam ka alag Google account se).
3. Jab sab institutes Drive jod len, tab chaho to `driveRequired: true` karo — tab Drive na jure institute ka **file upload band** hoga (links/YouTube chalte rahenge). Default `false`.

## Dhyan
- App token kabhi save nahi karta; Firestore me sirf `driveConnected` aur `driveEmail` rehta hai. Token ~1 ghante me expire hota hai, phir popup/refresh chup-chaap.
- Drive folder: `The Vishnu Sharma / <instituteId>`.
- Kuch na chale: browser console / Google ka error text dekho ("origin_mismatch" = origin galat, "access_denied" = test user nahi jora).
