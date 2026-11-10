# v1.4.7 / build 201 — Smooth UI (lag + overlay fix)

## Bugs fixed
1. **Batch / Analysis / More page ke peeche home page move hota tha**
   - Overlay `bottom:var(--snh)` (84px) par ruk jaata tha, neeche ki patti me home page dikhta + scroll hota tha.
   - Ab `#bm-student` aur `#sn-page` `bottom:0` tak jaate hain, nav ke liye `padding-bottom` hai.
   - `overscroll-behavior:contain` -> overlay ka scroll peeche leak nahi hota.
   - `html{scroll-behavior:smooth}` hata diya (scrollTo(0,0) animate hoke home ko ghumata tha).
   - `smooth-ui.js`: overlay khulte hi `html.sn-ovl` -> peeche ka page lock + paint band.
2. **Lag**
   - `.card` etc. par `backdrop-filter:blur(20px/8px)` (styles.css) hata diya — sabse bada scroll-lag.
   - `transition:all` + bouncy easing -> sirf transform/opacity/color/shadow.
   - Lambi lists par `content-visibility:auto`.
   - Wallpaper layer GPU par.
   - Background polling kam: batch hook 1.5s->2.5s, prefetch 5s->15s, rank 2.5s->8s, native-push 5s->15s, read-meter 2.5s->5s; sab sirf jab app visible ho.
3. Page khulne par halka (opacity+transform) animation.

## Files
New: `smooth-ui.css`, `smooth-ui.js`. Edited: `index.html`, `owner-app.html`, `batch-system.css/js`, `app-ui.css/js`, `native-push.js`, `read-meter.js`, `sw.js`, `scripts/build-www.js`, version files.

## Rollback
index.html se `smooth-ui.css` / `smooth-ui.js` ki line hata do -> purana look/behaviour (baaki edits chhote hain).

# v1.4.8 / build 202 — Instant click

- **Admin Batch panel** ab click par turant khulta hai (pehle network load hone tak sirf "Loading" toast aata tha). Pichla data ho to usi se dikhta hai, fresh data peeche load hoke update hota hai.
- **Paint-first renders** (`snP` in perf-lite.js): admin tabs (Bank, Tests, Trash, Grade, Leaderboard, Settings, Records) aur student sections (Tests, Settings) pehle screen dikhate hain, bhaari list render agle frame me.
- **Instant scroll**: script.js ke 13 `scrollIntoView(smooth)` + global patch (smooth-ui.js) — har scrollTo/scrollIntoView ab animation ke bina.
- Batch card images `loading=lazy decoding=async`; batch detail khulne par scroll top se.
- iOS/Android tap feedback ke liye passive touchstart.

# v1.4.9 / build 203 — OMR scan: fast + no wait + no name-OCR lag

Sab changes `exam-manager.js` me (Scan Sheet).
- **Name OCR band** (Tesseract: ~10MB download + CPU heavy = camera lag, aur handwriting par galat). Roll No bubbles se hi pehchaan hoti hai. Wapas chahiye: `localStorage.snap_scan_ocr="1"`.
- **HQ takePhoto wait hata** (4.5s tak ruka rehta tha). Ab lock hote hi turant sharpest video frame se grading. Purana mode: `?scanq=hi`; chhota-fast photo mode: `?scanq=std`; `?scanq=low` = sirf video.
- **Quality**: normal phone par camera 1800x2400 @30fps (low-end par pehle jaisa 1440x1920), continuous autofocus/exposure/white-balance, capture canvas 2000px (low-end 1600px).
- **Blur gate**: lock turant hota hai; frame blurry ho to max 2 extra frame (~0.25s) wait karke sabse sharp frame use hota hai.
- **Save ke baad seedha agla scan** (link-to-student popup har sheet par nahi aata). Scanner ke upar-left "⚡ Link: Baad me / 🔗 Link: Turant" button se pehla flow wapas.
