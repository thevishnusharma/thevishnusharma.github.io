# v269 — OMR Attempt Limit (cumulative: v266–v268 bhi shamil)

Exam -> Settings -> naya field "Attempt Limit" (khali = sab sawal check).
- Scan me jo sawal bhare hain unhe number ke order me gina jata hai; pehle N bhare hue hi check hote hain. N ke baad ke bhare sawal "extra" (marks me nahi, grey ring), khali sawal ginti me nahi.
- Double-mark = bhara hua gina jata hai (0 marks, ginti me count) — online test jaisa.
- Total marks / percentage = limit ke hisaab se (reports, share, detail view). Detail table me extra rows halki dikhti hain.
- Manual answer edit + save bhi limit follow karta hai.
- OMR -> student record sync: exam ka limit pehle, warna linked test ka attemptLimit.
- Files: exam-manager.js, exam-manager.css, index.html, sw.js(v269).
- Test: Xt par 3 case (no limit / 70 / 15) pass.
- Dhyan: limit badalne se pehle scan ho chuki sheets ke saved marks apne-aap nahi badalte; unhe dobara save/scan karein.
