# The Vishnu Sharma — Archived update guide (v157 → v163)

> **Historical / stale:** this guide documents v157–v163. Do not follow its old upload or deployment steps as current instructions. In particular, Section 1's claim that the two Worker sources and two Android workflow files are identical is stale. Current canonical paths are in `docs/setup/README.md`; the current release process is `docs/RELEASE.md`.

Ye ek hi guide hai: **kya-kya naya bana, kaun si file kya karti hai, upload kaise karein, ek baar ka setup, kya check karna hai, kya working hai aur kya nahi, dikkat aaye to kya karein.**
Poori guide ek baar padh lijiye, phir **Section 6 (Checklist)** ko ek-ek karke tick karte jaayiye.

---

## 0. Ek nazar mein — kya-kya naya hai

| Version | Kya bana |
|---|---|
| v157–158 | **Admin Settings** ka naya professional look: Menu, Profile & Institute (ID Card ab Profile ke andar), Institute Join Code, Admin Password, Notifications, App & Data (Seed bhi yahin), App Theme, Owner Panel |
| v159 | **Auto-update system**: website update apne-aap; naya **APK** aaye to app me "Naya APK aaya hai" dialog; APK GitHub Release se download; GitHub Actions se auto-build + push notification |
| v160 | **Test notification**: naya test Create Test form se bane ya Publish ho → students ko notification (pehle sirf draft-Publish par jaata tha). Future start time ho to "Schedule Hua" wala message. **Exam Manager** me exam publish → notification |
| v161 | Notification **high-priority channel** (screen par pop-up bhi) |
| v162 | Student ke "Update check" button se bhi naya APK dikhta hai |
| **v163** | **Student Settings** ka naya look · **Offline mode** (saved data se app chale, offline badlav internet aate hi online save, notice) · **App khula ho tab bhi notification** (banner) · Android Back button se Settings sub-page band |

Firestore rules me **koi badlav nahi** karna. Koi naya Firestore collection nahi bana.

---

## 1. Files ki poori list

> Zip me sab files **repo ke andar wale same path** par rakhi hain. Poori zip ek saath upload kar sakte hain (purani upload ho chuki files dobara daalne se kuch bigadta nahi).

### A. NAYI files (5)
| File | Kya karti hai |
|---|---|
| `app-update.js` | Android app me naya APK check karti hai (app khulne par + wapas aane par). `app-version.json` GitHub se padhti hai, naya build mile to dialog dikhati hai, Download = GitHub se APK. Exam ke beech dialog nahi. |
| `app-version.json` | "Latest APK kaun sa hai" ka record (build number, download link, notes). GitHub Actions isse **apne-aap** update karta hai. Pehle `build: 0` hai = koi APK update nahi. |
| `offline-sync.js` | Offline mode: offline pill, "data abhi online save nahi hua" notice, "N baaki" count, "sab online save ho gaya" confirmation, "Abhi sync karein". |
| `student-settings-pro.js` | Student Settings ka naya look (Menu + Profile & ID Card, Notifications, Display & Exam, App & Data). |
| `.github/workflows/announce-update.yml` | GitHub par file upload karte waqt commit message me `[notify:all]` likhne par students/admin ko push bhejti hai. |

### B. BADLI hui files (13)
| File | Kya badla |
|---|---|
| `admin-settings-pro.js` | Admin Settings naya look + pages; Update check ab APK bhi check karta hai; App & Data me naye APK ka card |
| `admin-notify.js` | Naya test (form se / publish) par notification; schedule wording; Exam publish notification; edit/draft par nahi |
| `exam-manager.js` | Exam "Publish" dabane par notification call (1 line) |
| `app-ui.js` | Student ke purane Update check me APK check |
| `native-push.js` | Admin ko `app_admin`, student ko `app_student` topic; **app khula ho tab banner**; notification tap par sahi page; offline push queue; high-priority channel |
| `back-button-guard.js` | Android Back se student Settings sub-page band hota hai |
| `index.html` | 3 nayi script lines (`app-update.js`, `offline-sync.js`, `student-settings-pro.js`) |
| `sw.js` | Cache `v163`, nayi files precache me |
| `package.json` | `@capacitor/browser` plugin (APK download ke liye) |
| `worker.js` + `push-worker/worker.js` | Historical copies. This statement that they were identical is stale. Use `push-worker/worker.js`. |
| `.github/workflows/build-android.yml` + root `build-android.yml` | Historical duplicate references. Use `.github/workflows/build-android.yml`; the root duplicate has been removed. |

