/* v221 Phase 4A: pichli baar ka institute (cache me) ho to splash uska logo/naam/tagline/rang dikhaye. Cache na ho ya
   SNAP_CONFIG.branding2=false ho (branding.js flag likhta hai) to purana splash image chalta hai. Text sirf textContent se. */
(function () {
  try {
    if (localStorage.getItem("snap_brand2_off") === "1") return;
    var id = localStorage.getItem("snap_brand_last"); if (!id) return;
    var b = JSON.parse(localStorage.getItem("snap_brand_" + id) || "null"); if (!b || !b.name) return;
    var el = document.getElementById("app-splash-screen"); if (!el) return;
    function sh(hex, f) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, k = n & 255; function c(x) { return Math.max(0, Math.min(255, Math.round(x * f))); } return "rgb(" + c(r) + "," + c(g) + "," + c(k) + ")"; }
    var col = /^#[0-9a-f]{6}$/i.test(b.brandColor || "") ? b.brandColor : "";
    el.style.background = col ? "linear-gradient(160deg," + sh(col, 0.55) + "," + sh(col, 0.2) + ")" : "#060513";
    el.style.flexDirection = "column"; el.style.gap = "14px"; el.style.textAlign = "center"; el.style.padding = "24px";
    var im = el.querySelector("img"); if (im) im.style.display = "none";
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(b.logoDataUrl || "")) {
      var lg = document.createElement("img"); lg.src = b.logoDataUrl; lg.alt = ""; lg.style.cssText = "width:112px;height:112px;object-fit:contain;border-radius:24px;background:#fff;padding:8px;box-shadow:0 8px 30px rgba(0,0,0,.35);"; el.appendChild(lg);
    }
    var nm = document.createElement("div"); nm.textContent = b.name; nm.style.cssText = "color:#fff;font:800 1.5rem/1.25 system-ui,sans-serif;"; el.appendChild(nm);
    if (b.tagline) { var tg = document.createElement("div"); tg.textContent = b.tagline; tg.style.cssText = "color:rgba(255,255,255,.8);font:500 .95rem/1.3 system-ui,sans-serif;"; el.appendChild(tg); }
  } catch (e) {}
})();

  (function () {
    var SPLASH_DURATION_MS = 400; // PERF FIX v126: pehle 2200ms tha —
    // jabardasti har visit par 2.2s+ wait karwata tha chahe content
    // turant ready ho. LCP/Speed Index dono is fixed delay ki wajah se
    // seedha 2.2s+ se start hote the. Ab sirf ek chhota "brand flash"
    // (400ms) — content jitni jaldi ready ho utni jaldi dikhta hai.
    // PERF FIX v127: pehle "DOMContentLoaded" ka wait karta tha — jo
    // is script se BAAD wale saare `<script defer>` (4 Firebase SDK
    // files + script.js 232 KB + 10+ aur files) poori tarah
    // download+execute hone ke baad hi fire hota hai. Splash us poori
    // chain ke khatam hone tak screen ko block kiye rakhta tha (LCP
    // 9+ second tak chala jaata tha), jabki splash hatane ke liye in
    // mein se kisi bhi file ki zaroorat nahi hai — yeh apna khud ka
    // fixed-timer hai. Ab seedha turant (is inline script ke chalte
    // hi) apna 400ms ka timer shuru karta hai.
    (function () {
      // v143: splash tab hi hatao jab styles.css load ho chuki ho (max 8s). Pehle sirf 400ms ka
      // timer tha — slow load (app ya slow net) me splash hatne ke baad kuch second bina design ka
      // plain text dikhta tha.
      var t0 = Date.now();
      function hideSplash() {
        var el = document.getElementById("app-splash-screen");
        if (!el) return;
        el.style.opacity = "0";
        setTimeout(function () { el.remove(); }, 500);
      }
      function tick() {
        var waited = Date.now() - t0;
        if (waited >= SPLASH_DURATION_MS && (window.__stylesReady || waited >= 8000)) hideSplash();
        else setTimeout(tick, 50);
      }
      setTimeout(tick, SPLASH_DURATION_MS);
    })();
  })();
