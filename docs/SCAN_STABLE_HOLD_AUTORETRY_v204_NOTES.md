# Scan Sheet — stable-hold capture, auto-retry, lighter camera (v204)

Report: 10 scans mein se sirf 1-2 sahi; 4 corners mil jaane ke baad 1-2 sec se zyada nahi lagna chahiye; camera lag nahi.

## Root cause
v21 ne capture trigger 1 frame kar diya tha: jis tick par 4 corners pehli baar green hue, usi frame (hilta haath, focus hunting, blur)
par photo le li jaati thi, aur corner positions ek hi frame ki raw read thi.

## Changes (exam-manager.js, Ct / Fn / Fn2)
- **Stable-hold gate:** capture tab hota hai jab 4 corners *fresh* detect hon aur ~0.9s (`_HOLD`) tak steady rahein
  (tick-to-tick movement <= 0.45% of frame width, window spread <= 0.9%). Hilne par hold wahin se restart.
  Sharp frame (`_shOk`) chahiye; nahi mile to +0.6s baad bhi capture (kabhi atakta nahi).
- **Shaky hand fallback:** 1.2s se zyada 4 corners dikhte rahein to tolerance 1% tak relax -> worst case ~2.5s.
- **Averaging:** corner position ab last 6 stable ticks ka average (`kn` 4 -> 6); grace ticks average mein nahi jaate.
- **Corner refine:** video-frame fallback mein bhi corners capture-resolution par `aa()` se re-detect hote hain (`_refinePts`).
- **Auto-retry:** agar warp ke baad registration squares < 30/45 (`sa`) to result dikhane ki jagah scanner khud dobara chalta hai
  (max 2 baar), warning message ke saath.
- **Camera lag:** full-size frame snapshot ab sirf stable window mein (har tick nahi) aur GPU canvas par; preview stream 1440x1920
  (final image HQ photo se aati hai, fallback ke liye 1440 wide kaafi hai).
- Test: `tests/unit/test_scan_stable_hold.js`. Tuning knobs: `_HOLD`, `.0045` / `.01` tolerances in `Ct()`.

---
## v205 — 3 corners enough + 45-square refit
- **3 corner trigger:** ab min 3 corners fresh detect hon to 4th corner sheet ke parallelogram se nikal liya jata hai (`vn()`), UI mein 4th box bhi green.
  Hold `_HOLD` 900 -> 500ms (3 ya 4 corners dono par). Hilne par restart / sharpness gate / auto-retry waise hi.
- **45-square refit (`_warp2`):** pehli warp ke baad jitne bhi registration squares (corner bhi grid ka hissa hain) mile, unse sheet->photo
  homography least-squares se dobara fit hoti hai (outlier trim ke saath) aur photo dobara warp hoti hai. Sirf tab apply jab squares >= pehle jitne
  aur mean offset kam ho — warna purani warp. Synthetic test: 4th corner 90px galat hone par bhi 45/45 squares align.
- Inferred corner ke liye `_refinePts` / HQ-photo re-detect ka tolerance wide (4%).
- Tests: `test_scan_stable_hold.js` (3-corner cases), `test_scan_refit_45.js` (refit maths + perspective photo).

---
## v206 — corner blinking fix (robust live detector + tracking)
- **Naya detector `_detLum/_detCorner`:** har corner ke liye video ke full resolution se zoomed crop (blue box ka 1.6x, yaani box ke bahar thoda
  misaligned marker bhi mile), 3 thresholds (white level ke 35/50/65%), shape + contrast + "kam se kam 2 thresholds par mile" checks.
  Bubbles / text / table-edge / hollow circles reject.
- **Tracking (`_trk`):** har corner ki last 5 ticks ki detections; corner ~4 ticks (≈0.5s) tak green rehta hai (ek-do tick ke fail par blink nahi),
  position median se. Hilna raw detection se turant pakda jata hai (`dv`), capture ke waqt kam se kam 3 corners ki taaza detection (`rc>=3`) zaroori.
- **Sanity:** capture se pehle quadrilateral ka aspect ratio check (`_quadOk`) — galat blob pakda gaya to capture nahi.
- Test: `tests/unit/test_scan_corner_detector.js`, `test_scan_stable_hold.js` (random 45% miss par bhi ~0.7s mein lock).

