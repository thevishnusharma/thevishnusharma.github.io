# Phase 3B — Demo Institute (v220, web 1.4.15)

## Deploy (is order me)
1. Firebase Console -> Firestore -> Rules: `firestore.rules` paste -> **Publish** (Owner ke demo-only rules).
2. Zip ko GitHub `updates/` folder me upload karo.
3. Owner app -> Settings tab -> "🧪 Demo Institute" -> **Demo banao**.

## Rollback
`app-config.js` me `demo: false` (buttons chhup jate hain) ya commit Revert. Demo data "Demo reset" se hat jata hai.

## Kya banta hai
Institute `demo_sample` (isDemo:true), 20 students (mobile 0000000001..20, secrets/sessions nahi => login nahi), 2 batches (3 recording + 1 upcoming class har me, YouTube ID), 2 tests (5 sawaal), 40 results. ~105 docs, 2 commits.
Demo dekhne ke liye: Demo card ke "Admin" se apna doosra email jodo, us se admin login karo.

## Reset
Pehle demo institute ka batch-tree, phir `isDemo==true` tests (+qchunks), results, students, aakhir me institute doc. Asli data par koi query nahi.
Agar demo ke liye admin jora tha to uska admin record Owner Panel ke orphan block se alag se hatao.

## Stats
Demo institute dashboard totals, recount aur limit alerts me nahi ginta. Card par DEMO badge.

## Chalaya nahi / verify karna
Phone par seed/reset, `npm run test:rules` (7 naye emulator test). Demo ke test/batch/member docs ke field maine app ke code se mile shapes se banaye hain (test `isDraft:false`, question `questionEN/optionsEN/correctAnswer`, batch `type:"free"`, member `status:"active"`) — pehli baar demo admin me khol kar dekh lena ki Tests, Batches, Students theek dikhte hain.
