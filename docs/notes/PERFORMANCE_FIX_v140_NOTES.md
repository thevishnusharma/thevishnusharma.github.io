# Performance Fix — v140 (13 items)

Sab fixes `script.js`, `student-features.js`, `index.html` me hain. Koi naya Firestore
collection / rules change / composite index zaroori NAHI hai.

| # | Fix | File |
|---|-----|------|
| 1 | `setInterval(S,500)` ab sirf cheap signature check karta hai (bank length/class/institute); heavy filter rebuild sirf badalne par. Tab hidden ho to skip. | student-features.js |
| 2 | `showResult()` ab `saveRecordOnline` ka wait nahi karta — result turant. Local record + attempts cache optimistic update, save background me. | script.js |
| 3 | `saveExamProgressLocal()` test ka JSON ek baar bana kar cache karta hai (har tap par poora test re-stringify nahi). Output format same. | script.js |
| 4 | Option tap par full re-render nahi: sirf selected class + palette status + stats + save. Question palette ab incremental (buttons reuse). `stripInlineColors` cache + plain-text fast path. KaTeX walk skip jab math delimiter na ho. | script.js, index.html |
| 5 | `beginExam()` me pehla question 2 baar render hota tha — ek hata diya. | script.js |
| 6 | Student ke records ek shared 15s fetch se aate hain (attempts cards, My Progress, My Results ek hi query). Duplicate in-flight calls merge. Refresh button cache invalidate karta hai. | script.js, student-features.js |
| 7 | Dashboard auto-refresh 25s -> 150s (tab visible hone par). | student-features.js |
| 8 | Leaderboard (student side): light cache localStorage me, 3 ghante me full refresh, beech me sirf naye records (`savedAt >` delta, single-field index, koi composite index nahi). Details field cache me nahi. Admin path unchanged (full). | student-features.js |
| 9 | Rank ke liye test records student side par light form (details nahi) + 10 min cache. Admin ke liye full records waise hi. | script.js |
| 10 | Login: `sha256` ab Firestore get ke saath parallel; legacy secret migration background me (login ka wait nahi). | script.js |
| 11 | `syncTests`: test ki `updatedAt` same ho to chunks dobara load nahi; cache write debounce (1.5s); 6 render functions ek baar (150ms debounce, pehla snapshot turant). | script.js |
| 12 | `syncBank`: sirf changed docs par `autoFormatMathFields`; poora sort/format sirf pehle snapshot par. Cache write debounce (2.5s) + tab hide/pagehide par flush. | script.js |
| 13 | Startup par bank cache ka synchronous `JSON.parse` ab idle time me; Firebase data pehle aa jaye to cache skip. | script.js |

## Tested (Chromium + mock Firestore)
- 100-question exam: 100 tap+next = 1355 ms -> 428 ms. Answers, palette, saved progress (resume) identical.
- Bank snapshot: added/modified/removed sahi, sorted order same.
- Attempts: 3 parallel calls = 1 query; optimistic attempt refetch ke baad bhi bachta hai.
- Leaderboard: pehli baar full, baad me delta query; cache me details nahi.
- Rank cache: dobara fetch nahi hota.

## Dhyan dene wali baatein
- Leaderboard delta me deleted records 3 ghante tak (full refresh tak) dikh sakte hain.
- Dashboard auto-refresh ab 2.5 min me hota hai (manual refresh button turant).
- Firebase server/network ki apni latency in fixes se nahi hat sakti.