### C. Jo files NAHI badli
`script.js`, `firebase-config.js`, `firestore.rules`, `styles.css`, `id-card.js` aur baaki sab — kuch karna nahi.

---

## 2. Upload kaise karein (is order me)

1. Zip ko computer par extract karein.
2. GitHub repo kholein → **Add file → Upload files** → extract kiye folder ki **saari files aur folders** drag karein (`.github` folder bhi).
3. Commit message likhein, jaise: `v163 final update`
   *(Agar `[notify:all]` likhoge to commit hote hi sabko notification chala jaayega — abhi mat likhna, pehle setup poora karo.)*
4. 1–2 minute GitHub Pages deploy hone dein.
5. **Section 3 ka setup karein** (Cloudflare + GitHub secrets).
6. Phir Section 6 ka checklist.

> Website wala update (settings look, offline, notification banner, student settings) **purane live-URL APK me bhi apne-aap** aa jaata hai. Naya APK in sab ke liye zaroori **nahi** hai.

---

## 3. Ek baar ka setup

### 3.1 Cloudflare Worker (push ke liye)
1. Cloudflare → aapka Worker → **Edit code** → `push-worker/worker.js` ka naya poora code paste → **Deploy**.
2. Worker → **Settings → Variables and Secrets** → **Add** → type **Secret**:
   - Name: `BROADCAST_SECRET`
   - Value: koi lamba random password (30+ akshar). **Copy kar lo.**
3. `SERVICE_ACCOUNT_JSON` secret pehle se hoga (aapka push chal raha hai) — usse mat chhedna.

### 3.2 GitHub secrets
Repo → **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Value |
|---|---|
| `BROADCAST_SECRET` | wahi password jo Worker me daala |
| `ANDROID_KEYSTORE_BASE64` | keystore file ka base64 (neeche tareeka) |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key password |

**Keystore base64 (Windows PowerShell):**
```
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\debug.keystore")) | Set-Clipboard
```
(clipboard me copy ho jaata hai, secret me paste kar do)

> ⚠️ **Sabse zaroori:** ye **wahi keystore** honi chahiye jis se aapne ab tak APK sign kiye hain (`sign-apk.bat` wali). Android naya APK sirf usi key se purane ke upar install hone deta hai. Alag key = "App not installed" error. Ye 4 secrets nahi honge to workflow auto-update APK **publish hi nahi karega** (galat APK se kisi ka install na toote, isliye).

Variables (same page ka **Variables** tab): `APP_URL` pehle se set hai (`https://thevishnusharma.github.io/`). `PUSH_WORKER_URL` optional.

---

## 4. Roz ka kaam (cheat sheet)

| Kaam | Kaise |
|---|---|
| **Sirf website/app ka update** (HTML/JS/CSS) | GitHub par file upload karo. Bas. App me apne-aap lag jaata hai (users ko app background→wapas aane par naya version milta hai). |
| Update ke saath **sabko notification** | Commit message me tag likho: `Naya quiz feature joda [notify:all]` · sirf admin: `[notify:admin]` · sirf students: `[notify:student]`. Tag ke bina notification **nahi** jaata. |
| **Naya APK** banana | GitHub → **Actions → Build Android App → Run workflow** → *audience* (both/admin/student/none), *notes* (kya naya hai), *force* (zaroori update?) → Run. Baaki sab automatic. |
| Zaroori APK update (purana app band) | Run workflow me **force** tick karo — "Baad mein" button hat jaata hai. |
| Naya test / exam publish | Kuch nahi karna — notification **apne-aap** jaata hai. |

---

## 5. Har feature kaise kaam karta hai

