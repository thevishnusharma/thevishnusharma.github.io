# Phase 4A (v221) — gehri branding, web

Data: `institutes/{id}`: `name, logoDataUrl, brandColor, tagline` (pehle se) + naya `hidePoweredBy` (bool, sirf Owner likhta hai).
Cache: `snap_brand_<id>` (branding.js). Splash wahi cache padhta hai.

Kill-switch: `SNAP_CONFIG.branding2=false` -> branding.js `snap_brand2_off=1` likhta hai, splash purana, baaki sab fallback par.

Helpers (`window.SnapBrand`): `rsf(key, fallback)` result sheet, `plain(fallback)` WhatsApp naam, `printBar()` print patti. Sab escaped; logo sirf `data:image/(png|jpg|webp|gif);base64`.

Abhi nahi (4B): APK native splash/status bar rang, `fetch-institute.js` rang. Result sheet ke baaki hard-coded text aur certificate: certificate ka code mujhe nahi mila.
Chalaya nahi: asli printer/PDF, phone par splash/login card.
