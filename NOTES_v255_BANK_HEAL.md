# v255 — Question Bank = Backend = Generator (web 1.4.41, build 255)
Screenshot: Generator "Total 7550 -> Class 10: 7550" (Class 9 ek bhi nahi) aur Question Bank 7499. Matlab:
1. 9th ke 227 question BACKEND me hain hi nahi (isliye generator me nahi) -> recover-bank.html se wapas jodo.
2. Question Bank ki list backend se 51 question peeche thi (sync chhut gaya tha).

## Fix
- script.js `__bankHealCheck`: app khulne ke 9s/30s baad aur Bank/Generator tab kholte hi backend ka count (1 chhota request) ghar ki list se milata hai.
  Alag ho to chupke se backend se poori list le aata hai ("🔄 Question Bank backend se match kiya: 7499 → 7550"). Firebase reads 0.
- recover-bank.html: login ke baad apne-aap scan; 9th wale groups pehle se tick; Firebase me class field + doc ID ("class9-...") dono se dhoondta hai.
Files: script.js, recover-bank.html, sw.js, version.json, package.json, app-config.js, tests/unit/test_bank_heal_v255.js