### 5.1 Notifications — kab, kise, kaise
| Event | Kise | Notification | Kab jaata hai |
|---|---|---|---|
| Naya test (Create Test form se) | Institute ke students | "Naya Test Publish Hua!" | Save hote hi |
| Draft ko Publish | Students | Wahi | Publish hote hi |
| Test ka start time aage ka ho | Students | "Naya Test Schedule Hua! … 5 Jan, 10:30 am se shuru hoga" | Save hote hi |
| Exam Manager me exam Publish | Students | "Exam Result Publish Hua" | Publish hote hi |
| Admin ka apna notification (Settings → Notifications) | Students | Jo likha | Bhejte hi |
| Naya APK build | Admin/Student/Both (aap chunte ho) | "Naya APK aaya hai" | Build ke ~2 min baad |
| GitHub upload + tag | Tag ke hisaab se | Commit message | ~1 min baad |

**Nahi jaata:** draft save/auto-save, pehle se live test ka edit, ek hi test/exam ke liye dobara.

**App band ho tab:** phone ka system notification dikhata hai (pop-up + tray).
**App khula ho tab:** upar ek banner slide-in hota hai; banner par tap = notifications page. Exam chal raha ho to banner **nahi** aata (bell me jud jaata hai). Same notification 20 second me dobara banner nahi banata.
**Notification tap karke app khole:** "Naya APK" wale par update dialog; baaki par notifications page.

### 5.2 Offline mode
- **App offline khulti hai:** app ki files aur Firebase SDK phone me saved hain; question bank aur tests bhi saved hain.
- **Offline badlav:** jo bhi aap offline save karo (test, join code, result, photo, settings…) phone ke andar queue me jaata hai.
- **Aapko kya dikhta hai:**
  - Upar chhota pill: `Offline — saved data se chal raha hai • N baaki`
  - Har offline badlav par notice: **"Data abhi online save nahi hua — phone me safe hai. Internet aate hi apne-aap online upload ho jaayega."**
  - Internet aate hi pill "badlav online save ho rahe hain…" phir hara **"Sab online save ho gaya"** + toast.
  - Admin ka offline publish kiya test: push notification **online save hone ke baad** hi jaata hai (phone akele bhej bhi nahi sakta, aur students ko test tab dikhega jab online ho).
  - Network kamzor ho (3 second se zyada ack na aaye): wahi notice "Network kamzor hai…".
  - Settings → App & Data → **Offline & Sync** card: status + "Abhi sync karein".
- **Online hone par kuch nahi badla:** normal saving me koi pill/toast nahi aata.

### 5.3 Auto-update
- **Website update:** service worker har minute check karta hai; naya mile to chupchaap install; app background→wapas aane par reload (exam/solution ke beech nahi).
- **APK update:** `app-version.json` me naya build number > phone me installed build → dialog → **Download & Update** → Chrome se APK download → file par tap → **Install**. Data/login bana rahta hai.

---

## 6. ✅ CHECKLIST — upload ke baad ye sab check karein

> Har step me **Expected** likha hai. Jo na mile use Section 8 (Troubleshooting) me dekhein.

### A. Pehli jaanch (2 min)
- [ ] **A1.** Website kholein → page normal khula, blank nahi. **Expected:** login screen/home dikhta hai.
- [ ] **A2.** Phone ka app band karke dobara kholein, 1–2 baar background/foreground karein. **Expected:** naya version lag jaata hai (Settings → About me build `163`).
- [ ] **A3.** (Optional) PC browser me `F12 → Console` — **Expected:** koi laal error nahi (`[SnapPush]`/`[OfflineSync]` warning normal ho sakti hai).

### B. Admin Settings
- [ ] **B1.** Admin login → Settings. **Expected:** upar institute card (naam, email, Active), neeche groups: Account / Manage / Support / Owner, aur Admin Logout. **Purane lambe cards (ID Card, Join Code, Theme, Seed, Password) ab menu me nahi dikhne chahiye.**
- [ ] **B2.** **Profile & Institute** → upar ID Card. Logo par tap, photo, naam badal kar dekhein. **Expected:** pehle jaisa kaam karta hai; back karke dobara kholo to card wahi.
- [ ] **B3.** **Institute Join Code** → "Protection ON" + code bada. Naya code daal ke Save; "Protection Hatayein". **Expected:** status badalta hai, menu row ka subtitle bhi.
- [ ] **B4.** **Admin Password** → Change Password, Recovery Info, Admin Logout (Logout par abhi mat dabana jab tak test baaki ho).
- [ ] **B5.** **Notifications** → "Notification bhejein" khulta hai; status "Chalu hai" (hara).
- [ ] **B6.** **App & Data** → Update check, Cache saaf, Question Bank (Refresh/Publish/Seed). **Expected:** sab button pehle jaise.
- [ ] **B7.** **App Theme** row → theme picker seedha khulta hai. **Owner Panel** row → Owner Panel khulta hai.
- [ ] **B8.** (Phone) Sub-page khol kar **Android Back** dabayein. **Expected:** sub-page band hota hai, app band nahi hota.

