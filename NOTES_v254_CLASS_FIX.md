# v254 — Generator me 9th ke questions (web 1.4.40, build 254)
- Class ki alag-alag shakl ("9", "class9", "Class 9", khali) ko "class_9" jaisa banaya; khali ho to doc ID ("class9-...") se nikalta hai.
  Isse Class 9 filter / allowed-class check me question chhootte nahi.
- Generator me count ke neeche nayi line: "Total N → Class 9: x · Class 10: y · ..." — turant dikhta hai kaun-si class ke kitne questions load hue.
  Agar Class 9 line me hi nahi hai to questions backend me nahi hain (recover-bank.html chalao); agar hai par list me nahi dikhte to filter dekho.
Files: qgen-reconcile.js (v=2), qgen-app.js, question-generator.html, index.html, sw.js, version.json, package.json, app-config.js
