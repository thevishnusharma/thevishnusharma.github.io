# Phase 6 (v224) — Institute ke liye pitch, demo, checklist aur legal appendix

Version 1.4.19 / build 224. Base: v223 (Phase 5 zip).

## Kya badla
- **`pitch.html` (naya, noindex):** SnapTest Pro ki features (sirf wahi jo repo mein code ya workflow se maujood hain: practice/exam tests, OMR scan, results/rank/leaderboard, batch/attendance/CSV, notifications, offline sync, Result Tools, Fee Due, Daily Challenge, institute APK). "Kya abhi nahi karta" section: Cloud Functions nahi, anti-cheat sirf record, streak device par, parent report mein attendance nahi, online UPI payment nahi.
  - Isme 2 minute demo script (6 steps, timing ke saath) aur institute owner ke liye pehle din ki 10-point checklist hai.
- **`privacy.html`, `terms.html`:** neeche "Parishisht (Appendix): Institute ke liye template" jodi. Placeholders `[LIKE_THIS]`, "ye legal advice nahi hai" aur CA/lawyer check ka zikr.
  - **Version nahi badla.** `2026-10-15-v1` student ki consent record mein jaata hai (`script.js` registration, `app-config.js` `privacyVersion`/`termsVersion`). Student-facing text wahi hai, isliye purane users ki sahmati par asar nahi. Agar counsel student text badle, to dono version string bhi badlein.
- **Version 1.4.19 / build 224** (stamp se sw, app-config, package sync).

## Pehle se mojood jo bataya gaya
- Checklist ka pehla kaam: `app-config.js` mein support WhatsApp (9525208263), email aur hours abhi developer ke hain. Institute ke liye badalna zaroori hai. Ye code ka bug nahi, lekin har institute ko ye badalna hoga. Pitch checklist mein ye pehla point hai.

## Tests
- `tests/unit/test_phase6_v224.js`: pitch ke teeno hisse, noindex, legal-advice chetavani, overclaim check (UPI, auto-send sirf negation mein, developer contact nahi), appendix placeholders aur footer se pehle jagah, student-facing version aur draft notice wahi.
- `npm test`: **41/41 passed** (v223 ke 40 + naya 1).
- `stamp --check`, `build:www`, `check:precache` (103 entries): pass.
- Pitch aur legal pages ke HTML tags balance check kiye (koi unclosed tag nahi).
- **Nahi chala:** browser par page render (visual), phone par link, Firestore, Android APK.

## Deploy steps (phone se)
1. GitHub par `main` mein Phase 6 ki files upload/replace karein (list neeche). Commit message mein `[notify:all]` na dalein jab tak pages phone par na dekh lein.
2. Pages deploy hone ke baad `/pitch.html`, `/privacy.html`, `/terms.html` khol kar check karein.
3. Rules ya Worker mein kuch nahi.

## Rollback
- Pages mein kuch bhi chalu/band karne wala switch nahi hai. Puri rollback: Phase 6 commit revert karein. `pitch.html` hatane se app par koi asar nahi (koi link nahi hai).

## Phone/browser check checklist (Phase 6)
1. `/pitch.html` seedha khule, teeno section dikhein, text kat na raha ho.
2. `/privacy.html` aur `/terms.html` ke aakhir mein appendix dikhe; upar ka text pehle jaisa.
3. Student registration screen par Terms/Privacy links wahi version dikhayein (`2026-10-15-v1`).

## Files (Phase 6 ka change)
- Naye: `pitch.html`, `tests/unit/test_phase6_v224.js`, `docs/notes/PHASE6_v224_NOTES.md`
- Badle: `privacy.html`, `terms.html`, `version.json`, `package.json`, `sw.js`, `app-config.js` (version/build), `docs/CHANGELOG.md`

## Limitations
- Pitch page app ke menu se linked nahi hai; sirf seedha link se khulta hai (sales ke liye jaan-bujh kar).
- Legal appendix template hai; kanooni sahi hone ki guarantee nahi.
- Demo steps "Phase 5" features par bhi hain; wo abhi phone par check hone baaki hain (Phase 5 notes dekhein).