### C. Student Settings
- [ ] **C1.** Student login → Settings. **Expected:** upar student card (naam, Class, institute, streak), groups: Account / Preferences / Data / Support + Logout. Purana lamba settings gayab.
- [ ] **C2.** **Profile & ID Card** → ID Card + "Meri Details" (Naam, ID Number, Class, Session). Photo par tap karke photo lagayein. **Expected:** upload chalta hai; admin ke Students Directory me dikhti hai.
- [ ] **C3.** **Notifications** → ON/OFF button dabayein. **Expected:** title "ON hain/OFF hain" badalta hai; menu me "Naye test ka alert • ON/OFF".
- [ ] **C4.** **Display & Exam** → Theme "Chunein" (picker upar dikhna chahiye, peeche chhupna nahi), Text size (Chhota/Normal/Bada turant lagta hai), Exam screen-on switch.
- [ ] **C5.** **App & Data** → Update check, Cache saaf, Offline & Sync card.
- [ ] **C6.** Help & Support, About App kholein → back karein. **Expected:** wapas naye Settings menu par.
- [ ] **C7.** Logout. **Expected:** logout ho jaata hai.
- [ ] **C8.** (Phone) Sub-page par Android Back. **Expected:** sub-page band, app nahi.

### D. Notifications (2 phone chahiye: admin + student; student ne ek baar login + Allow kiya ho)
- [ ] **D1.** **Student app BAND** (recent apps se bhi hata do). Admin se **naya test** Create Test form se banao. **Expected:** ~10 second me student phone par "Naya Test Publish Hua!" pop-up + tray.
- [ ] **D2.** **Student app KHULA.** Admin se dusra naya test. **Expected:** upar banner slide-in; tap → notifications page; bell me bhi item.
- [ ] **D3.** Admin ek test **edit** kare (naya nahi). **Expected:** koi notification nahi.
- [ ] **D4.** Admin **draft save** kare. **Expected:** koi notification nahi. Phir draft ko **Publish**. **Expected:** notification.
- [ ] **D5.** Future start time wala test. **Expected:** "Naya Test Schedule Hua! … se shuru hoga".
- [ ] **D6.** Exam Manager me exam **Publish**. **Expected:** "Exam Result Publish Hua".
- [ ] **D7.** Admin Settings → Notifications se custom message. **Expected:** student ko (band aur khula dono me).
- [ ] **D8.** Student ek **test de raha ho** tab notification bhejo. **Expected:** banner nahi aata; test ke baad bell me hota hai.
- [ ] **D9.** Student phone me Notifications **OFF** karo, naya test banao. **Expected:** is student ko nahi aata.

### E. Offline mode (phone ko Airplane mode me daalke)
- [ ] **E1.** Student: app pehle online khol ke tests dekh lo. Airplane ON → app band karke kholo. **Expected:** app khulti hai, upar pill "Offline — saved data se chal raha hai", purane tests dikhte hain.
- [ ] **E2.** Offline me student ek test do aur submit karo. **Expected:** result save hota hai, toast **"Data abhi online save nahi hua…"**, pill me "1 baaki".
- [ ] **E3.** Airplane OFF. **Expected:** pill "badlav online save ho rahe hain…" → hara "**Sab online save ho gaya**" + toast. Admin ke Records me result aa gaya.
- [ ] **E4.** Admin offline me koi chhota badlav (jaise test ka title) save kare. **Expected:** E2 jaisa notice; internet aate hi online.
- [ ] **E5.** Admin offline me **naya test banaye**, phir online ho. **Expected:** test online save hone ke baad students ko notification jaata hai ("Offline — push internet aate hi chala jaayega" toast offline me aata hai).
- [ ] **E6.** Offline badlav karke **app band kar do**, phir internet ON karke app kholo. **Expected:** kuch second me pill "online save ho rahe hain" → "Sab online save ho gaya".
- [ ] **E7.** Student Settings → App & Data → **Offline & Sync**: offline me status "Offline • N baaki"; online me "Sab online save hai"; "Abhi sync karein" kaam karta hai.
- [ ] **E8.** **Normal online save** (jaise test edit) me pill/toast **nahi** aana chahiye.

