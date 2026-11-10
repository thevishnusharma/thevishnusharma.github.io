# v274 — OMR Scan Sheet smooth (camera quality / check process me KOI badlav nahi) (cumulative: v266–v273 shamil)

Sirf exam-manager.js. Detection, grading, camera resolution/focus/photo-capture ka logic bilkul same.
Kya badla (sab "same result, kam kaam"):
1. Har 130ms par 4 markers ke liye ~2MB naye arrays (seen/queue/luminance/sharpness) bante the -> GC ke jhatke. Ab ek baar bane buffers dobara use hote hain (_pb pool).
2. Marker loop me "DOM padho -> likho -> padho" ka chakkar (forced layout x4 har cycle) tha. Ab pehle sab padhta hai, phir sab likhta hai.
3. Status text / "x / 4 markers" / dot ki position: value wahi ho to DOM me dobara nahi likhta (har cycle ka layout/paint bachta hai).
4. Result photo ka JPEG encode (quality .92 wahi) ab async toBlob se — result dikhate waqt screen atakti nahi thi.
Test: 48 synthetic cases (alag-alag size, lagatar chalaakar buffer reuse bhi) me purane aur naye code ka detection + sharpness output BIT-FOR-BIT same. Per-cycle compute: mean 16.3 -> 14.6ms, p95 22.9 -> 18.8ms, worst 133 -> 97ms (GC spikes kam).
Pichle zip ki tarah upload karein; scan screen khol kar ek-do sheet check kar lein.