---
## v207 — rapid back-to-back scanning (auto-save)
- **⚡ Auto-save toggle** (camera screen ke beech mein, `snap_scan_auto`, default OFF): ON hone par clean scan 0.7s baad khud save hota hai aur
  scanner turant agli sheet ke liye khul jata hai.
- **Strict gate `_autoOk`:** >=40/45 squares, roll poora aur saaf, koi faint/multi flag nahi, blank <35%, photo dark nahi, aur is roll ka result
  pehle se saved nahi. Kuch bhi shak ho to purani review screen (manual Save) hi aati hai.
- **Duplicate guard:** save ke baad wahi sheet dobara capture nahi hoti; jab tak sheet camera se hat nahi jati (~0.8s) tab tak
  "✅ Saved: Roll X • N marks • Total k — ab agli sheet laayein" dikhta hai. Blinking detector ise galti se "sheet hati" nahi maanta.
- Save par haptic vibration + session counter. Tests: `test_scan_autosave_gate.js`, naye cases `test_scan_stable_hold.js` mein.

---
## v208 — camera par instructions hata di
Camera ke upar ka guide text ("Har kaale square ko blue corner box...") aur neeche ka status text ("Kaale OMR squares dhoonde...", "steady rakhein...") ab nahi dikhte
(CSS se hide). Sirf corner boxes, green/amber dot aur auto-save ka "✅ Saved: Roll X..." confirmation dikhta hai. Warnings (Retake wala quality banner) waise hi.

---
## v209 — double-mark safety net (dark blot beside a correct mark)
Report: Q22 mein student ne 2 option bhare (ek sahi + ek galat); scan ne sirf sahi wala pakda, galat chhod diya.
Rule (pehle se): 2+ marked option => answer galat + dono red. Ye rule intact hai; yahan *detection* ko mazboot kiya:
- `ln()` ke `pickBest` mein naya `_bl()` ("blot" check): har option ke aas-paas ±12px tak (curved paper / thodi misalignment) ek solid dark disc
  (radius 5 ka >=85% hissa dark) dhoondta hai. Mile to wo option bhi "marked" gina jata hai => multi => dono red.
  Radius/coverage aisa rakha hai ki padosi bubble ki ink se confuse nahi hota.
- Test: `test_multi_mark_blot_pipeline.js` (asli `ln` synthetic sheet par): offsets 4-12px par caught, 360 single marks par 0 false multi.
- Note: screenshot se asli wajah pakki nahi mili — synthetic mein purana code bhi 8px tak pakad leta tha. Is student ki original photo mile to aur tune hoga.

---
## v210 — Roll No misread par auto-retry
`Fn2` ka auto-retry ab sirf "reg squares kam" par nahi, balki tab bhi chalta hai jab Roll No mein "?" ya koi digit unread (null) ho
(max 2 baar, har baar fresh capture). Isse "Roll ??" wale kharab scan review screen tak nahi pahunchte; 2 retry ke baad bhi na padhe to result dikhta hai (user manually sahi kar sakta hai).

---
## v211 — roll labels, digit dropdown, thodi tez scan
- OMR sheet (HTML preview/print + canvas version) ke Roll No boxes ke andar chhapa "1 2 3.." label hata diya (wo pre-filled roll "12" jaisa dikhta tha). Scanner bubbles padhta hai, labels nahi — roll reading par asar nahi.
- Exam banate waqt "Roll No Digits" ab dropdown (1–5 digits). Test `test_roll_digits_1_to_5.js`: 1..5 digit roll exact padha jata hai.
- Speed: (auto-save delay badlav hata diya — repo ki `_autoGo` 700ms hi rakhi.) Stable-hold 500 ms jaisa tha waisa hi rakha (400 try kiya to tuned stability tests toote — accuracy ke liye revert).
- Question blocks ko shift karna: scanner fixed registration-square geometry par based hai, isliye ye add nahi kiya (galat align = galat marks).

---
## v212 — merge fix
Repo ki exam-manager.js (commit 45b0116) mein `_autoWhy/_autoGo/_autoNote` (auto-save reason), `_HOLD=250`, non-blocking commit wale badlav the, jo v211 ne overwrite kar diye the.
Ab wahi file base hai aur v209 (blot/double-mark), v210 (Roll ?? retry), v211 (roll labels hataye — HTML, canvas aur PDF teeno) upar merge hain.