### F. Update system
- [ ] **F1.** Settings → App & Data → **Update check** (admin aur student dono). **Expected:** "Aap latest version par hain" (jab tak naya APK na bane).
- [ ] **F2.** (Pehla naya APK) GitHub → Actions → **Build Android App** → Run. Green tick ka wait. **Expected:** repo me **Releases** me `The Vishnu Sharma 1.0.N` + `SnapTestPro.apk`; `app-version.json` me `build` badal gaya.
- [ ] **F3.** Purani APK wale phone par app kholo ya Update check dabao. **Expected:** "**Naya APK aaya hai**" dialog (Download & Update / Baad mein).
- [ ] **F4.** **Download & Update** → Chrome download → file par tap → Install. **Expected:** purane app ke upar install, login/data bana. (Pehli baar "Install unknown apps" permission Allow karni pad sakti hai.)
- [ ] **F5.** Build ke ~2 min baad admin/student phone par push "Naya APK aaya hai" (audience ke hisaab se).
- [ ] **F6.** "Baad mein" dabao → 12 ghante dialog dobara nahi; Update check button dabao to turant aata hai.
- [ ] **F7.** (Force test) Run workflow me force tick → dialog me "Baad mein" **nahi** hona chahiye.

### G. GitHub se notification
- [ ] **G1.** Chhoti file badal ke commit message `test update [notify:admin]`. **Expected:** ~1 min me sirf admin phone par push; Actions me "Update notification" green.
- [ ] **G2.** Bina tag ke commit. **Expected:** koi push nahi.
- [ ] **G3.** Worker test (PC par):
```
curl.exe -X POST https://cool-thunder-a280.vishnu1234stm.workers.dev/broadcast -H "Content-Type: text/plain" -d "{\"secret\":\"AAPKA_SECRET\",\"audience\":\"admin\",\"kind\":\"web\",\"title\":\"Test\",\"body\":\"Test notification\"}"
```
**Expected:** `{"ok":true,"sent":["app_admin"]}`. Galat secret → `403`.

---

## 7. Kya working hai aur kya nahi — seedhi baat

### ✅ Jo maine khud test kiya (simulated environment me, sab pass)
- Admin Settings + Student Settings: har page, har button, purane elements ka naye page me jaana aur wapas aana, koi JS error nahi.
- Offline: offline write turant resolve, pill/toast/count, internet aane par "sab online save ho gaya", slow network, reject hone par warning, app restart par purane pending writes, online normal save par koi badlav nahi.
- Foreground banner, dedupe, exam ke beech suppression, tap routing, offline push queue + flush.
- Naya test/draft/edit/publish/schedule/exam ke notification rules.
- Worker `/broadcast` (sahi/galat secret, admin/student/both), publish-push flow (token, creator check, 15 min window, dobara push nahi).
- Firebase 9.22 ke asli SDK me wo sab methods maujood hain jin par offline code laga hai.
- Sab JS/JSON/YAML syntax; index.html ki saari script files maujood.

### ⚠️ Jo sirf aap phone par confirm kar sakte hain (maine asli phone/GitHub/Google se nahi chalaya)
- Asli FCM delivery (app band hone par notification aana), notification channel pop-up.
- Asli APK install, Chrome se download, GitHub Actions ka asli run.
- Android WebView me Firestore ki offline queue (Firebase ka standard feature hai, par device par test zaroori — **E1–E6**).

