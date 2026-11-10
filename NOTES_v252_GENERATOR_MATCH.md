# v252 — Paper Generator ab Question Bank ke barabar (web 1.4.38, build 252)

## Problem
Question Bank 7726, Paper Generator 7550 (176 kam). Dono alag-alag load hote the, isliye farak reh jata tha.

## Fix: "milan" (naya qgen-reconcile.js)
Generator khulne / refresh hone ke baad chupke se admin list se milata hai:
- Jo question admin me hain par generator me nahi -> backend se seedha ID se mangwa kar jod deta hai.
- Jo admin list me hain par backend me hain hi nahi (purane/ghost) -> admin list se hata deta hai.
- Jo is admin ki allowed class ke bahar hain -> add nahi karta, bas toast me batata hai kitne.
Sirf farak wale questions ki ID mangti hai (poora bank dobara nahi). Firebase reads = 0.
Screen par toast aata hai: "🔄 Bank milan: X question generator me jode, Y purane admin list se hataye".
Console me poori detail: "[Bank] milan: admin list me N, generator me M tha. Jode:... "

## Files
qgen-reconcile.js (naya), qgen-app.js, question-generator.html, script.js, index.html, sw.js,
version.json, package.json, app-config.js, tests/unit/test_qgen_reconcile_v252.js
(v250/v251 ki files bhi zip me hain)

## Check
node --check OK; unit tests 54/54 (naya test: jodna, ghost hatana, class ke bahar, barabar hone par kuch nahi).
