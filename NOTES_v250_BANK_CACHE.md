# v250 — Question Bank: device cache + silent update, naye question sab jagah (web 1.4.36, build 250)

## Kya badla
1. **Question Bank ab device (IndexedDB) me save rehta hai** (own-backend.js, `persistCache`).
   App dobara khulne par: saved list TURANT dikhti hai -> phir chupke se sirf badle hue question aate hain
   (`since=`), ek chhota `count` check delete pakadne ke liye. Kuch nahi badla = sirf 2 chhote requests.
2. **Paper Generator aur Question Bank ab ek hi saved copy / ek hi sync use karte hain**,
   isliye dono me same question dikhenge. Pehle Paper Generator har baar apna alag poora download karta tha.
3. **Purana 12-ghante wala wait hata diya**: pehle cache "fresh" ho to naya question 12 ghante tak sync hi nahi hota tha.
   Ab har app-open par silent check (ye ab sasta hai, poora download nahi).
4. **Bug fix (own-backend.js)**: sync beech me fail ho (Render sleep/network) to jo live updates queue me the wo gum ho jate the -> list purani reh jati thi. Ab nahi khoyenge.
   Reconnect par ab poora reload nahi, sirf delta.
5. **Hata diye (permanent)**: "🔄 Refresh from Firebase" button aur "🔍 Search Questions" box (Question Bank screen).
6. Paper Generator: agar koi question admin ki allowed classes ke bahar hone se chhup raha ho to ek baar toast + console warning aayegi.

## Reads
- questionBank apne backend (Render) par hai -> **Firebase reads = 0**. Firebase fallback ka rasta jaisa tha waisa (12h cache rule wahi).
- Backend repo me kuch nahi badla.

## Files (upload karein)
own-backend.js, script.js, index.html, qgen-app.js, question-generator.html, app-config.js,
sw.js, version.json, package.json + tests/unit/test_own_backend_cache_v250.js (optional)

## Kill-switch
app-config.js me `persistCache: []` kar do -> purana tareeka (har baar poora load).

## Dhyan
- Jab app band tha tab koi question DELETE hua ho to agle open par ek baar poora reload hoga (count match nahi hota). Sirf add/edit par poora reload nahi.
- Pehli baar (cache khali) poora load hoga, uske baad nahi.
- Check: node --check OK, unit tests 53 me se sab pass (naya test shamil).
