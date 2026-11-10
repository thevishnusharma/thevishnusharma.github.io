# v229 — Multiple Sets (Paper Generator ↔ OMR Exam Manager)

## Kya badla
- **Paper Generator → Settings → "Number of Sets" (1–5)**. Set A = original paper. Set B–E = same questions, order alag (section ke andar hi; subjective apni jagah). Toggle: **"Options bhi shuffle karein"** (default off).
- Preview / Answer Key / Print / Booklet / Booklet Word / Word: upar **Set A–E chips** se set chuno; header me "SET B" likha aata hai, key bhi usi set ki. **"Word (All Sets)"** = saare sets ek file me. Answer Key tab me "Sab Sets ki Answer Key" table.
- Save to Drafts / Save & Admin ko Bhejein: test document me `qSets` field (order + option order). Extra Firestore read nahi.
- **Publish / sync** (`syncTestToExamManager`, script.js): Exam Manager exam me `sets:N` + `answerKeys:{A,B,C…}` apne-aap. Exam Manager me OMR sheet par N set bubbles, scan par detect hue set ki key se marks.
- **Exam Manager → Answer Key**: set tabs, "📄 Paper se auto-filled" tag, "📄 Paper se dobara bharo" button, manual edit allowed.

## Safety rules
1. Key kabhi store karke nahi rakhi jaati — har baar current answers + set ke permutation se **compute** hoti hai (`paper-sets.js`). Generator aur sync SAME code use karte hain.
2. `qSets` me question ids ka signature hai. Test ke questions badle/reorder/hata/jude to sets **invalid** → set keys NAHI likhi jaati, Exam Manager me laal warning ("Sets dobara banayein"). Generator me paper badalne par sets auto-regenerate.
3. "Sab sahi / A aur B dono / None of the above / उपरोक्त सभी / कोई नहीं / दोनों" jaise options wale question me option shuffle nahi (sirf order).
4. **Manual edit safe**: Exam Manager me jis set ki key manually badli (`manualSets`), wo re-sync par overwrite nahi hoti; "Paper se dobara bharo" se hi (confirm ke saath) badlegi.
5. Set bubble blank + multi-set exam: scan screen par "⚠️ Set bubble nahi mila" aur auto-save nahi hota. Agar kisi set ki key khali ho to us set ki sheet "ungraded" (Set A ki key se galat marks nahi).
6. Generator me sets 1 karne par purana `qSets` delete; exam wapas 1 set (agar wo paper se multi-set bana tha). Jo exam manually multi-set kiya gaya tha use plain re-sync chhota nahi karta (pehle ye `answerKeys:{A}` se B–E ki keys mita deta tha).
7. Admin "Edit Test" / auto-save `qSets` preserve karte hain.

## Files
Naye: `paper-sets.js` (shared logic), `qgen-sets.js` (Paper Generator UI). Badle: `qgen-app.js`, `question-generator.html`, `qgen-style.css`, `booklet-print.js`, `four-column-print.js`, `script.js`, `exam-manager.js`, `exam-manager.css`, `index.html`, `inline/index-inline-06.js`, `sw.js`.
Test: `tests/unit/test_multi_sets_v229.js` (300 random papers: key == printed set me sahi option; sync cases; qgen views). `npm test` 42/42. Browser(jsdom) me question-generator.html chalakar UI check kiya. Phone/emulator/Firebase live par nahi chala.

## Limit
- OMR sheet max 100 MCQ (pehle jaisa). Sets A–E max.
- "Print All Sets" nahi hai — Word (All Sets) ya set chunkar Print.