### Limits (Android/Firebase ki wajah se, hum badal nahi sakte)
1. **Online upload tab hota hai jab app khula ho ya agli baar khule.** Android me app band hone par uska code nahi chalta, isliye band app se "synced" notification nahi aa sakta. Data phone me safe rehta hai; app kholte hi upload ho jaata hai.
2. **Pehli baar login aur data load ke liye internet chahiye.** Jo data kabhi load hi nahi hua wo offline nahi dikhega.
3. **Offline nahi ho sakta:** naya student register karna, password badalna, Owner Panel, push bhejna (push internet aate hi apne-aap jaata hai), transactions.
4. **APK install me ek tap Android khud maangta hai**; chupchaap install Android allow nahi karta.
5. **Same keystore** zaroori (Section 3.2).
6. Jo APK `APP_URL` set hone se pehle bana tha (bundled copy) usme ye sab nahi aayega — use **ek baar** naya APK dena padega.
7. Notification poore institute ke students ko jaata hai (class-wise nahi).
8. **Owner Panel row sabko dikhta hai** (pehle jaisa). Sirf owner ke liye chhupana ho to bata dena.
9. GitHub-upload notification abhi **tag se** hai. "Bina tag ke bhi automatic (sirf asli app files badalne par, 6 ghante me 1 baar)" chahiye to bata dena.

---

## 8. Dikkat aaye to (Troubleshooting)

| Dikkat | Wajah | Kya karein |
|---|---|---|
| Naya look nahi dikha | Purana cache | App background karke wapas kholo; ya Settings → Cache saaf karke refresh |
| Student ko push nahi aaya | Permission/login | Phone Settings → Apps → The Vishnu Sharma → Notifications Allow; student ek baar naya app khol ke login kare |
| Push "403 / Aap creator nahi" | Admin email se login nahi | Admin email/password se login karein |
| Push "Notification purani hai" | Online save me 15 min se zyada der | Normal; in-app list me notification phir bhi dikhta hai |
| `[notify]` wala push nahi gaya | `BROADCAST_SECRET` GitHub/Worker me mismatch | Dono jagah **wahi** secret; Actions log dekhein |
| `/broadcast` 403 | Secret galat | Worker aur GitHub secret match karein |
| `/broadcast` 500 "SERVICE_ACCOUNT_JSON" | Worker me service account nahi | Purani push setup guide (`PUSH_SETUP_FREE_REALTIME.md`) |
| Actions me APK publish skip | Signing secrets nahi | Section 3.2 ke 4 secrets |
| APK install par "App not installed" | Alag keystore | Wahi keystore daalein jisse purane APK sign hue |
| APK update dialog nahi aaya | Purana bundled APK / internet nahi / build number kam | Section 7 limit 6; `app-version.json` me `build` dekhein |
| Offline pill nahi aaya | Browser me airplane test ka matlab navigator.onLine | Asli phone me Airplane mode se test karein |
| Offline badlav online nahi hua | App band tha / internet nahi | App kholein + internet ON; Settings → App & Data → Abhi sync karein |
| "Ek offline badlav server ne accept nahi kiya" | Rules ne reject kiya (jaise permission) | Admin login/permission dekhein, badlav dobara karein |
| Theme picker Settings page ke peeche | (Theek kiya hua hai) | Agar phir dikhe to batayein |
| Android Back se poora app band | Sub-page overlay | `back-button-guard.js` upload hua ya nahi dekhein |

---

## 9. Rollback (wapas purane par)
1. GitHub repo → **Commits** → is update se pehle wala commit → **Revert** (ya purani files wapas upload).
2. `sw.js` ka cache naam badalna mat bhulna (v164 jaisa) taaki phone par purana wapas aaye.
3. Naya APK Release hata sakte ho (Releases → Delete). `app-version.json` me `"build": 0` kar do to koi APK dialog nahi aayega.

---

## 10. Naya APK banne ke baad kya naya aayega

**Naya APK ke bina bhi** (live-URL APK) ye sab pehle se milta hai: naye Settings, offline mode, banner, notification rules, update dialog.

**Naya APK se aur milega:**
- `@capacitor/browser` plugin — "Download & Update" Chrome Custom Tab se **smooth** khulta hai (purane APK me bhi chalta hai, bas seedha link kholne wale fallback se).
- Aage koi bhi native badlav (permission, naya plugin, icon/naam, Firebase config) sirf naye APK se aata hai — tab Section 4 wala "Naya APK" flow chalaiye.

**Naya APK banane ke baad ye check karein:**
- [ ] Release me `SnapTestPro.apk`, version `1.0.<run number>`.
- [ ] Settings → About me build number badha hua.
- [ ] Purane phone par dialog → install → login/data bana.
- [ ] Naye APK me notification, offline, settings sab pehle jaisa (Section 6 ke B–E dobara halka-sa).

---

*Guide v163 · Files ka total: 5 nayi + 13 badli.*
