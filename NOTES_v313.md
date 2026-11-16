# v313 — Test card, Start flow, Analysis (attempts), Parts

- Test card: attempt ke baad sirf 3 button — Re-attempt, Solution, Analysis. Weak Practice / Re-attempt Wrong card se hata diye (result screen par wahi buttons pehle jaise hain).
- Start / Re-attempt dabane par pehle Instructions -> Symbols -> Language + Agree, phir exam shuru. Timer confirm ke baad hi chalta hai. Resume, Practice aur Re-attempt-Wrong par ye flow nahi aata.
- Analysis: upar Attempt dropdown (Attempt 1/2/3, sirf tab jab 2+ attempt ho). Score ring, Sahi/Galat/Skip, Accuracy, Time, attempts ka sudhaar, section-wise, chapter-wise, Top 3, Aap/Average/Topper. Test card par attempt ka koi zikr nahi.
- Exam: section tabs (Part A/B/C...) + question swipe animation. Purana swipe "exam-main" id dhundta tha jo HTML me tha hi nahi, isliye kabhi chalta nahi tha — naya swipe class se judta hai.
- Exam submit hote hi (button ya time khatam) Analysis apne-aap khulta hai. Practice / Re-attempt-Wrong par nahi.
- Admin: Parts/Sections — naam, optional Subject, Marks/Q, up/down, delete, "Kai Parts ek saath". Subject test ke sections me save hota hai (`sections[].subject`).
- Nayi files: exam-flow-v2.js, exam-flow-v2.css, admin-parts-v2.js. Badli: script.js (sections me subject), index.html, sw.js, version.json, app-config.js, package.json.
- Kill-switch: app-config.js me `examFlowV2: false`.
- Firestore rules / Worker me koi badlaav nahi. Rank/Top 3 purane records-reads hi use karte hain (naya read nahi).
