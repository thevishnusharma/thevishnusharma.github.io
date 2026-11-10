# v285 — Download / landing page (naya, alag file)

**Version:** web 1.4.71, build 285 (v284 text cleanup ke upar)

## Kya naya
- **download.html** — public page: dark+gold design, institute search, har institute ka Download APK aur Web par kholein, install ke 3 kadam, features, FAQ, owner section.
- Institute list GitHub Releases se khud aati hai (tag `inst-<slug>-b<N>`, notes me `Institute: <id>`). Har institute ka sabse naya APK dikhta hai. Koi Firestore read nahi.
- `_headers` (no-cache) aur `sitemap.xml` me download.html joda.

## Jo NAHI badla
- index.html, sw.js logic, manifest, session keys, workflows — kuch nahi chhua. App root (/) pehle jaisa khulta hai, purane students/APK par asar nahi.
- download.html service worker precache me nahi hai (sirf pehli baar online khulne par cache hota hai).

## Dhyan
- GitHub API anonymous 60 requests/ghante/IP deta hai; limit par page "list load nahi hui" dikhata hai.
- Release sirf signed APK par banta hai (keystore secret), warna institute list me nahi aayega.

## Root par landing (hamesha pehle)
- Browser me `/` kholne par hamesha pehle `/download.html` khulta hai (purane/logged-in user ko bhi). App tabhi khulta hai jab landing ka "Web par kholein" (`/?app=1`) dabaya ho; ye sirf us tab/session ke liye yaad rehta hai (sessionStorage), naya session = dobara landing.
- Seedha app par jaate hain: installed PWA (standalone), Capacitor/Android WebView APK, `?inst=`, `?owner=1`, aur app ke andar ke same-site redirect/reload.
- Rollback: inline/index-inline-01.js se `stp_web` wala block hata dein.
