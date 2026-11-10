# 🚀 Auto Update + Notification System — ek baar ka setup (~10 min)

## Ye system kya karta hai
| Situation | Kya hota hai |
|---|---|
| Website file GitHub par upload (HTML/JS/CSS) | App/website me **apne-aap** update lag jaata hai (live URL mode). Kuch karna nahi. |
| Upload ke saath commit message me `[notify:admin]` / `[notify:student]` / `[notify:all]` | Us group ke phone par **automatic push** jaata hai: "naya update aaya". |
| Naya **APK** banana (Actions → *Build Android App* → Run workflow) | APK GitHub Release me jaata hai, `app-version.json` badalta hai, admin/student ko push jaata hai. |
| Purane APK wala app kholta hai / "Update check karein" dabata hai | "**Naya APK aaya hai**" dialog → Download → Install. Admin ko APK alag se bhejna nahi padega. |

Exam/solution chalte waqt dialog nahi aata (exam khatam hone par aata hai).

## Setup (sirf ek baar)

### 1) Cloudflare Worker
1. `push-worker/worker.js` ka naya code Worker me paste karke **Deploy**.
2. Worker → Settings → Variables and Secrets → **Secret** naam `BROADCAST_SECRET`, value = koi lamba random password (jaise 30+ akshar). Copy kar lo.

### 2) GitHub repo secrets
Repo → Settings → Secrets and variables → Actions:
- **Secrets** me naya: `BROADCAST_SECRET` = wahi password jo Worker me daala.
- *(Optional)* **Variables** me `PUSH_WORKER_URL` = apna Worker URL (nahi doge to code wala default URL chalega).

### 3) ⚠️ APK signing (sabse zaroori)
Android sirf us APK ko purane app ke upar install hone deta hai jo **usi key** se sign ho.
Isliye in 4 secrets me **wahi keystore** daalo jis se aapne ab tak APK sign kiye hain (aapki `sign-apk.bat` wali keystore):
- `ANDROID_KEYSTORE_BASE64` (keystore file ka base64)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Ye secrets set nahi honge to workflow auto-update APK **publish hi nahi karega** (debug APK har baar alag key se banta hai, wo install nahi hota).

### 4) Files GitHub par upload
Is folder ki sab files repo me usi jagah daalo (same path). `.github/workflows/` wali 2 files bhi.

## Roz ka use
- **Sirf website update:** file upload karo. Commit message me likho, jaise: `Naya quiz feature joda [notify:all]`
  (tag nahi likha = notification nahi jayega, update phir bhi lag jaayega.)
- **Naya APK:** Actions → *Build Android App* → *Run workflow* → audience / notes chuno → Run. Baaki sab automatic.
  (Zaroori update banana ho to `force` tick karo.)

## Zaroori baatein
- Pehli baar Android "is source se install" ki permission maangta hai — user ko ek baar Allow karna hota hai. Install me ek tap Android khud maangta hai; chupchaap install Android me allowed nahi.
- Jo APK `APP_URL` set hone se pehle bane the (bundled copy), unhe **ek baar** naya APK dena padega. Uske baad hamesha automatic.
- Notification tabhi milegi jab phone me Allow kiya ho (admin ko bhi ab permission popup aayega). Admin/student ka push topic web code se judta hai, isliye live-URL wale app me naya code aate hi chalu ho jaata hai.
- Naye `@capacitor/browser` plugin ke bina bhi purana APK download khol leta hai (fallback), par naya APK ban jaye to aur smooth chalega.

## Students ko automatic notification (app ke andar ke events)
Ye `admin-notify.js` + `exam-manager.js` se chalta hai (koi GitHub tag nahi chahiye):
- **Naya test bana / publish hua** → "Naya Test Publish Hua!" (start time future ho to "Naya Test Schedule Hua! … 5 Jan, 10:30 am se shuru hoga").
- **Exam Manager me exam Publish hua** → "Exam Result Publish Hua".
- Draft save / auto-save par **nahi** jaata. Pehle se live test EDIT karne par **nahi** jaata. Ek test/exam ke liye sirf **ek baar** jaata hai.
- Students ko in-app Notifications list me bhi dikhta hai, aur app band ho tab bhi phone par push aata hai.

## App band ho tab bhi notification kaise aata hai
Naya test publish/create hote hi: notification doc banta hai → admin ka app Worker ko bulata hai → Worker FCM se institute ke sab students ko bhejta hai → Android khud phone par dikha deta hai (app band ho tab bhi).
Shart: student ne app me ek baar login kiya ho + Notification **Allow** ki ho + Worker me `SERVICE_ACCOUNT_JSON` set ho + admin email se login ho.
Notification high-priority channel ("Tests & Updates") par aati hai, isliye screen par pop-up bhi dikhti hai.
